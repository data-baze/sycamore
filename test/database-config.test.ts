import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sycamore-db-config-'));
const databasePath = path.join(tempDir, 'isolated.sqlite');
let database: { name: string; close: () => void };

describe('database configuration', () => {
  beforeAll(async () => {
    vi.stubEnv('DATABASE_PATH', databasePath);
    vi.resetModules();
    const module = await import('../server/db');
    database = module.getDb();
  });

  afterAll(() => {
    database?.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('uses DATABASE_PATH so tests and deployments can isolate persistence', () => {
    expect(database.name).toBe(databasePath);
  });
});
