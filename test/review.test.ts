import { describe, expect, it } from 'vitest';
import { evaluateReviewFlags } from '../server/review';

describe('review evaluation', () => {
  it('flags duplicates and large debits with understandable reasons', () => {
    const flags = evaluateReviewFlags(
      {
        amount_minor: 95_000_000,
        description: 'Urgent transfer to vendor',
        direction: 'debit',
        external_reference: 'INV-1001',
        classification_confidence: 0.48
      },
      [{ external_reference: 'INV-1001', amount_minor: 95_000_000 }]
    );

    expect(flags.some((flag) => flag.kind === 'duplicate')).toBe(true);
    expect(flags.some((flag) => flag.kind === 'large_payment')).toBe(true);
  });

  it('flags classifications below the confidence threshold', () => {
    const flags = evaluateReviewFlags(
      {
        amount_minor: 5_000,
        description: 'Unrecognized vendor',
        direction: 'debit',
        external_reference: 'MISC-100',
        classification_confidence: 0.48
      },
      []
    );

    expect(flags).toContainEqual(expect.objectContaining({
      kind: 'low_confidence',
      reason: expect.stringContaining('confidence')
    }));
  });
});
