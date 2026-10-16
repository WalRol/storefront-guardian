import express, { type NextFunction, type Request, type Response } from 'express';
import { createDb, type DB } from './db';
import { catalogRouter } from './modules/catalog';
import { ordersRouter } from './modules/orders';

export function createApp(db: DB = createDb()) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(catalogRouter(db));
  app.use(ordersRouter(db));

  // Manejo centralizado de errores: nunca exponer detalles internos al cliente.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  });

  return app;
}
