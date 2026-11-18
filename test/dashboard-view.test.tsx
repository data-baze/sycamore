// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardView from '../src/components/DashboardView';
import type { DashboardData } from '../src/types';

const data: DashboardData = {
  inflow: 250000,
  outflow: 100000,
  net: 150000,
  categoryBreakdown: [{ category: 'Travel', total: 100000, label: '₦1,000.00' }],
  flaggedTransactions: [{
    id: 'flag-1',
    transaction_id: 'txn-1',
    kind: 'low_confidence',
    severity: 'medium',
    reason: 'Classification confidence is below the review threshold.',
    description: 'Flight booking',
    amount: '₦1,000.00',
    external_reference: 'REF-1'
  }]
};

const formatMoney = (value: number) => `₦${(value / 100).toFixed(2)}`;

describe('DashboardView', () => {
  afterEach(cleanup);

  it('shows cash-flow labels and actual formatted values', () => {
    render(<DashboardView data={data} formatMoney={formatMoney} onInspect={vi.fn()} />);

    expect(screen.getByText('Total inflows')).toBeTruthy();
    expect(screen.getByText('₦2500.00')).toBeTruthy();
    expect(screen.getByText('Total outflows')).toBeTruthy();
    expect(screen.getByText('₦1000.00')).toBeTruthy();
    expect(screen.getByText('Net cash flow')).toBeTruthy();
    expect(screen.getByText('₦1500.00')).toBeTruthy();
  });

  it('renders category spending with accessible progress values', () => {
    render(<DashboardView data={data} formatMoney={formatMoney} onInspect={vi.fn()} />);

    const progress = screen.getByRole('progressbar', { name: 'Travel spending' });
    expect(progress.getAttribute('aria-valuenow')).toBe('100000');
    expect(progress.getAttribute('aria-valuemax')).toBe('100000');
    expect(within(screen.getByRole('region', { name: 'Spending by category' })).getByText('₦1,000.00')).toBeTruthy();
  });

  it('ranks spending by amount and preserves each NGN value and relative bar width', () => {
    const chartData = {
      ...data,
      categoryBreakdown: [
        { category: 'Software', total: 1_000_000_000_000, label: '₦10,000,000,000.00' },
        { category: 'Travel', total: 4_000_000_000_000, label: '₦40,000,000,000.00' },
        { category: 'Banking Fees', total: 0, label: '₦0.00' }
      ]
    };
    render(<DashboardView data={chartData} formatMoney={formatMoney} onInspect={vi.fn()} />);

    const chart = within(screen.getByRole('region', { name: 'Spending by category' }));
    const rows = chart.getAllByRole('listitem');
    expect(rows.map((item) => item.querySelector('span')?.textContent)).toEqual([
      'Travel',
      'Software',
      'Banking Fees'
    ]);
    expect(chart.getByText('₦40,000,000,000.00')).toBeTruthy();
    expect(chart.getByText('₦10,000,000,000.00')).toBeTruthy();
    expect(chart.getByText('₦0.00')).toBeTruthy();
    expect(chart.getByRole('progressbar', { name: 'Software spending' }).getAttribute('aria-valuenow')).toBe('1000000000000');
    expect(chart.getByRole('progressbar', { name: 'Software spending' }).getAttribute('aria-valuemax')).toBe('4000000000000');
    expect(chart.getByRole('progressbar', { name: 'Software spending' }).getAttribute('style')).toContain('width: 25%');
    expect(chart.getByRole('progressbar', { name: 'Banking Fees spending' }).getAttribute('style')).toContain('width: 0%');
  });

  it('renders a zero-total category with a valid empty bar', () => {
    const chartData = {
      ...data,
      categoryBreakdown: [{ category: 'Other', total: 0, label: '₦0.00' }]
    };
    render(<DashboardView data={chartData} formatMoney={formatMoney} onInspect={vi.fn()} />);

    const progress = screen.getByRole('progressbar', { name: 'Other spending' });
    expect(progress.getAttribute('aria-valuenow')).toBe('0');
    expect(progress.getAttribute('aria-valuemax')).toBe('1');
    expect(progress.getAttribute('style')).toContain('width: 0%');
    expect(screen.getByText('₦0.00')).toBeTruthy();
  });

  it('shows an empty state when category data is unavailable', () => {
    render(<DashboardView data={{ ...data, categoryBreakdown: [] }} formatMoney={formatMoney} onInspect={vi.fn()} />);

    expect(screen.getByText('No category data available.')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('inspects the transaction linked to a flagged row', () => {
    const onInspect = vi.fn();
    render(<DashboardView data={data} formatMoney={formatMoney} onInspect={onInspect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Inspect REF-1' }));

    expect(onInspect).toHaveBeenCalledWith('txn-1');
  });
});
