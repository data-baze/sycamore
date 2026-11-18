import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'sycamore.db');

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export function getDb(): Database.Database {
  return db;
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NGN' CHECK(currency = 'NGN'),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      external_reference TEXT NOT NULL,
      amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor) = 'integer' AND amount_minor > 0),
      direction TEXT NOT NULL CHECK(direction IN ('credit', 'debit')),
      description TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NGN' CHECK(currency = 'NGN'),
      transaction_date TEXT NOT NULL,
      category TEXT NOT NULL,
      classification_confidence REAL NOT NULL DEFAULT 0,
      classification_source TEXT NOT NULL DEFAULT 'rule',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, account_id, external_reference),
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (account_id, organization_id) REFERENCES accounts(id, organization_id)
    );

    CREATE TABLE IF NOT EXISTS classification_history (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      previous_category TEXT,
      previous_confidence REAL,
      previous_source TEXT,
      new_category TEXT NOT NULL,
      confidence REAL NOT NULL,
      source TEXT NOT NULL,
      actor TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS review_flags (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      severity TEXT NOT NULL,
      reason TEXT NOT NULL,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_id_org ON accounts(id, organization_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_org_date ON transactions(organization_id, transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_org_ref ON transactions(organization_id, external_reference);
    CREATE INDEX IF NOT EXISTS idx_review_flags_txn ON review_flags(transaction_id);

    CREATE TRIGGER IF NOT EXISTS validate_transaction_insert
    BEFORE INSERT ON transactions
    WHEN typeof(NEW.amount_minor) <> 'integer' OR NEW.amount_minor <= 0 OR NEW.currency <> 'NGN'
      OR NOT EXISTS (SELECT 1 FROM accounts WHERE id = NEW.account_id AND organization_id = NEW.organization_id)
    BEGIN
      SELECT RAISE(ABORT, 'invalid transaction integrity');
    END;

    CREATE TRIGGER IF NOT EXISTS validate_transaction_update
    BEFORE UPDATE ON transactions
    WHEN typeof(NEW.amount_minor) <> 'integer' OR NEW.amount_minor <= 0 OR NEW.currency <> 'NGN'
      OR NOT EXISTS (SELECT 1 FROM accounts WHERE id = NEW.account_id AND organization_id = NEW.organization_id)
    BEGIN
      SELECT RAISE(ABORT, 'invalid transaction integrity');
    END;
  `);

  const historyColumns = db.pragma('table_info(classification_history)') as Array<{ name: string }>;
  if (!historyColumns.some((column) => column.name === 'previous_confidence')) {
    db.exec('ALTER TABLE classification_history ADD COLUMN previous_confidence REAL');
  }
  if (!historyColumns.some((column) => column.name === 'previous_source')) {
    db.exec('ALTER TABLE classification_history ADD COLUMN previous_source TEXT');
  }

  const reviewColumns = db.pragma('table_info(review_flags)') as Array<{ name: string }>;
  if (!reviewColumns.some((column) => column.name === 'resolved_at')) {
    db.exec('ALTER TABLE review_flags ADD COLUMN resolved_at TEXT');
  }
}
