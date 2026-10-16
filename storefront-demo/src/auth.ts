import type { NextFunction, Request, Response } from 'express';
import type { DB } from './db';

export interface AuthUser {
  id: number;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Autenticación simplificada por token Bearer (suficiente para la demo). */
export function requireAuth(db: DB) {
  const findUser = db.prepare('SELECT id, name FROM users WHERE token = ?');
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const user = token ? (findUser.get(token) as AuthUser | undefined) : undefined;
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    req.user = user;
    next();
  };
}
