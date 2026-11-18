import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getDb } from './db';

export interface AuthenticatedUser {
  id: string;
  username: string;
  name: string;
  organizationId: string;
}

interface Session {
  user: AuthenticatedUser;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const sessionLifetimeMs = 8 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function loginUser(username: string, password: string): { token: string; user: AuthenticatedUser } | undefined {
  if (!username.trim() || !password) {
    return undefined;
  }

  const row = getDb().prepare(`
    SELECT id, organization_id, username, name, password_hash
    FROM users
    WHERE username = ?
  `).get(username.trim().toLowerCase()) as {
    id: string;
    organization_id: string;
    username: string;
    name: string;
    password_hash: string;
  } | undefined;

  if (!row) {
    return undefined;
  }

  const [salt, storedHash] = row.password_hash.split(':');
  const expectedHash = Buffer.from(storedHash ?? '', 'hex');
  const suppliedHash = scryptSync(password, salt ?? '', 64);
  if (expectedHash.length !== suppliedHash.length || !timingSafeEqual(expectedHash, suppliedHash)) {
    return undefined;
  }

  const user = {
    id: row.id,
    username: row.username,
    name: row.name,
    organizationId: row.organization_id
  };
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { user, expiresAt: Date.now() + sessionLifetimeMs });
  return { token, user };
}

export function getSessionUser(token: string): AuthenticatedUser | undefined {
  const session = sessions.get(token);
  if (!session) {
    return undefined;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return undefined;
  }

  return session.user;
}

export function revokeSession(token: string): void {
  sessions.delete(token);
}
