// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

const transactionRequests: URL[] = [];

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('App transaction filters', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    transactionRequests.length = 0;
  });

  it('returns to page one when any transaction filter changes on a later page', async () => {
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
      if (url.pathname === '/api/dashboard') {
        return response({ inflow: 0, outflow: 0, net: 0, categoryBreakdown: [], flaggedTransactions: [] });
      }
      if (url.pathname === '/api/review') {
        return response([]);
      }
      if (url.pathname === '/api/transactions') {
        transactionRequests.push(url);
        return response({ total: 16, items: [] });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    }));

    render(<MemoryRouter future={{ v7_startTransition: true }}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'analyst@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    fireEvent.click(await screen.findByRole('link', { name: 'Transactions' }));
    await screen.findByText('Page 1 of 2');

    for (const [control, value, parameter] of [
      ['Category', 'Travel', 'category'],
      ['Direction', 'credit', 'direction'],
      ['Search transactions', 'INV-1001', 'search']
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      await screen.findByText('Page 2 of 2');

      const filter = control === 'Search transactions'
        ? screen.getByRole('searchbox', { name: control })
        : screen.getByRole('combobox', { name: control });
      if (parameter === 'category') {
        fireEvent.click(filter);
        fireEvent.click(await screen.findByRole('option', { name: value }));
      } else if (parameter === 'direction') {
        fireEvent.keyDown(filter, { key: 'ArrowDown' });
        fireEvent.keyDown(filter, { key: 'ArrowDown' });
        fireEvent.keyDown(filter, { key: 'Enter' });
      } else {
        fireEvent.change(filter, { target: { value } });
      }

      await waitFor(() => {
        const request = transactionRequests.slice().reverse().find((url) => url.searchParams.get(parameter) === value);
        expect(request?.searchParams.get('page')).toBe('1');
      });
      await screen.findByText('Page 1 of 2');
    }

    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Category' }));
    await waitFor(() => {
      const request = transactionRequests.slice().reverse().find((url) => url.searchParams.get('category') === 'all');
      expect(request?.searchParams.get('page')).toBe('1');
    });
  });
});
