import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sycamore-auth-'));
const databasePath = path.join(tempDir, 'auth.sqlite');

describe('tenant authentication', () => {
  let db: ReturnType<(typeof import('../server/db'))['getDb']>;
  let loginUser: typeof import('../server/auth')['loginUser'];
  let getSessionUser: typeof import('../server/auth')['getSessionUser'];
  let hashPassword: typeof import('../server/auth')['hashPassword'];
  let revokeSession: typeof import('../server/auth')['revokeSession'];

  beforeAll(async () => {
    vi.stubEnv('DATABASE_PATH', databasePath);
    vi.resetModules();

    const database = await import('../server/db');
    database.initializeDatabase();
    db = database.getDb();
    db.prepare('INSERT INTO organizations (id, name) VALUES (?, ?)').run('org_a', 'Tenant A');

    const auth = await import('../server/auth');
    loginUser = auth.loginUser;
    getSessionUser = auth.getSessionUser;
    hashPassword = auth.hashPassword;
    revokeSession = auth.revokeSession;
    db.prepare('INSERT INTO users (id, organization_id, username, name, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run('user_a', 'org_a', 'analyst@a.test', 'Tenant A Analyst', hashPassword('correct-password'));
  });

  afterAll(() => {
    db?.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('creates an unguessable session scoped to the authenticated user tenant', () => {
    const session = loginUser('analyst@a.test', 'correct-password');

    expect(session).toBeDefined();
    expect(getSessionUser(session!.token)).toMatchObject({
      id: 'user_a',
      username: 'analyst@a.test',
      organizationId: 'org_a'
    });
    expect(getSessionUser('forged-token')).toBeUndefined();
  });

  it('rejects invalid credentials without returning a tenant session', () => {
    expect(loginUser('analyst@a.test', 'wrong-password')).toBeUndefined();
  });

  it('invalidates a session on logout', () => {
    const session = loginUser('analyst@a.test', 'correct-password');
    expect(session).toBeDefined();
    revokeSession(session!.token);
    expect(getSessionUser(session!.token)).toBeUndefined();
  });
});
