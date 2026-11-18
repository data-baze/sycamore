// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Select from '../src/components/Select';
import TransactionsView from '../src/components/TransactionsView';
import type { TransactionRow } from '../src/types';

const row: TransactionRow = {
  id: 'txn-1',
  external_reference: 'REF-1',
  description: 'Office purchase',
  category: 'Software',
  amount: '₦1,000.00',
  direction: 'debit',
  transaction_date: '2026-11-17',
  account_name: 'Operating'
};

describe('transaction category dropdown', () => {
  afterEach(cleanup);

  it('searches categories and returns the selected value', () => {
    const onCategoryChange = vi.fn();
    render(
      <TransactionsView
        rows={[row]}
        categories={['Software', 'Travel', 'Banking Fees']}
        search=""
        category="all"
        direction="all"
        page={1}
        pageCount={1}
        onSearchChange={vi.fn()}
        onCategoryChange={onCategoryChange}
        onDirectionChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onInspect={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    const search = screen.getByRole('searchbox', { name: 'Search Category options' });
    fireEvent.change(search, { target: { value: 'not a category' } });
    expect(screen.getByText('No options found.')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Category' }).textContent).toContain('All categories');

    fireEvent.change(search, { target: { value: 'travel' } });

    expect(screen.getByRole('option', { name: 'Travel' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Software' })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: 'Travel' }));

    expect(onCategoryChange).toHaveBeenCalledWith('Travel');
  });
});

describe('Select', () => {
  afterEach(cleanup);

  const options = [
    { value: 'all', label: 'All directions' },
    { value: 'credit', label: 'Credit' },
    { value: 'debit', label: 'Debit' }
  ];

  it('shows its controlled selection or placeholder', () => {
    const { rerender } = render(
      <Select label="Direction" options={options} value="" onChange={vi.fn()} placeholder="Choose a direction" />
    );
    const trigger = screen.getByRole('combobox', { name: 'Direction' });
    expect(trigger.textContent).toContain('Choose a direction');

    rerender(<Select label="Direction" options={options} value="credit" onChange={vi.fn()} />);

    expect(trigger.textContent).toContain('Credit');
  });

  it('moves the active option with keyboard and selects it with Enter', () => {
    const onChange = vi.fn();
    render(<Select label="Direction" options={options} value="all" onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Direction' });

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(trigger, { key: 'End' });
    const lastOption = screen.getByRole('option', { name: 'Debit' });
    expect(trigger.getAttribute('aria-activedescendant')).toBe(lastOption.id);
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('debit');
    expect(document.activeElement).toBe(trigger);
  });

  it('uses Space to open and select from a compact option list', () => {
    const onChange = vi.fn();
    render(<Select label="Direction" options={options} value="all" onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Direction' });

    fireEvent.keyDown(trigger, { key: ' ' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(trigger, { key: ' ' });

    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('closes on Escape and restores focus to the combobox', () => {
    render(
      <Select label="Category" options={[{ value: 'travel', label: 'Travel' }]} value="travel" onChange={vi.fn()} searchable />
    );
    const trigger = screen.getByRole('combobox', { name: 'Category' });
    fireEvent.click(trigger);
    const search = screen.getByRole('searchbox', { name: 'Search Category options' });
    expect(document.activeElement).toBe(search);

    fireEvent.keyDown(search, { key: 'Escape' });

    expect(screen.queryByRole('listbox', { name: 'Category options' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when a pointer press occurs outside the dropdown', () => {
    render(
      <Select label="Direction" options={options} value="all" onChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Direction' }));
    expect(screen.getByRole('listbox', { name: 'Direction options' })).toBeTruthy();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('listbox', { name: 'Direction options' })).toBeNull();
  });

  it('offers a clear action that returns to the supplied clear value', () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Category"
        options={[{ value: 'travel', label: 'Travel' }]}
        value="travel"
        onChange={onChange}
        clearValue="all"
      />
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Category' }));

    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('announces empty, loading, disabled, and validation states', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Select label="Category" options={[]} value="" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    expect(screen.getByText('No options available.')).toBeTruthy();

    rerender(<Select label="Category" options={options} value="all" onChange={onChange} loading />);
    expect(screen.getByRole('status').textContent).toBe('Loading options…');

    rerender(<Select label="Category" options={options} value="all" onChange={onChange} error="Choose a category." />);
    expect(screen.getByRole('alert').textContent).toBe('Choose a category.');
    expect(screen.getByRole('combobox', { name: 'Category' }).getAttribute('aria-invalid')).toBe('true');

    rerender(<Select label="Category" options={options} value="all" onChange={onChange} disabled />);
    expect(screen.getByRole('combobox', { name: 'Category' }).hasAttribute('disabled')).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps long labels selectable in a large searchable option set', () => {
    const longLabel = 'Banking Fees for international treasury settlements and service charges';
    const options = Array.from({ length: 48 }, (_, index) => ({
      value: `option-${index}`,
      label: `Category ${index}`
    }));
    options.push({ value: 'long-label', label: longLabel });
    const onChange = vi.fn();
    render(<Select label="Category" options={options} value="" onChange={onChange} searchable />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Category options' }), {
      target: { value: 'international treasury' }
    });

    fireEvent.click(screen.getByRole('option', { name: longLabel }));

    expect(onChange).toHaveBeenCalledWith('long-label');
  });
});
