import type { ReviewFlagRecord, TransactionRecord } from './types';

export interface ReviewFlagEvaluation {
  kind: ReviewFlagRecord['kind'];
  severity: ReviewFlagRecord['severity'];
  reason: string;
}

export function evaluateReviewFlags(
  transaction: Pick<TransactionRecord, 'amount_minor' | 'description' | 'direction' | 'external_reference' | 'classification_confidence'>,
  priorTransactions: Array<Pick<TransactionRecord, 'external_reference' | 'amount_minor'>>
): ReviewFlagEvaluation[] {
  const flags: ReviewFlagEvaluation[] = [];

  const duplicateMatch = priorTransactions.some(
    (item) => item.external_reference === transaction.external_reference && item.amount_minor === transaction.amount_minor
  );

  if (duplicateMatch) {
    flags.push({
      kind: 'duplicate',
      severity: 'high',
      reason: `Duplicate transaction reference ${transaction.external_reference} was seen again for the same amount.`
    });
  }

  if (transaction.direction === 'debit' && transaction.amount_minor >= 50_000_000) {
    flags.push({
      kind: 'large_payment',
      severity: 'high',
      reason: `Large payment of ${transaction.amount_minor / 100} NGN exceeds the standard review threshold.`
    });
  }

  if (transaction.classification_confidence < 0.6) {
    flags.push({
      kind: 'low_confidence',
      severity: 'medium',
      reason: `Classification confidence is ${Math.round(transaction.classification_confidence * 100)}%, below the 60% review threshold.`
    });
  }

  return flags;
}
