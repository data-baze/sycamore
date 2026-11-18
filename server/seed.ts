import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { classifyTransaction } from './classifier';
import { moneyToMinor } from './finance';
import { evaluateReviewFlags } from './review';
import { hashPassword } from './auth';

const db = getDb();

const organizationSeed = [
  { id: 'org_alpha', name: 'Alpha Retail & Logistics' },
  { id: 'org_beta', name: 'Beta Manufacturing Co.' }
] as const;

const accountSeed = [
  { id: 'acct_cash', organization_id: 'org_alpha', name: 'Main Operating Account', account_type: 'business', currency: 'NGN' },
  { id: 'acct_sales', organization_id: 'org_alpha', name: 'Revenue Collection Account', account_type: 'revenue', currency: 'NGN' },
  { id: 'acct_ops', organization_id: 'org_beta', name: 'Operations Ledger', account_type: 'business', currency: 'NGN' },
  { id: 'acct_payroll', organization_id: 'org_beta', name: 'Payroll Settlement', account_type: 'payroll', currency: 'NGN' }
] as const;

const userSeed = [
  { id: 'user_alpha', organization_id: 'org_alpha', username: 'analyst@alpha.test', name: 'Alpha Analyst', password: 'Alpha-demo-2026' },
  { id: 'user_beta', organization_id: 'org_beta', username: 'analyst@beta.test', name: 'Beta Analyst', password: 'Beta-demo-2026' }
] as const;

function isoDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

const transactionSeed = [
  { organization_id: 'org_alpha', account_id: 'acct_cash', external_reference: 'INV-1001', amount: '2500000', direction: 'credit', description: 'Café Zain sales invoice', date: isoDate(2) },
  { organization_id: 'org_alpha', account_id: 'acct_cash', external_reference: 'BILL-1999', amount: '320000', direction: 'debit', description: 'Google Workspace subscription', date: isoDate(63) },
  { organization_id: 'org_alpha', account_id: 'acct_cash', external_reference: 'BILL-2000', amount: '320000', direction: 'debit', description: 'Google Workspace subscription', date: isoDate(33) },
  { organization_id: 'org_alpha', account_id: 'acct_cash', external_reference: 'BILL-2001', amount: '320000', direction: 'debit', description: 'Google Workspace subscription', date: isoDate(3) },
  { organization_id: 'org_alpha', account_id: 'acct_cash', external_reference: 'PAY-550', amount: '870000', direction: 'debit', description: 'June salary batch', date: isoDate(1) },
  { organization_id: 'org_alpha', account_id: 'acct_cash', external_reference: 'REV-440', amount: '4200000', direction: 'credit', description: 'Wholesale customer revenue', date: isoDate(7) },
  { organization_id: 'org_alpha', account_id: 'acct_cash', external_reference: 'TRF-998', amount: '650000', direction: 'debit', description: 'Urgent vendor transfer', date: isoDate(4) },
  { organization_id: 'org_alpha', account_id: 'acct_sales', external_reference: 'SALE-88', amount: '1345000', direction: 'credit', description: 'POS sales collection', date: isoDate(5) },
  { organization_id: 'org_alpha', account_id: 'acct_sales', external_reference: 'FEE-310', amount: '42500', direction: 'debit', description: 'Bank maintenance fee', date: isoDate(9) },
  { organization_id: 'org_alpha', account_id: 'acct_sales', external_reference: 'TAX-220', amount: '180000', direction: 'debit', description: 'VAT remittance', date: isoDate(8) },
  { organization_id: 'org_beta', account_id: 'acct_ops', external_reference: 'MFG-1100', amount: '8900000', direction: 'debit', description: 'Bulk raw material purchase', date: isoDate(6) },
  { organization_id: 'org_beta', account_id: 'acct_ops', external_reference: 'MFG-1101', amount: '8900000', direction: 'debit', description: 'Bulk raw material purchase', date: isoDate(6) },
  { organization_id: 'org_beta', account_id: 'acct_ops', external_reference: 'MFG-1200', amount: '5500000', direction: 'credit', description: 'Export sales settlement', date: isoDate(2) },
  { organization_id: 'org_beta', account_id: 'acct_payroll', external_reference: 'PAY-810', amount: '1425000', direction: 'debit', description: 'Payroll transfer', date: isoDate(12) },
  { organization_id: 'org_beta', account_id: 'acct_payroll', external_reference: 'BILL-940', amount: '185000', direction: 'debit', description: 'Internet fiber service', date: isoDate(5) },
  { organization_id: 'org_beta', account_id: 'acct_payroll', external_reference: 'FUEL-44', amount: '350000', direction: 'debit', description: 'Travel fuel reimbursement', date: isoDate(10) }
] as const;

export function seedDemoData(): void {
  const count = db.prepare('SELECT COUNT(*) AS count FROM organizations').get() as { count: number };
  if (count.count > 0) {
    seedDemoUsers();
    return;
  }

  for (const org of organizationSeed) {
    db.prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)').run(org.id, org.name, new Date().toISOString());
  }

  for (const account of accountSeed) {
    db.prepare('INSERT INTO accounts (id, organization_id, name, account_type, currency, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      account.id,
      account.organization_id,
      account.name,
      account.account_type,
      account.currency,
      new Date().toISOString()
    );
  }

  for (const item of transactionSeed) {
    const direction = item.direction === 'credit' ? 'credit' : 'debit';
    const classification = classifyTransaction(item.description, direction);
    const id = `tx_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const amountMinor = moneyToMinor(item.amount);

    db.prepare(`
      INSERT INTO transactions (
        id, organization_id, account_id, external_reference, amount_minor, direction, description,
        currency, transaction_date, category, classification_confidence, classification_source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      item.organization_id,
      item.account_id,
      item.external_reference,
      amountMinor,
      direction,
      item.description,
      'NGN',
      item.date,
      classification.category,
      classification.confidence,
      classification.source,
      createdAt
    );

    const otherMatches = db.prepare(
      'SELECT external_reference, amount_minor FROM transactions WHERE organization_id = ? AND account_id = ?'
    ).all(item.organization_id, item.account_id) as Array<{ external_reference: string; amount_minor: number }>;

    const reviewFlags = evaluateReviewFlags(
      {
        amount_minor: amountMinor,
        description: item.description,
        direction,
        external_reference: item.external_reference,
        classification_confidence: classification.confidence
      },
      otherMatches.filter((row) => row.external_reference !== item.external_reference)
    );

    for (const flag of reviewFlags) {
      db.prepare(`
        INSERT INTO review_flags (id, transaction_id, kind, severity, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`rf_${randomUUID()}`, id, flag.kind, flag.severity, flag.reason, createdAt);
    }
  }

  seedDemoUsers();
}

function seedDemoUsers(): void {
  for (const user of userSeed) {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, organization_id, username, name, password_hash)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, user.organization_id, user.username, user.name, hashPassword(user.password));
  }
}
