import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sycamore-api-'));
const databasePath = path.join(tempDir, 'api.sqlite');

describe('authenticated API', () => {
  let baseUrl: string;
  let server: Server;
  let closeDatabase: () => void;

  beforeAll(async () => {
    vi.stubEnv('DATABASE_PATH', databasePath);
    vi.resetModules();

    const database = await import('../server/db');
    closeDatabase = () => database.getDb().close();
    const { createApp } = await import('../server/index');
    server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    closeDatabase?.();
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  async function login(username: string, password: string): Promise<string> {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    return result.token as string;
  }

  it('requires authentication and ignores caller-supplied tenant identifiers', async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/transactions`, {
      headers: { 'x-organization-id': 'org_alpha' }
    });
    expect(unauthenticated.status).toBe(401);

    const alphaToken = await login('analyst@alpha.test', 'Alpha-demo-2026');
    const alphaResponse = await fetch(`${baseUrl}/api/transactions?limit=100`, {
      headers: { Authorization: `Bearer ${alphaToken}`, 'x-organization-id': 'org_beta' }
    });
    const alphaData = await alphaResponse.json();
    expect(alphaData.items.length).toBeGreaterThan(0);
    expect(alphaData.items.every((item: { external_reference: string }) => !item.external_reference.startsWith('MFG-'))).toBe(true);

    const betaToken = await login('analyst@beta.test', 'Beta-demo-2026');
    const betaResponse = await fetch(`${baseUrl}/api/transactions?limit=100`, {
      headers: { Authorization: `Bearer ${betaToken}`, 'x-organization-id': 'org_alpha' }
    });
    const betaData = await betaResponse.json();
    expect(betaData.items.some((item: { external_reference: string }) => item.external_reference.startsWith('MFG-'))).toBe(true);
    expect(betaData.items.every((item: { external_reference: string }) => !item.external_reference.startsWith('INV-'))).toBe(true);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${alphaToken}` }
    });
    expect(logout.status).toBe(204);
    const afterLogout = await fetch(`${baseUrl}/api/transactions`, {
      headers: { Authorization: `Bearer ${alphaToken}` }
    });
    expect(afterLogout.status).toBe(401);
  });

  it('uses the authenticated user as the category correction actor', async () => {
    const token = await login('analyst@alpha.test', 'Alpha-demo-2026');
    const rowsResponse = await fetch(`${baseUrl}/api/transactions?search=INV-1001`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const rows = await rowsResponse.json();
    const transactionId = rows.items[0].id as string;

    const correction = await fetch(`${baseUrl}/api/transactions/${transactionId}/category`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'Software', actor: 'Mallory', note: 'Verified vendor' })
    });
    expect(correction.status).toBe(200);
    expect(await correction.json()).toMatchObject({ actor: 'analyst@alpha.test' });

    const betaToken = await login('analyst@beta.test', 'Beta-demo-2026');
    const crossTenantCorrection = await fetch(`${baseUrl}/api/transactions/${transactionId}/category`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${betaToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'Other' })
    });
    expect(crossTenantCorrection.status).toBe(404);
  });
});
