// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

const reviewRows = [
  {
    id: 'flag-1',
    transaction_id: 'txn-1',
    external_reference: 'REF-1',
    account_name: 'Operating',
    description: 'First review transaction',
    amount_minor: 125000,
    direction: 'debit',
    category: 'Other',
    confidence: 0.48,
    kind: 'low_confidence',
    severity: 'medium',
    reason: 'Classification confidence is below the review threshold.',
    transaction_date: '2026-11-17'
  },
  {
    id: 'flag-2',
    transaction_id: 'txn-2',
    external_reference: 'REF-2',
    account_name: 'Operating',
    description: 'Second review transaction',
    amount_minor: 325000,
    direction: 'debit',
    category: 'Travel',
    confidence: 0.52,
    kind: 'low_confidence',
    severity: 'medium',
    reason: 'Classification confidence is below the review threshold.',
    transaction_date: '2026-11-16'
  }
];

const detail = {
  id: 'txn-1',
  organization_id: 'org-1',
  account_id: 'account-1',
  external_reference: 'REF-1',
  amount_minor: 125000,
  amount: '₦1,250.00',
  direction: 'debit',
  description: 'First transaction detail',
  currency: 'NGN',
  transaction_date: '2026-11-17',
  category: 'Software',
  classification_confidence: 0.95,
  classification_source: 'manual',
  account_name: 'Operating',
  reviewFlags: [{
    kind: 'low_confidence',
    severity: 'medium',
    reason: 'Classification confidence was below threshold.',
    resolved_at: null,
    created_at: '2026-11-17T10:00:00.000Z'
  }],
  classificationHistory: [{
    previous_category: 'Other',
    new_category: 'Software',
    confidence: 0.95,
    source: 'manual',
    actor: 'analyst@alpha.test',
    note: 'Verified vendor',
    created_at: '2026-11-17T10:05:00.000Z'
  }]
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function installApiMock(options: {
  details?: Record<string, unknown>;
  detailResponse?: (id: string) => Promise<Response>;
  review?: typeof reviewRows;
} = {}) {
  const detailRequests: string[] = [];
  const transactionListRequests: URL[] = [];
  const categoryCorrections: Array<{ id: string; category: string }> = [];
  let correctedCategory: string | null = null;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/auth/login') {
      return response({
        token: 'test-token',
        user: {
          id: 'user-1',
          username: 'analyst@example.test',
          name: 'Test Analyst',
          organizationId: 'org-1',
          organizationName: 'Test Organization'
        }
      });
    }
    if (url.pathname === '/api/dashboard') {
      return response({ inflow: 0, outflow: 0, net: 0, categoryBreakdown: [], flaggedTransactions: [] });
    }
    if (url.pathname === '/api/transactions') {
      transactionListRequests.push(url);
      return response({ total: 0, items: [] });
    }
    if (url.pathname === '/api/review') {
      const rows = options.review ?? [reviewRows[0]];
      return response(correctedCategory ? rows.map((row) => ({ ...row, category: correctedCategory, confidence: 0.95 })) : rows);
    }
    const correction = /^\/api\/transactions\/([^/]+)\/category$/.exec(url.pathname);
    if (correction) {
      const body = JSON.parse(String(init?.body ?? '{}')) as { category: string };
      correctedCategory = body.category;
      categoryCorrections.push({ id: decodeURIComponent(correction[1]), category: body.category });
      return response({ category: body.category });
    }
    const match = /^\/api\/transactions\/([^/]+)$/.exec(url.pathname);
    if (match) {
      const id = decodeURIComponent(match[1]);
      detailRequests.push(id);
      if (options.detailResponse) return options.detailResponse(id);
      if (options.details?.[id]) return response(options.details[id]);
      return response({ error: 'Transaction details unavailable.' }, 500);
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }));
  return { detailRequests, transactionListRequests, categoryCorrections };
}

