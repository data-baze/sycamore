import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { minorToMoney, moneyToMinor } from './finance';
import { CATEGORY_OPTIONS, classifyTransaction } from './classifier';
import { evaluateReviewFlags } from './review';
import type { ImportTransactionInput, Organization, ReviewItem, TransactionRecord } from './types';

const db = getDb();

function normalizeTransactionDate(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : undefined;
}

export function getOrganizations(): Organization[] {
  return db.prepare('SELECT * FROM organizations ORDER BY name ASC').all() as Organization[];
}

export function ensureOrganization(orgId: string | undefined): string {
  if (!orgId || orgId.trim().length === 0) {
    throw new Error('Missing or invalid organization identifier');
  }

  const row = db.prepare('SELECT id FROM organizations WHERE id = ?').get(orgId) as { id: string } | undefined;
  if (!row) {
    throw new Error(`Organization not found: ${orgId}`);
  }

  return orgId;
}

export function getDashboard(orgId: string) {
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_minor ELSE 0 END), 0) AS inflow,
      COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_minor ELSE 0 END), 0) AS outflow,
      COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_minor ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_minor ELSE 0 END), 0) AS net
    FROM transactions
    WHERE organization_id = ?
  `).get(orgId) as { inflow: number; outflow: number; net: number };

  const categories = db.prepare(`
    SELECT category, SUM(amount_minor) AS total
    FROM transactions
    WHERE organization_id = ? AND direction = 'debit'
    GROUP BY category
    ORDER BY total DESC
  `).all(orgId) as Array<{ category: string; total: number }>;

  const flagged = db.prepare(`
    SELECT rf.id, rf.kind, rf.severity, rf.reason, t.id AS transaction_id, t.external_reference, a.name AS account_name,
           t.description, t.amount_minor, t.direction, t.category, t.classification_confidence AS confidence,
           t.transaction_date
    FROM review_flags rf
    JOIN transactions t ON t.id = rf.transaction_id
    JOIN accounts a ON a.id = t.account_id
    WHERE t.organization_id = ? AND rf.resolved_at IS NULL
    ORDER BY rf.created_at DESC
    LIMIT 6
  `).all(orgId) as ReviewItem[];

  return {
    inflow: totals.inflow,
    outflow: totals.outflow,
    net: totals.net,
    categoryBreakdown: categories.map((row) => ({
      category: row.category,
      total: row.total,
      label: minorToMoney(row.total)
    })),
    flaggedTransactions: flagged.map((row) => ({
      ...row,
      amount: minorToMoney(row.amount_minor)
    }))
  };
}

export function getTransactions(orgId: string, options: { search?: string; category?: string; direction?: string; page?: number; limit?: number }) {
  const search = (options.search ?? '').trim();
  const category = options.category ?? 'all';
  const direction = options.direction ?? 'all';
  const requestedLimit = Number(options.limit ?? 10);
  const limit = Number.isSafeInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 10;
  const requestedPage = Number(options.page ?? 1);
  const maxPage = Math.floor(Number.MAX_SAFE_INTEGER / limit);
  const page = Number.isSafeInteger(requestedPage) ? Math.min(maxPage, Math.max(1, requestedPage)) : 1;
  const offset = (page - 1) * limit;

  const clauses: string[] = ['t.organization_id = ?'];
  const params: unknown[] = [orgId];

  if (search) {
    clauses.push('(t.description LIKE ? OR t.external_reference LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category && category !== 'all') {
    clauses.push('t.category = ?');
    params.push(category);
  }

  if (direction && direction !== 'all') {
    clauses.push('t.direction = ?');
    params.push(direction);
  }

  const whereClause = clauses.join(' AND ');
  const rows = db.prepare(`
    SELECT t.*, a.name AS account_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE ${whereClause}
    ORDER BY t.transaction_date DESC, t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Array<TransactionRecord & { account_name: string }>;

  const total = db.prepare(`
    SELECT COUNT(*) AS count
    FROM transactions t
    WHERE ${whereClause}
  `).get(...params) as { count: number };

  return {
    page,
    limit,
    total: total.count,
    items: rows.map((row) => ({
      ...row,
      amount: minorToMoney(row.amount_minor),
      displayAmount: minorToMoney(row.amount_minor)
    }))
  };
}

