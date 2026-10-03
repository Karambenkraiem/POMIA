import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

const LOGGED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function activityLogger(req: Request, res: Response, next: NextFunction) {
  if (!LOGGED_METHODS.has(req.method)) return next();

  res.on('finish', () => {
    prisma.activityLog
      .create({
        data: {
          utilisateur_id: req.user?.userId ?? null,
          matricule: req.user?.matricule ?? req.body?.matricule ?? null,
          nom_complet: req.user ? `${req.user.prenom} ${req.user.nom}` : null,
          role: req.user?.role ?? null,
          methode: req.method,
          route: req.originalUrl,
          statut: res.statusCode,
          ip: req.ip,
        },
      })
      .catch(() => {});
  });

  next();
}
