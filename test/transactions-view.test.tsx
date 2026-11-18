// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TransactionsView from '../src/components/TransactionsView';
import type { TransactionRow } from '../src/types';

const row: TransactionRow = {
  id: 'txn-1',
  external_reference: 'REF-2026-0001',
  description: 'Monthly software subscription',
  category: 'Software',
  amount: '₦25,000.00',
  direction: 'debit',
  transaction_date: '2026-11-17',
  account_name: 'Operating Account'
};

const baseProps = {
  rows: [row],
  categories: ['Software', 'Travel'],
  search: '',
  category: 'all',
  direction: 'all',
  page: 1,
  pageCount: 2,
  onSearchChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onDirectionChange: vi.fn(),
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  onInspect: vi.fn()
};

describe('TransactionsView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the transaction fields and allows inspection', () => {
    render(<TransactionsView {...baseProps} />);

    const table = screen.getByRole('table');
    for (const value of [
      row.external_reference,
      row.account_name,
      row.description,
      row.category,
      'Debit',
      row.amount,
      row.transaction_date
    ]) {
      expect(within(table).getByText(value)).toBeTruthy();
    }

    fireEvent.click(screen.getByRole('button', { name: `Inspect ${row.external_reference}` }));
    expect(baseProps.onInspect).toHaveBeenCalledWith(row.id);
  });

  it('reports when no transactions match', () => {
    render(<TransactionsView {...baseProps} rows={[]} />);

    expect(screen.getByText('No transactions match the search criteria.')).toBeTruthy();
    expect(screen.queryByRole('row', { name: /REF-2026-0001/ })).toBeNull();
  });

  it('calls the search, category, and direction callbacks with selected values', () => {
    render(<TransactionsView {...baseProps} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search transactions' }), { target: { value: 'INV-10' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(screen.getByRole('option', { name: 'Travel' }));
    const direction = screen.getByRole('combobox', { name: 'Direction' });
    fireEvent.keyDown(direction, { key: 'ArrowDown' });
    fireEvent.keyDown(direction, { key: 'ArrowDown' });
    fireEvent.keyDown(direction, { key: 'Enter' });

    expect(baseProps.onSearchChange).toHaveBeenCalledWith('INV-10');
    expect(baseProps.onCategoryChange).toHaveBeenCalledWith('Travel');
    expect(baseProps.onDirectionChange).toHaveBeenCalledWith('credit');
  });

  it('provides working, correctly disabled pagination controls', () => {
    render(<TransactionsView {...baseProps} page={2} />);

    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(baseProps.onPrevious).toHaveBeenCalledTimes(1);
    expect(baseProps.onNext).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true);
  });

  it('contains long references and descriptions inside the horizontally scrollable table', () => {
    const longRow = {
      ...row,
      external_reference: `REF-${'1234567890'.repeat(8)}`,
      description: 'Transfer ' + 'extraordinary-long-merchant-description-'.repeat(12)
    };
    render(<TransactionsView {...baseProps} rows={[longRow]} />);

    const tableRegion = screen.getByRole('region', { name: 'Transaction results' });
    expect(within(tableRegion).getByRole('table')).toBeTruthy();
    expect(within(tableRegion).getByText(longRow.external_reference)).toBeTruthy();
    expect(within(tableRegion).getByText(longRow.description)).toBeTruthy();
  });
});
