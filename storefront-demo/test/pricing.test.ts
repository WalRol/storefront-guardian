import { describe, expect, it } from 'vitest';
import { priceCart, type Promotion } from '../src/pricing';

const promos: Promotion[] = [
  { type: 'CATEGORY_PERCENT', category: 'moda', percent: 20 },
  { type: 'CATEGORY_PERCENT', category: 'moda', percent: 10 },
  { type: 'COUPON_FIXED', code: 'BIENVENIDA', amountCents: 5000, minPurchaseCents: 20000 },
];

describe('priceCart', () => {
  it('suma el subtotal en céntimos sin errores de redondeo', () => {
    const totals = priceCart(
      [{ sku: 'A', qty: 3, unitPriceCents: 1990, category: 'otros' }],
      [],
    );
    expect(totals.subtotalCents).toBe(5970);
    expect(totals.totalCents).toBe(5970);
  });

  it('aplica solo la mejor promoción de categoría (no acumulables)', () => {
    const totals = priceCart(
      [{ sku: 'POLO', qty: 2, unitPriceCents: 3490, category: 'moda' }],
      promos,
    );
    expect(totals.discountCents).toBe(1396); // 20% de 6980
    expect(totals.totalCents).toBe(5584);
  });

  it('aplica el cupón solo si el subtotal descontado alcanza el mínimo', () => {
    const below = priceCart(
      [{ sku: 'POLO', qty: 5, unitPriceCents: 3490, category: 'moda' }],
      promos,
      'BIENVENIDA',
    );
    // 17450 - 20% = 13960 < 20000 → sin cupón
    expect(below.discountCents).toBe(3490);

    const above = priceCart(
      [{ sku: 'TV', qty: 1, unitPriceCents: 179990, category: 'electro' }],
      promos,
      'BIENVENIDA',
    );
    expect(above.discountCents).toBe(5000);
  });

  it('ignora cupones inexistentes', () => {
    const totals = priceCart(
      [{ sku: 'TV', qty: 1, unitPriceCents: 179990, category: 'electro' }],
      promos,
      'NO-EXISTE',
    );
    expect(totals.discountCents).toBe(0);
  });

  it('el total nunca es negativo', () => {
    const totals = priceCart(
      [{ sku: 'X', qty: 1, unitPriceCents: 1000, category: 'otros' }],
      [{ type: 'COUPON_FIXED', code: 'GRANDE', amountCents: 999999, minPurchaseCents: 0 }],
      'GRANDE',
    );
    expect(totals.totalCents).toBe(0);
  });
});