export function getTransactionDetails(orgId: string, transactionId: string) {
  ensureOrganization(orgId);

  const transaction = db.prepare(`
    SELECT t.*, a.name AS account_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE t.organization_id = ? AND t.id = ?
  `).get(orgId, transactionId) as (TransactionRecord & { account_name: string }) | undefined;

  if (!transaction) {
    throw new Error('Transaction not found for this organization.');
  }

  const reviewFlags = db.prepare(`
    SELECT kind, severity, reason, resolved_at, created_at
    FROM review_flags
    WHERE transaction_id = ?
    ORDER BY created_at DESC
  `).all(transactionId);

  const classificationHistory = db.prepare(`
    SELECT previous_category, new_category, confidence, source, actor, note, created_at
    FROM classification_history
    WHERE transaction_id = ?
    ORDER BY created_at ASC
  `).all(transactionId);

  return {
    ...transaction,
    amount: minorToMoney(transaction.amount_minor),
    reviewFlags,
    classificationHistory
  };
}

export function importTransactions(orgId: string, payload: { transactions: ImportTransactionInput[] }) {
  ensureOrganization(orgId);

  if (!Array.isArray(payload?.transactions)) {
    throw new Error('Transactions must be an array.');
  }

  const report = { inserted: 0, duplicates: 0, failed: 0, errors: [] as string[] };

  const txn = db.transaction((items: ImportTransactionInput[]) => {
    for (const [index, item] of items.entries()) {
      if (!item || typeof item !== 'object') {
        report.failed += 1;
        report.errors.push(`Transaction ${index + 1}: record must be an object.`);
        continue;
      }

      const externalReference = typeof item.externalReference === 'string' ? item.externalReference.trim() : '';
      const accountId = typeof item.accountId === 'string' ? item.accountId.trim() : '';
      const description = typeof item.description === 'string' ? item.description.trim() : '';
      if (!externalReference || !accountId || !description || item.amount === undefined || item.amount === null || item.date === undefined) {
        report.failed += 1;
        report.errors.push(`Transaction ${index + 1}: external reference, account, amount, description, and date are required.`);
        continue;
      }

      if (item.direction !== 'credit' && item.direction !== 'debit') {
        report.failed += 1;
        report.errors.push(`Transaction ${index + 1}: direction must be credit or debit.`);
        continue;
      }

      if (item.currency !== undefined && item.currency !== 'NGN') {
        report.failed += 1;
        report.errors.push(`Transaction ${index + 1}: only NGN currency is supported.`);
        continue;
      }

      const normalizedDate = normalizeTransactionDate(item.date);
      if (!normalizedDate) {
        report.failed += 1;
        report.errors.push(`Transaction ${index + 1}: date must be a valid ISO date.`);
        continue;
      }

      const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND organization_id = ?').get(accountId, orgId) as { id: string } | undefined;
      if (!account) {
        report.failed += 1;
        report.errors.push(`Transaction ${index + 1}: account is not available for this organization.`);
        continue;
      }

      let amountMinor: number;
      try {
        amountMinor = moneyToMinor(item.amount);
      } catch {
        report.failed += 1;
        report.errors.push(`Transaction ${index + 1}: amount must be a non-negative value with no more than two decimal places.`);
        continue;
      }

      if (amountMinor <= 0) {
        report.failed += 1;
        report.errors.push(`Transaction ${index + 1}: amount must be greater than zero.`);
        continue;
      }

      const direction = item.direction;
      const classification = classifyTransaction(description, direction);
      const transactionId = `tx_${randomUUID()}`;
      const createdAt = new Date().toISOString();

      const result = db.prepare(`
        INSERT INTO transactions (
          id, organization_id, account_id, external_reference, amount_minor, direction, description,
          currency, transaction_date, category, classification_confidence, classification_source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (organization_id, account_id, external_reference) DO NOTHING
      `).run(
        transactionId,
        orgId,
        accountId,
        externalReference,
        amountMinor,
        direction,
        description,
        'NGN',
        normalizedDate,
        classification.category,
        classification.confidence,
        classification.source,
        createdAt
      );

      if (result.changes === 0) {
        report.duplicates += 1;
        continue;
      }

      const priorMatches = db.prepare(
        'SELECT external_reference, amount_minor FROM transactions WHERE organization_id = ? AND account_id = ?'
      ).all(orgId, accountId) as Array<{ external_reference: string; amount_minor: number }>;

      const reviewFlags = evaluateReviewFlags(
        {
          amount_minor: amountMinor,
          description,
          direction,
          external_reference: externalReference,
          classification_confidence: classification.confidence
        },
        priorMatches.filter((row) => row.external_reference !== externalReference)
      );

      for (const reviewFlag of reviewFlags) {
        db.prepare(`
          INSERT INTO review_flags (id, transaction_id, kind, severity, reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(`rf_${randomUUID()}`, transactionId, reviewFlag.kind, reviewFlag.severity, reviewFlag.reason, createdAt);
      }

      report.inserted += 1;
    }
  });

  txn(payload.transactions);
  return report;
}

export function getReview(orgId: string) {
  ensureOrganization(orgId);

  return db.prepare(`
    SELECT rf.id, t.id AS transaction_id, t.external_reference, a.name AS account_name,
           t.description, t.amount_minor, t.direction, t.category, t.classification_confidence AS confidence,
           rf.kind, rf.severity, rf.reason, t.transaction_date
    FROM review_flags rf
    JOIN transactions t ON t.id = rf.transaction_id
    JOIN accounts a ON a.id = t.account_id
    WHERE t.organization_id = ? AND rf.resolved_at IS NULL
    ORDER BY rf.created_at DESC
  `).all(orgId) as ReviewItem[];
}

export function updateTransactionCategory(orgId: string, transactionId: string, category: string, actor: string, note: string) {
  ensureOrganization(orgId);

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND organization_id = ?').get(transactionId, orgId) as TransactionRecord | undefined;
  if (!transaction) {
    throw new Error('Transaction not found for this organization.');
  }

  const previousCategory = transaction.category;
  const nextCategory = CATEGORY_OPTIONS.find((option) => option === category);
  if (!nextCategory) {
    throw new Error('Invalid category.');
  }
  if (!actor.trim()) {
    throw new Error('Correction actor is required.');
  }

  const saveCorrection = db.transaction(() => {
    db.prepare(`
      UPDATE transactions
      SET category = ?, classification_confidence = 0.95, classification_source = 'manual'
      WHERE id = ? AND organization_id = ?
    `).run(nextCategory, transactionId, orgId);

    db.prepare(`
      INSERT INTO classification_history (
        id, transaction_id, previous_category, previous_confidence, previous_source,
        new_category, confidence, source, actor, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `hist_${randomUUID()}`,
      transactionId,
      previousCategory,
      transaction.classification_confidence,
      transaction.classification_source,
      nextCategory,
      0.95,
      'manual',
      actor,
      note,
      new Date().toISOString()
    );

    db.prepare(`
      UPDATE review_flags SET resolved_at = ?
      WHERE transaction_id = ? AND kind = 'low_confidence' AND resolved_at IS NULL
    `).run(new Date().toISOString(), transactionId);
  });
  saveCorrection();

  return {
    id: transactionId,
    previousCategory,
    category: nextCategory,
    actor,
    note
  };
}
