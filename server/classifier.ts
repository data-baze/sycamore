import type { Category, ClassificationResult, Direction } from './types';

export interface ClassificationProvider {
  classify(description: string, direction: Direction): ClassificationResult;
}

export function createClassifier(provider: ClassificationProvider) {
  return (description: string, direction: Direction): ClassificationResult => provider.classify(description, direction);
}

const CATEGORY_PRIORITY: ReadonlyArray<[RegExp, Category]> = [
  [/salary|payroll|wage|allowance|bonus|emolument/i, 'Payroll'],
  [/google workspace|slack|github|notion|adobe|aws|azure|shopify|microsoft|zoom|dropbox|jira/i, 'Software'],
  [/google ads|meta|facebook|instagram|linkedin|adwords|tiktok|marketing|campaign|brand/i, 'Marketing'],
  [/flight|airline|hotel|uber|bolt|taxi|travel|booking|airbnb|airport/i, 'Travel'],
  [/bank maintenance fee|bank charge|bank fee|card fee|processing fee|ledger fee|service charge/i, 'Banking Fees'],
  [/rent|landlord|lease|apartment|premises/i, 'Rent'],
  [/electricity|nepa|water|fiber|internet|mtn|airtel|glo|vodafone|maintenance/i, 'Utilities'],
  [/tax|vat|withholding|paye|cfr|customs/i, 'Tax'],
  [/invoice|sale|receipt|customer|client|revenue|income|collection/i, 'Revenue'],
  [/transfer|settlement|internal|reconciliation|interbank/i, 'Transfers']
];

export class RulesBasedClassifier implements ClassificationProvider {
  classify(description: string, direction: Direction): ClassificationResult {
    const normalized = description.trim();
    for (const [pattern, category] of CATEGORY_PRIORITY) {
      if (pattern.test(normalized)) {
        return {
          category,
          confidence: direction === 'credit' ? 0.88 : 0.82,
          source: 'rule'
        };
      }
    }

    return {
      category: 'Other',
      confidence: 0.48,
      source: 'rule'
    };
  }
}

const defaultClassifier = createClassifier(new RulesBasedClassifier());

export function classifyTransaction(description: string, direction: Direction): ClassificationResult {
  return defaultClassifier(description, direction);
}

export const CATEGORY_OPTIONS: Category[] = [
  'Revenue',
  'Payroll',
  'Software',
  'Marketing',
  'Travel',
  'Utilities',
  'Rent',
  'Tax',
  'Transfers',
  'Banking Fees',
  'Other'
];
