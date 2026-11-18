import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sycamore-service-'));
const databasePath = path.join(tempDir, 'service.sqlite');

let db: ReturnType<(typeof import('../server/db'))['getDb']>;
let importTransactions: typeof import('../server/service')['importTransactions'];
let updateTransactionCategory: typeof import('../server/service')['updateTransactionCategory'];
let getTransactionDetails: typeof import('../server/service')['getTransactionDetails'];
let getTransactions: typeof import('../server/service')['getTransactions'];
let getReview: typeof import('../server/service')['getReview'];
let getDashboard: typeof import('../server/service')['getDashboard'];

describe('transaction service', () => {
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

    const service = await import('../server/service');
    importTransactions = service.importTransactions;
    updateTransactionCategory = service.updateTransactionCategory;
    getTransactionDetails = service.getTransactionDetails;
    getTransactions = service.getTransactions;
    getReview = service.getReview;
    getDashboard = service.getDashboard;
  });

  afterAll(() => {
    db?.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('keeps valid batch rows while reporting invalid rows individually', () => {
    const result = importTransactions('org_a', {
      transactions: [
        { externalReference: 'valid-1', accountId: 'acct_a', amount: '12999.75', direction: 'debit', description: 'Office purchase', date: '2026-11-17' },
        { externalReference: 'bad-amount', accountId: 'acct_a', amount: 'not-money', direction: 'debit', description: 'Bad amount', date: '2026-11-17' },
        { externalReference: 'bad-direction', accountId: 'acct_a', amount: '50', direction: 'sideways' as never, description: 'Bad direction', date: '2026-11-17' },
        { externalReference: 'bad-date', accountId: 'acct_a', amount: '50', direction: 'credit', description: 'Bad date', date: 'not-a-date' },
        { externalReference: 'impossible-date', accountId: 'acct_a', amount: '50', direction: 'credit', description: 'Impossible date', date: '2026-02-31' },
        { externalReference: 'wrong-tenant-account', accountId: 'acct_b', amount: '50', direction: 'credit', description: 'Wrong account', date: '2026-11-17' },
        { externalReference: 'wrong-currency', accountId: 'acct_a', amount: '50', direction: 'credit', description: 'Wrong currency', date: '2026-11-17', currency: 'USD' as 'NGN' },
        { externalReference: 'zero-amount', accountId: 'acct_a', amount: '0', direction: 'credit', description: 'Zero amount', date: '2026-11-17' }
      ]
    });

    expect(result).toMatchObject({ inserted: 1, duplicates: 0, failed: 7 });
    expect(db.prepare('SELECT amount_minor FROM transactions WHERE external_reference = ?').get('valid-1')).toEqual({ amount_minor: 1299975 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM transactions').get()).toEqual({ count: 1 });
  });

  it('treats a repeated import as idempotent', () => {
    const transaction = {
      externalReference: 'repeat-1',
      accountId: 'acct_a',
      amount: '120',
      direction: 'credit' as const,
      description: 'Customer receipt',
      date: '2026-11-17'
    };

    expect(importTransactions('org_a', { transactions: [transaction] })).toMatchObject({ inserted: 1, duplicates: 0 });
    expect(importTransactions('org_a', { transactions: [transaction] })).toMatchObject({ inserted: 0, duplicates: 1 });
  });

  it('retrieves transaction details only for the owning organization', () => {
    importTransactions('org_a', {
      transactions: [{
        externalReference: 'detail-1',
        accountId: 'acct_a',
        amount: '299.50',
        direction: 'debit',
        description: 'Vendor service',
        date: '2026-11-17'
      }]
    });

    const transaction = db.prepare('SELECT id FROM transactions WHERE external_reference = ?').get('detail-1') as { id: string };
    expect(getTransactionDetails('org_a', transaction.id)).toMatchObject({
      external_reference: 'detail-1',
      amount: '₦299.50',
      account_name: 'Account A'
    });
    expect(() => getTransactionDetails('org_b', transaction.id)).toThrow('Transaction not found');
  });

  it('bounds invalid and oversized pagination parameters', () => {
    const result = getTransactions('org_a', { page: Number.NaN, limit: 1000 });
    expect(result).toMatchObject({ page: 1, limit: 100, total: 3 });
  });

  it('rejects invalid categories and prevents cross-tenant corrections', () => {
    const imported = importTransactions('org_a', {
      transactions: [{
        externalReference: 'correction-1',
        accountId: 'acct_a',
        amount: '100',
        direction: 'debit',
        description: 'Unknown purchase',
        date: '2026-11-17'
      }]
    });
    expect(imported.inserted).toBe(1);

    const transaction = db.prepare('SELECT id, category FROM transactions WHERE external_reference = ?').get('correction-1') as { id: string; category: string };
    expect(getReview('org_a').some((row) => row.transaction_id === transaction.id && row.kind === 'low_confidence')).toBe(true);
    expect(() => updateTransactionCategory('org_a', transaction.id, 'Made Up', 'Analyst', 'Fix')).toThrow('Invalid category');
    expect(() => updateTransactionCategory('org_b', transaction.id, 'Software', 'Analyst', 'Fix')).toThrow('Transaction not found');
    expect(db.prepare('SELECT category FROM transactions WHERE id = ?').get(transaction.id)).toEqual({ category: transaction.category });

    updateTransactionCategory('org_a', transaction.id, 'Software', 'Analyst', 'Verified vendor');
    expect(db.prepare('SELECT previous_category, previous_confidence, previous_source, new_category, actor, note FROM classification_history WHERE transaction_id = ?').get(transaction.id)).toEqual({
      previous_category: 'Other',
      previous_confidence: 0.48,
      previous_source: 'rule',
      new_category: 'Software',
      actor: 'Analyst',
      note: 'Verified vendor'
    });
    expect(getReview('org_a').some((row) => row.transaction_id === transaction.id && row.kind === 'low_confidence')).toBe(false);
    expect(getDashboard('org_a').flaggedTransactions.some((row) => row.transaction_id === transaction.id)).toBe(false);
    expect(getTransactionDetails('org_a', transaction.id).reviewFlags).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'low_confidence', resolved_at: expect.any(String) })])
    );
  });
});
