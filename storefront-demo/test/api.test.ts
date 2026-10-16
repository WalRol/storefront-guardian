import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createDb, type DB } from '../src/db';

let db: DB;
let app: ReturnType<typeof createApp>;

const ANA = { Authorization: 'Bearer token-ana' };
const BRUNO = { Authorization: 'Bearer token-bruno' };

beforeEach(() => {
  db = createDb();
  app = createApp(db);
});

describe('catálogo', () => {
  it('busca productos con el precio de la tienda indicada', async () => {
    const res = await request(app).get('/stores/online/products?q=Polo');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      expect.objectContaining({ sku: 'POLO-ALG-M', priceCents: 3490 }),
    ]);
  });

  it('trata la búsqueda como texto literal', async () => {
    const res = await request(app).get(
      `/stores/online/products?q=${encodeURIComponent("' OR '1'='1")}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('devuelve 404 para un SKU inexistente', async () => {
    const res = await request(app).get('/stores/online/products/NOPE');
    expect(res.status).toBe(404);
  });
});

describe('checkout', () => {
  it('exige autenticación', async () => {
    const res = await request(app)
      .post('/stores/online/orders')
      .send({ items: [{ sku: 'POLO-ALG-M', qty: 1 }] });
    expect(res.status).toBe(401);
  });

  it('crea la orden con precios de la tienda y descuenta stock', async () => {
    const res = await request(app)
      .post('/stores/online/orders')
      .set(ANA)
      .send({ items: [{ sku: 'POLO-ALG-M', qty: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ subtotalCents: 6980, discountCents: 1396, totalCents: 5584 });

    const { qty } = db
      .prepare("SELECT qty FROM inventory WHERE store_id = 'online' AND sku = 'POLO-ALG-M'")
      .get() as { qty: number };
    expect(qty).toBe(98);
  });

  it('rechaza con 409 si no hay stock y no deja la orden a medias', async () => {
    const res = await request(app)
      .post('/stores/online/orders')
      .set(ANA)
      .send({
        items: [
          { sku: 'POLO-ALG-M', qty: 1 },
          { sku: 'ZAP-RUN-42', qty: 1 }, // stock 0 en online
        ],
      });
    expect(res.status).toBe(409);

    const { qty } = db
      .prepare("SELECT qty FROM inventory WHERE store_id = 'online' AND sku = 'POLO-ALG-M'")
      .get() as { qty: number };
    expect(qty).toBe(100);
  });

  it('valida el cuerpo de la petición', async () => {
    const res = await request(app)
      .post('/stores/online/orders')
      .set(ANA)
      .send({ items: [{ sku: 'POLO-ALG-M', qty: -1 }] });
    expect(res.status).toBe(400);
  });
});

describe('órdenes', () => {
  it('un usuario no puede ver órdenes ajenas', async () => {
    const created = await request(app)
      .post('/stores/online/orders')
      .set(ANA)
      .send({ items: [{ sku: 'TV-55-4K', qty: 1 }] });

    const own = await request(app).get(`/orders/${created.body.orderId}`).set(ANA);
    expect(own.status).toBe(200);
    expect(own.body.items).toHaveLength(1);

    const other = await request(app).get(`/orders/${created.body.orderId}`).set(BRUNO);
    expect(other.status).toBe(404);
  });
});
