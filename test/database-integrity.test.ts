import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sycamore-integrity-'));
const databasePath = path.join(tempDir, 'integrity.sqlite');

describe('database integrity constraints', () => {
  let db: ReturnType<(typeof import('../server/db'))['getDb']>;

  beforeAll(async () => {
    vi.stubEnv('DATABASE_PATH', databasePath);
    vi.resetModules();
    const database = await import('../server/db');
    database.initializeDatabase();
    db = database.getDb();
    db.prepare('INSERT INTO organizations (id, name) VALUES (?, ?)').run('org_a', 'Tenant A');
    db.prepare('INSERT INTO organizations (id, name) VALUES (?, ?)').run('org_b', 'Tenant B');
    db.prepare('INSERT INTO accounts (id, organization_id, name, account_type) VALUES (?, ?, ?, ?)').run('acct_a', 'org_a', 'Account A', 'business');
    db.prepare('INSERT INTO accounts (id, organization_id, name, account_type) VALUES (?, ?, ?, ?)').run('acct_b', 'org_b', 'Account B', 'business');
  });

  afterAll(() => {
    db?.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  function insertTransaction(id: string, organizationId: string, accountId: string, amountMinor: number, currency = 'NGN') {
    return db.prepare(`
      INSERT INTO transactions (
        id, organization_id, account_id, external_reference, amount_minor, direction,
        description, currency, transaction_date, category
      ) VALUES (?, ?, ?, ?, ?, 'debit', 'test', ?, '2026-11-17', 'Other')
    `).run(id, organizationId, accountId, id, amountMinor, currency);
  }

  it('enables foreign keys and rejects zero amounts or non-NGN currency', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(() => insertTransaction('zero', 'org_a', 'acct_a', 0)).toThrow();
    expect(() => insertTransaction('usd', 'org_a', 'acct_a', 100, 'USD')).toThrow();
    expect(() => insertTransaction('fractional-kobo', 'org_a', 'acct_a', 1.5)).toThrow();
  });

  it('rejects transactions whose account belongs to a different tenant', () => {
    expect(() => insertTransaction('cross-account', 'org_a', 'acct_b', 100)).toThrow();
  });
});
