import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sycamore-seed-'));
const databasePath = path.join(tempDir, 'seed.sqlite');

describe('demo seed data', () => {
  let db: ReturnType<(typeof import('../server/db'))['getDb']>;
  let seedDemoData: typeof import('../server/seed')['seedDemoData'];

  beforeAll(async () => {
    vi.stubEnv('DATABASE_PATH', databasePath);
    vi.resetModules();

    const database = await import('../server/db');
    database.initializeDatabase();
    db = database.getDb();
    ({ seedDemoData } = await import('../server/seed'));
  });

  afterAll(() => {
    db?.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('includes multiple dated instances of a recurring payment', () => {
    seedDemoData();

    const recurringPayments = db.prepare(`
      SELECT COUNT(*) AS count, COUNT(DISTINCT transaction_date) AS dates
      FROM transactions
      WHERE organization_id = ? AND account_id = ? AND description = ?
    `).get('org_alpha', 'acct_cash', 'Google Workspace subscription') as {
      count: number;
      dates: number;
    };

    expect(recurringPayments.count).toBeGreaterThanOrEqual(2);
    expect(recurringPayments.dates).toBeGreaterThanOrEqual(2);
  });
});
