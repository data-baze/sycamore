import { describe, expect, it } from 'vitest';
import { classifyTransaction, createClassifier } from '../server/classifier';
import type { ClassificationProvider } from '../server/classifier';

describe('classification service', () => {
  it('routes common merchant names into expected categories', () => {
    expect(classifyTransaction('Google Workspace subscription', 'debit')).toMatchObject({ category: 'Software' });
    expect(classifyTransaction('Salary - June payroll', 'credit')).toMatchObject({ category: 'Payroll' });
    expect(classifyTransaction('Meta advertising campaign', 'debit')).toMatchObject({ category: 'Marketing' });
    expect(classifyTransaction('Monthly office rent payment', 'debit')).toMatchObject({ category: 'Rent' });
    expect(classifyTransaction('Bank maintenance fee', 'debit')).toMatchObject({ category: 'Banking Fees' });
    expect(classifyTransaction('Export sales settlement', 'credit')).toMatchObject({ category: 'Revenue' });
  });

  it('allows the classification provider to be replaced without changing callers', () => {
    const provider: ClassificationProvider = {
      classify: () => ({ category: 'Transfers', confidence: 1, source: 'rule' })
    };

    expect(createClassifier(provider)('Internal settlement', 'debit')).toMatchObject({ category: 'Transfers' });
  });
});
