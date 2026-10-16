import Database from 'better-sqlite3';

export type DB = Database.Database;

const SCHEMA = `
  CREATE TABLE stores (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE products (
    sku      TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    category TEXT NOT NULL
  );

  -- Cada tienda define su propio precio (en céntimos) para un mismo SKU.
  CREATE TABLE store_prices (
    store_id    TEXT    NOT NULL REFERENCES stores(id),
    sku         TEXT    NOT NULL REFERENCES products(sku),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    PRIMARY KEY (store_id, sku)
  );

  CREATE TABLE inventory (
    store_id TEXT    NOT NULL REFERENCES stores(id),
    sku      TEXT    NOT NULL REFERENCES products(sku),
    qty      INTEGER NOT NULL,
    PRIMARY KEY (store_id, sku)
  );

  CREATE TABLE users (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE
  );

  CREATE TABLE promotions (
    id                 INTEGER PRIMARY KEY,
    store_id           TEXT NOT NULL REFERENCES stores(id),
    type               TEXT NOT NULL CHECK (type IN ('CATEGORY_PERCENT', 'COUPON_FIXED')),
    category           TEXT,
    percent            INTEGER,
    code               TEXT,
    amount_cents       INTEGER,
    min_purchase_cents INTEGER
  );

  CREATE TABLE orders (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id),
    store_id          TEXT    NOT NULL REFERENCES stores(id),
    subtotal_cents    INTEGER NOT NULL,
    discount_cents    INTEGER NOT NULL,
    total_cents       INTEGER NOT NULL,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE order_items (
    order_id         INTEGER NOT NULL REFERENCES orders(id),
    sku              TEXT    NOT NULL,
    qty              INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    discount_cents   INTEGER NOT NULL
  );
`;

const SEED = `
  INSERT INTO stores VALUES
    ('lima-centro', 'Tienda Lima Centro'),
    ('online',      'Tienda Online');

  INSERT INTO products VALUES
    ('TV-55-4K',   'Televisor 55" 4K',          'electro'),
    ('LAP-14-I5',  'Laptop 14" Core i5',         'electro'),
    ('POLO-ALG-M', 'Polo de algodón talla M',    'moda'),
    ('ZAP-RUN-42', 'Zapatillas running talla 42', 'moda');

  INSERT INTO store_prices VALUES
    ('lima-centro', 'TV-55-4K',   189990),
    ('lima-centro', 'LAP-14-I5',  259900),
    ('lima-centro', 'POLO-ALG-M',   3990),
    ('lima-centro', 'ZAP-RUN-42',  29990),
    ('online',      'TV-55-4K',   179990),
    ('online',      'LAP-14-I5',  249900),
    ('online',      'POLO-ALG-M',   3490),
    ('online',      'ZAP-RUN-42',  27990);

  INSERT INTO inventory VALUES
    ('lima-centro', 'TV-55-4K',   3),
    ('lima-centro', 'LAP-14-I5',  5),
    ('lima-centro', 'POLO-ALG-M', 40),
    ('lima-centro', 'ZAP-RUN-42', 10),
    ('online',      'TV-55-4K',   20),
    ('online',      'LAP-14-I5',  15),
    ('online',      'POLO-ALG-M', 100),
    ('online',      'ZAP-RUN-42', 0);

  INSERT INTO users VALUES
    (1, 'Ana',   'token-ana'),
    (2, 'Bruno', 'token-bruno');

  INSERT INTO promotions (store_id, type, category, percent) VALUES
    ('online',      'CATEGORY_PERCENT', 'moda',   20),
    ('online',      'CATEGORY_PERCENT', 'moda',   10),
    ('lima-centro', 'CATEGORY_PERCENT', 'electro', 15);

  INSERT INTO promotions (store_id, type, code, amount_cents, min_purchase_cents) VALUES
    ('online', 'COUPON_FIXED', 'BIENVENIDA', 5000, 20000);
`;

export function createDb(): DB {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  db.exec(SEED);
  return db;
}
