import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth';
import type { DB } from '../db';
import { priceCart, type CartLine, type Promotion } from '../pricing';

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        qty: z.number().int().positive().max(20),
      }),
    )
    .min(1),
  couponCode: z.string().optional(),
});

class CheckoutError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

interface PromotionRow {
  type: Promotion['type'];
  category: string | null;
  percent: number | null;
  code: string | null;
  amount_cents: number | null;
  min_purchase_cents: number | null;
}

function toPromotion(row: PromotionRow): Promotion {
  return row.type === 'CATEGORY_PERCENT'
    ? { type: row.type, category: row.category!, percent: row.percent! }
    : {
        type: row.type,
        code: row.code!,
        amountCents: row.amount_cents!,
        minPurchaseCents: row.min_purchase_cents!,
      };
}

export function ordersRouter(db: DB): Router {
  const router = Router();
  router.use('/stores/:storeId/orders', requireAuth(db));
  router.use('/orders', requireAuth(db));

  const findPricedProduct = db.prepare(`
    SELECT p.sku, p.category, sp.price_cents AS unitPriceCents
    FROM products p
    JOIN store_prices sp ON sp.sku = p.sku
    WHERE p.sku = ? AND sp.store_id = ?
  `);
  const reserveStock = db.prepare(`
    UPDATE inventory SET qty = qty - @qty
    WHERE store_id = @storeId AND sku = @sku AND qty >= @qty
  `);
  const findPromotions = db.prepare('SELECT * FROM promotions WHERE store_id = ?');
  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, store_id, subtotal_cents, discount_cents, total_cents)
    VALUES (@userId, @storeId, @subtotalCents, @discountCents, @totalCents)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, sku, qty, unit_price_cents, discount_cents)
    VALUES (@orderId, @sku, @qty, @unitPriceCents, @discountCents)
  `);
  const findOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
  const findOrderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');

  // Todo el checkout corre en una transacción: si un ítem falla, no se
  // descuenta stock de ningún otro.
  const checkout = db.transaction(
    (userId: number, storeId: string, input: z.infer<typeof checkoutSchema>) => {
      const lines: CartLine[] = input.items.map(({ sku, qty }) => {
        const product = findPricedProduct.get(sku, storeId) as
          | Omit<CartLine, 'qty'>
          | undefined;
        if (!product) throw new CheckoutError(404, 'PRODUCT_NOT_FOUND');
        const { changes } = reserveStock.run({ storeId, sku, qty });
        if (changes === 0) throw new CheckoutError(409, 'OUT_OF_STOCK');
        return { ...product, qty };
      });

      const promotions = (findPromotions.all(storeId) as PromotionRow[]).map(toPromotion);
      const totals = priceCart(lines, promotions, input.couponCode);

      const { lastInsertRowid } = insertOrder.run({
        userId,
        storeId,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        totalCents: totals.totalCents,
      });
      for (const line of totals.lines) {
        insertItem.run({ orderId: lastInsertRowid, ...line });
      }
      return { orderId: Number(lastInsertRowid), ...totals };
    },
  );

  // POST /stores/:storeId/orders
  router.post('/stores/:storeId/orders', (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.issues });
    }
    try {
      const result = checkout(req.user!.id, req.params.storeId, parsed.data);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof CheckoutError) {
        return res.status(err.status).json({ error: err.code });
      }
      throw err;
    }
  });

  // GET /orders/:id — un usuario solo puede ver sus propias órdenes.
  router.get('/orders/:id', (req, res) => {
    const order = findOrder.get(Number(req.params.id)) as { user_id: number } | undefined;
    if (!order || order.user_id !== req.user!.id) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    }
    res.json({ ...order, items: findOrderItems.all(Number(req.params.id)) });
  });

  return router;
}
