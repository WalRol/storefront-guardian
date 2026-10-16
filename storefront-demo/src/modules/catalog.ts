import { Router } from 'express';
import type { DB } from '../db';

interface ProductRow {
  sku: string;
  name: string;
  category: string;
  priceCents: number;
  stock: number;
}

export function catalogRouter(db: DB): Router {
  const router = Router();

  const search = db.prepare(`
    SELECT p.sku, p.name, p.category, sp.price_cents AS priceCents, i.qty AS stock
    FROM products p
    JOIN store_prices sp ON sp.sku = p.sku AND sp.store_id = @storeId
    JOIN inventory    i  ON i.sku  = p.sku AND i.store_id  = @storeId
    WHERE p.name LIKE @pattern
    ORDER BY p.name
  `);

  const findOne = db.prepare(`
    SELECT p.sku, p.name, p.category, sp.price_cents AS priceCents, i.qty AS stock
    FROM products p
    JOIN store_prices sp ON sp.sku = p.sku AND sp.store_id = @storeId
    JOIN inventory    i  ON i.sku  = p.sku AND i.store_id  = @storeId
    WHERE p.sku = @sku
  `);

  // GET /stores/:storeId/products?q=texto
  router.get('/stores/:storeId/products', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const rows = search.all({ storeId: req.params.storeId, pattern: `%${q}%` }) as ProductRow[];
    res.json({ items: rows });
  });

  // GET /stores/:storeId/products/:sku
  router.get('/stores/:storeId/products/:sku', (req, res) => {
    const row = findOne.get({ storeId: req.params.storeId, sku: req.params.sku }) as
      | ProductRow
      | undefined;
    if (!row) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
    res.json(row);
  });

  return router;
}
