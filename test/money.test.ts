import { describe, expect, it } from 'vitest';
import { minorToMoney, moneyToMinor } from '../server/finance';

describe('money handling', () => {
  it('stores NGN values in minor units without floating-point drift', () => {
    expect(moneyToMinor('12999.75')).toBe(1299975);
    expect(moneyToMinor(12999.75)).toBe(1299975);
    expect(minorToMoney(1299975)).toBe('₦12,999.75');
  });

  it('rejects amounts that cannot be represented exactly in kobo', () => {
    expect(() => moneyToMinor('1.234')).toThrow('Invalid monetary value');
    expect(() => moneyToMinor('-1.00')).toThrow('Invalid monetary value');
    expect(moneyToMinor('0.10')).toBe(10);
  });

  it('formats integer minor units without converting the amount to a decimal float', () => {
    expect(minorToMoney(1)).toBe('₦0.01');
    expect(minorToMoney(-1)).toBe('-₦0.01');
    expect(minorToMoney(9007199254740991)).toBe('₦90,071,992,547,409.91');
    expect(() => minorToMoney(1.5)).toThrow('Invalid minor-unit amount');
  });
});
