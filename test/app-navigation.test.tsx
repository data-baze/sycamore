// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

const reviewRow = {
  id: 'flag-1',
  transaction_id: 'txn-1',
  external_reference: 'REF-1',
  account_name: 'Operating',
  description: 'Vendor review',
  amount_minor: 125000,
  direction: 'debit' as const,
  category: 'Other',
  confidence: 0.48,
  kind: 'low_confidence',
  severity: 'medium',
  reason: 'Classification confidence is below the review threshold.',
  transaction_date: '2026-11-17'
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function installApiMock(reviewRows = [reviewRow]) {
  const logoutRequests: string[] = [];
  let reviewResolved = false;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
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
    if (url.pathname === '/api/auth/logout') {
      logoutRequests.push(url.pathname);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/api/dashboard') {
      return response({ inflow: 0, outflow: 0, net: 0, categoryBreakdown: [], flaggedTransactions: [] });
    }
    if (url.pathname === '/api/transactions') {
      return response({ total: 0, items: [] });
    }
    if (url.pathname === '/api/review') {
      return response(reviewResolved ? [] : reviewRows);
    }
    if (/^\/api\/transactions\/[^/]+\/category$/.test(url.pathname)) {
      reviewResolved = true;
      return response({ category: 'Software' });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }));
  return { logoutRequests };
}

function HistoryControls() {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" onClick={() => navigate(-1)}>Test history back</button>
      <button type="button" onClick={() => navigate(1)}>Test history forward</button>
    </div>
  );
}

function renderApp(path: string, controls = false) {
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true }}>
      {controls && <HistoryControls />}
      <App />
    </MemoryRouter>
  );
}

async function signIn() {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'analyst@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('button', { name: 'Open navigation menu' });
}

describe('routed application shell', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('opens the requested route directly and marks its navigation link active', async () => {
    installApiMock();
    renderApp('/transactions');

    await signIn();

    expect(await screen.findByRole('heading', { name: 'Transactions', level: 1 })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Transactions' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getAllByText('Search and filter organization transactions.')).toHaveLength(1);
  });

  it('reserves mobile header space for the navigation menu', async () => {
    installApiMock();
    renderApp('/review');
    await signIn();

    const heading = await screen.findByRole('heading', { name: 'Transaction Review', level: 1 });
    expect(heading.parentElement?.className).toContain('pl-24');
    const menuButton = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(menuButton.className).toContain('absolute');
    expect(menuButton.className).not.toContain('fixed');
  });

  it('keeps the active page in sync with browser back and forward navigation', async () => {
    installApiMock();
    renderApp('/dashboard', true);
    await signIn();

    fireEvent.click(await screen.findByRole('link', { name: 'Transactions' }));
    expect(await screen.findByRole('heading', { name: 'Transactions', level: 1 })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Test history back' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Test history forward' }));
    expect(await screen.findByRole('heading', { name: 'Transactions', level: 1 })).toBeTruthy();
  });

  it('redirects an unknown route to Dashboard', async () => {
    installApiMock();
    renderApp('/not-a-page');
    await signIn();

    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeTruthy();
  });

  it('shows the count returned by the review API', async () => {
    installApiMock([{ ...reviewRow }, { ...reviewRow, id: 'flag-2', transaction_id: 'txn-2' }]);
    renderApp('/dashboard');
    await signIn();

    expect(await screen.findByRole('status', { name: '2 pending reviews' })).toBeTruthy();
    expect(screen.getAllByRole('navigation', { name: 'Primary navigation' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Dashboard' })).toBeNull();
  });

  it('does not render a badge for an empty review response', async () => {
    installApiMock([]);
    renderApp('/dashboard');
    await signIn();

    await screen.findByRole('heading', { name: 'Dashboard', level: 1 });
    expect(screen.queryByRole('status', { name: /pending reviews/ })).toBeNull();
  });

  it('updates the review badge after a correction resolves the item', async () => {
    installApiMock();
    renderApp('/review');
    await signIn();

    expect(await screen.findByRole('status', { name: '1 pending review' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('combobox', { name: 'Correct category for REF-1' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Software' }));

    await waitFor(() => expect(screen.queryByRole('status', { name: '1 pending review' })).toBeNull());
    expect(await screen.findByText('No review flags are active for this organization.')).toBeTruthy();
  });

  it('places the authenticated account and sign-out action in the sidebar', async () => {
    const { logoutRequests } = installApiMock();
    renderApp('/dashboard');
    await signIn();

    const sidebar = await screen.findByRole('complementary', { name: 'Application sidebar' });
    expect(within(sidebar).getByText('Test Analyst')).toBeTruthy();
    expect(within(sidebar).getByText('Test Organization')).toBeTruthy();
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in to Sycamore' })).toBeTruthy();
    expect(logoutRequests).toEqual(['/api/auth/logout']);
  });

  it('traps mobile drawer focus, closes on Escape, and restores focus to its trigger', async () => {
    installApiMock();
    renderApp('/dashboard');
    await signIn();

    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(trigger);
    const drawer = await screen.findByRole('dialog', { name: 'Application navigation' });
    const closeButton = within(drawer).getByRole('button', { name: 'Close navigation' });
    const signOutButton = within(drawer).getByRole('button', { name: 'Sign out' });
    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(signOutButton);

    fireEvent.keyDown(drawer, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Application navigation' })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the mobile drawer after selecting a route', async () => {
    installApiMock();
    renderApp('/dashboard');
    await signIn();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const drawer = await screen.findByRole('dialog', { name: 'Application navigation' });

    fireEvent.click(within(drawer).getByRole('link', { name: 'Transactions' }));

    expect(await screen.findByRole('heading', { name: 'Transactions', level: 1 })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Application navigation' })).toBeNull());
  });

  it('closes the mobile drawer when the backdrop is activated', async () => {
    installApiMock();
    renderApp('/dashboard');
    await signIn();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    await screen.findByRole('dialog', { name: 'Application navigation' });

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation backdrop' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Application navigation' })).toBeNull());
  });
});
