export interface AuthSession {
  token: string;
  user: {
    id: string;
    username: string;
    name: string;
    organizationId: string;
    organizationName: string;
  };
}

export interface DashboardData {
  inflow: number;
  outflow: number;
  net: number;
  categoryBreakdown: Array<{ category: string; total: number; label: string }>;
  flaggedTransactions: Array<{
    id: string;
    transaction_id: string;
    kind: string;
    severity: string;
    reason: string;
    description: string;
    amount: string;
    external_reference: string;
  }>;
}

export interface TransactionRow {
  id: string;
  external_reference: string;
  description: string;
  category: string;
  amount: string;
  direction: 'credit' | 'debit';
  transaction_date: string;
  account_name: string;
}

export interface ReviewRow {
  id: string;
  transaction_id: string;
  external_reference: string;
  account_name: string;
  description: string;
  amount_minor: number;
  direction: 'credit' | 'debit';
  category: string;
  confidence: number;
  kind: string;
  severity: string;
  reason: string;
  transaction_date: string;
}

export interface TransactionDetails {
  id: string;
  organization_id: string;
  account_id: string;
  external_reference: string;
  amount_minor: number;
  amount: string;
  direction: 'credit' | 'debit';
  description: string;
  currency: string;
  transaction_date: string;
  category: string;
  classification_confidence: number;
  classification_source: string;
  created_at: string;
  account_name: string;
  reviewFlags: Array<{
    kind: string;
    severity: string;
    reason: string;
    resolved_at: string | null;
    created_at: string;
  }>;
  classificationHistory: Array<{
    previous_category: string | null;
    new_category: string;
    confidence: number;
    source: string;
    actor: string;
    note: string | null;
    created_at: string;
  }>;
}
