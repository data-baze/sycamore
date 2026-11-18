import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { getSessionUser, loginUser, revokeSession, type AuthenticatedUser } from './auth';
import { initializeDatabase } from './db';
import { seedDemoData } from './seed';
import {
  getDashboard,
  getOrganizations,
  getReview,
  getTransactionDetails,
  getTransactions,
  importTransactions,
  updateTransactionCategory,
  ensureOrganization
} from './service';

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: AuthenticatedUser;
      authenticatedToken?: string;
    }
  }
}

initializeDatabase();
seedDemoData();

function organizationId(req: express.Request): string {
  return req.authenticatedUser?.organizationId ?? '';
}

function sendError(res: express.Response, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

  if (code.startsWith('SQLITE_BUSY')) {
    res.set('Retry-After', '1').status(503).json({ error: 'Database is busy; retry this idempotent request.' });
    return;
  }

  if (code.startsWith('SQLITE_')) {
    console.error(error);
    res.status(500).json({ error: 'Database request failed.' });
    return;
  }

  res.status(message.startsWith('Transaction not found') ? 404 : 400).json({ error: message });
}

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'sycamore-transaction-intelligence' });
  });

  app.post('/api/auth/login', (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const session = loginUser(username, password);
    if (!session) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const organization = getOrganizations().find((item) => item.id === session.user.organizationId);
    res.json({
      token: session.token,
      user: { ...session.user, organizationName: organization?.name ?? '' }
    });
  });

  app.use('/api', (req, res, next) => {
    const authorization = req.get('authorization') ?? '';
    const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
    const user = match ? getSessionUser(match[1]) : undefined;
    if (!user) {
      res.status(401).json({ error: 'A valid bearer token is required.' });
      return;
    }

    req.authenticatedUser = user;
    req.authenticatedToken = match?.[1];
    next();
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.authenticatedToken) {
      revokeSession(req.authenticatedToken);
    }
    res.status(204).end();
  });

  app.get('/api/organizations', (req, res) => {
    res.json(getOrganizations().filter((item) => item.id === organizationId(req)));
  });

  app.get('/api/dashboard', (req, res) => {
    try {
      res.json(getDashboard(ensureOrganization(organizationId(req))));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/transactions', (req, res) => {
    try {
      res.json(
        getTransactions(ensureOrganization(organizationId(req)), {
          search: String(req.query.search ?? ''),
          category: String(req.query.category ?? 'all'),
          direction: String(req.query.direction ?? 'all'),
          page: Number(req.query.page ?? 1),
          limit: Number(req.query.limit ?? 10)
        })
      );
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/transactions/:id', (req, res) => {
    try {
      res.json(getTransactionDetails(ensureOrganization(organizationId(req)), req.params.id));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/transactions/import', (req, res) => {
    try {
      const report = importTransactions(ensureOrganization(organizationId(req)), req.body);
      res.status(200).json(report);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/review', (req, res) => {
    try {
      res.json(getReview(ensureOrganization(organizationId(req))));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.patch('/api/transactions/:id/category', (req, res) => {
    try {
      const { category, note } = req.body ?? {};
      if (typeof category !== 'string' || (note !== undefined && typeof note !== 'string')) {
        res.status(400).json({ error: 'A valid category and optional text note are required.' });
        return;
      }

      const actor = req.authenticatedUser?.username;
      if (!actor) {
        res.status(401).json({ error: 'A valid bearer token is required.' });
        return;
      }

      res.json(updateTransactionCategory(
        ensureOrganization(organizationId(req)),
        req.params.id,
        category,
        actor,
        note ?? 'Manual review correction'
      ));
    } catch (error) {
      sendError(res, error);
    }
  });

  return app;
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntrypoint) {
  const port = Number(process.env.PORT ?? 3010);
  createApp().listen(port, () => {
    console.log(`Sycamore API listening on http://localhost:${port}`);
  });
}
