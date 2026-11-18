export type Currency = 'NGN';
export type Direction = 'credit' | 'debit';

export type Category =
  | 'Revenue'
  | 'Payroll'
  | 'Software'
  | 'Marketing'
  | 'Travel'
  | 'Utilities'
  | 'Rent'
  | 'Tax'
  | 'Transfers'
  | 'Banking Fees'
  | 'Other';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Account {
  id: string;
  organization_id: string;
  name: string;
  account_type: string;
  currency: Currency;
  created_at: string;
}

export interface TransactionRecord {
  id: string;
  organization_id: string;
  account_id: string;
  external_reference: string;
  amount_minor: number;
  direction: Direction;
  description: string;
  currency: Currency;
  transaction_date: string;
  category: Category | string;
  classification_confidence: number;
  classification_source: string;
  created_at: string;
}

export interface ReviewFlagRecord {
  id: string;
  transaction_id: string;
  kind: 'duplicate' | 'large_payment' | 'low_confidence' | 'unusual_frequency';
  severity: 'low' | 'medium' | 'high';
  reason: string;
  resolved_at: string | null;
  created_at: string;
}

export interface ClassificationResult {
  category: Category;
  confidence: number;
  source: 'rule' | 'manual';
}

export interface ImportTransactionInput {
  externalReference: string;
  accountId: string;
  amount: string | number;
  direction: Direction;
  description: string;
  currency?: Currency;
  date: string;
}

export interface ReviewItem {
  id: string;
  transaction_id: string;
  external_reference: string;
  account_name: string;
  description: string;
  amount_minor: number;
  direction: Direction;
  category: string;
  confidence: number;
  kind: string;
  severity: string;
  reason: string;
  transaction_date: string;
}