async function signInAndOpenReview() {
  render(<MemoryRouter future={{ v7_startTransition: true }}><App /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'analyst@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  fireEvent.click(await screen.findByRole('link', { name: /Transaction Review/ }));
}

describe('transaction review detail flow', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows returned category history and review-flag status', async () => {
    installApiMock({ details: { 'txn-1': detail } });
    await signInAndOpenReview();

    fireEvent.click(await screen.findByRole('button', { name: 'Inspect REF-1' }));

    const dialog = await screen.findByRole('dialog', { name: 'Transaction details' });
    expect(within(dialog).getByText('First transaction detail')).toBeTruthy();
    expect(within(dialog).getByText(/Other.*Software/)).toBeTruthy();
    expect(within(dialog).getByText('Software')).toBeTruthy();
    expect(within(dialog).getByText('Verified vendor')).toBeTruthy();
    expect(within(dialog).getByText('analyst@alpha.test')).toBeTruthy();
    expect(within(dialog).getByText('Open')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close transaction details' })).toBeTruthy();
  });

  it('shows empty history and an explicit current status when history is absent', async () => {
    const noHistory = { ...detail, classificationHistory: [], reviewFlags: [] };
    installApiMock({ details: { 'txn-1': noHistory } });
    await signInAndOpenReview();

    fireEvent.click(await screen.findByRole('button', { name: 'Inspect REF-1' }));

    const dialog = await screen.findByRole('dialog', { name: 'Transaction details' });
    expect(within(dialog).getByText('No classification history is available.')).toBeTruthy();
    expect(within(dialog).getByText('No review flags are recorded for this transaction.')).toBeTruthy();
  });

  it('reports a detail request failure accessibly', async () => {
    installApiMock();
    await signInAndOpenReview();

    fireEvent.click(await screen.findByRole('button', { name: 'Inspect REF-1' }));

    const dialog = await screen.findByRole('dialog', { name: 'Transaction details' });
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Transaction details unavailable.');
  });

  it('ignores a stale detail response when another transaction is selected', async () => {
    let resolveFirst!: (result: Response) => void;
    const { detailRequests } = installApiMock({
      review: reviewRows,
      detailResponse: async (id) => {
        if (id === 'txn-1') return new Promise<Response>((resolve) => { resolveFirst = resolve; });
        return response({ ...detail, id: 'txn-2', external_reference: 'REF-2', description: 'Second transaction detail' });
      }
    });
    await signInAndOpenReview();

    const firstButton = await screen.findByRole('button', { name: 'Inspect REF-1' });
    fireEvent.click(firstButton);
    await waitFor(() => expect(detailRequests).toContain('txn-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect REF-2' }));

    const dialog = await screen.findByRole('dialog', { name: 'Transaction details' });
    expect(await within(dialog).findByText('Second transaction detail')).toBeTruthy();
    await act(async () => resolveFirst(response(detail)));
    await waitFor(() => expect(within(dialog).queryByText('First transaction detail')).toBeNull());
    expect(within(dialog).getByText('Second transaction detail')).toBeTruthy();
  });

  it('restores focus to the inspect action when the drawer closes', async () => {
    installApiMock({ details: { 'txn-1': detail } });
    await signInAndOpenReview();

    const inspectButton = await screen.findByRole('button', { name: 'Inspect REF-1' });
    inspectButton.focus();
    fireEvent.click(inspectButton);
    await screen.findByRole('dialog', { name: 'Transaction details' });
    fireEvent.click(screen.getByRole('button', { name: 'Close transaction details' }));

    expect(document.activeElement).toBe(inspectButton);
  });

  it('dismisses the dialog on Escape and keeps Tab inside it', async () => {
    installApiMock({ details: { 'txn-1': detail } });
    await signInAndOpenReview();

    fireEvent.click(await screen.findByRole('button', { name: 'Inspect REF-1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Transaction details' });
    const closeButton = within(dialog).getByRole('button', { name: 'Close transaction details' });
    fireEvent.keyDown(closeButton, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('uses the existing correction endpoint and refreshes the review data', async () => {
    const requests = installApiMock();
    await signInAndOpenReview();

    fireEvent.click(screen.getByRole('combobox', { name: 'Correct category for REF-1' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Correct category for REF-1 options' }), {
      target: { value: 'Software' }
    });
    fireEvent.click(screen.getByRole('option', { name: 'Software' }));

    await waitFor(() => expect(requests.categoryCorrections).toEqual([{ id: 'txn-1', category: 'Software' }]));
    await waitFor(() => expect(requests.transactionListRequests.length).toBeGreaterThan(1));
    expect((await screen.findByRole('combobox', { name: 'Correct category for REF-1' })).textContent).toContain('Software');
  });
});


