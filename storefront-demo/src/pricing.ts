// Cálculo de precios del carrito. Todos los montos se manejan en céntimos
// (enteros) para evitar errores de redondeo con punto flotante.

export interface CartLine {
  sku: string;
  qty: number;
  unitPriceCents: number;
  category: string;
}

export type Promotion =
  | { type: 'CATEGORY_PERCENT'; category: string; percent: number }
  | { type: 'COUPON_FIXED'; code: string; amountCents: number; minPurchaseCents: number };

export interface PricedLine extends CartLine {
  discountCents: number;
}

export interface CartTotals {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

/**
 * Reglas de negocio:
 * - Las promociones por categoría NO son acumulables: a cada línea se le aplica
 *   solo el mayor porcentaje vigente para su categoría.
 * - El cupón de monto fijo se aplica sobre el subtotal ya descontado y solo si
 *   ese monto alcanza la compra mínima.
 * - El total nunca puede ser negativo.
 */
export function priceCart(
  lines: CartLine[],
  promotions: Promotion[],
  couponCode?: string,
): CartTotals {
  const categoryPromos = promotions.filter(
    (p): p is Extract<Promotion, { type: 'CATEGORY_PERCENT' }> => p.type === 'CATEGORY_PERCENT',
  );

  const pricedLines: PricedLine[] = lines.map((line) => {
    const best = categoryPromos
      .filter((p) => p.category === line.category)
      .reduce((max, p) => Math.max(max, p.percent), 0);
    const gross = line.unitPriceCents * line.qty;
    return { ...line, discountCents: Math.round((gross * best) / 100) };
  });

  const subtotalCents = pricedLines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0);
  const lineDiscounts = pricedLines.reduce((sum, l) => sum + l.discountCents, 0);

  let couponDiscount = 0;
  if (couponCode) {
    const coupon = promotions.find(
      (p): p is Extract<Promotion, { type: 'COUPON_FIXED' }> =>
        p.type === 'COUPON_FIXED' && p.code === couponCode,
    );
    if (coupon && subtotalCents - lineDiscounts >= coupon.minPurchaseCents) {
      couponDiscount = coupon.amountCents;
    }
  }

  const discountCents = lineDiscounts + couponDiscount;
  return {
    lines: pricedLines,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}
