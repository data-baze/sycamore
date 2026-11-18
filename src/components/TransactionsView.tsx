import type { TransactionRow } from "../types";
import Select from "./Select";

interface TransactionsViewProps {
  rows: TransactionRow[];
  categories: string[];
  search: string;
  category: string;
  direction: string;
  page: number;
  pageCount: number;
  onSearchChange(value: string): void;
  onCategoryChange(value: string): void;
  onDirectionChange(value: string): void;
  onPrevious(): void;
  onNext(): void;
  onInspect(transactionId: string): void;
}

export default function TransactionsView({
  rows,
  categories,
  search,
  category,
  direction,
  page,
  pageCount,
  onSearchChange,
  onCategoryChange,
  onDirectionChange,
  onPrevious,
  onNext,
  onInspect,
}: TransactionsViewProps) {
  return (
    <section
      aria-label="Transactions filters and results"
      className="rounded-card border border-border bg-surface p-card shadow-card"
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
        <label className="grid gap-1.5 text-sm font-medium text-muted">
          Search
          <input
            type="search"
            aria-label="Search transactions"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search description or reference"
            className="min-w-0 rounded-control border border-border-strong bg-surface px-3 py-2 text-ink placeholder:text-subtle"
          />
        </label>
        <div>
          <Select
            label="Category"
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((option) => ({ value: option, label: option })),
            ]}
            value={category}
            onChange={onCategoryChange}
            searchable
            clearValue="all"
          />
        </div>
        <div>
          <Select
            label="Direction"
            options={[
            { value: "all", label: "All directions" },
            { value: "credit", label: "Credit" },
            { value: "debit", label: "Debit" },
            ]}
            value={direction}
            onChange={onDirectionChange}
            clearValue="all"
          />
        </div>
      </div>

      <div
        role="region"
        aria-label="Transaction results"
        tabIndex={0}
        className="overflow-x-auto rounded-control border border-border focus-visible:outline-offset-[-3px]"
      >
        <table className="w-full min-w-[70rem] border-collapse text-left text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th
                scope="col"
                className="w-48 border-b border-border px-3 py-3 font-medium"
              >
                Reference
              </th>
              <th
                scope="col"
                className="w-44 border-b border-border px-3 py-3 font-medium"
              >
                Account
              </th>
              <th
                scope="col"
                className="w-72 border-b border-border px-3 py-3 font-medium"
              >
                Description
              </th>
              <th
                scope="col"
                className="w-36 border-b border-border px-3 py-3 font-medium"
              >
                Category
              </th>
              <th
                scope="col"
                className="w-28 border-b border-border px-3 py-3 font-medium"
              >
                Direction
              </th>
              <th
                scope="col"
                className="w-40 border-b border-border px-3 py-3 text-right font-medium"
              >
                Amount
              </th>
              <th
                scope="col"
                className="w-32 border-b border-border px-3 py-3 font-medium"
              >
                Date
              </th>
              <th
                scope="col"
                className="w-28 border-b border-border px-3 py-3 font-medium"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <th
                    scope="row"
                    className="max-w-48 break-all px-3 py-3 font-medium text-ink"
                  >
                    {row.external_reference}
                  </th>
                  <td className="px-3 py-3 text-muted">{row.account_name}</td>
                  <td className="max-w-72 break-words px-3 py-3 text-ink">
                    {row.description}
                  </td>
                  <td className="px-3 py-3 text-ink">{row.category}</td>
                  <td className="px-3 py-3 text-muted">
                    {row.direction === "credit" ? "Credit" : "Debit"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums text-ink">
                    {row.amount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-muted">
                    {row.transaction_date}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onInspect(row.id)}
                      aria-label={`Inspect ${row.external_reference}`}
                      className="rounded-control px-2 py-1 font-medium text-brand hover:bg-brand-soft"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-muted"
                >
                  No transactions match the search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav
        aria-label="Transaction pages"
        className="mt-4 flex items-center justify-end gap-3"
      >
        <button
          type="button"
          onClick={onPrevious}
          disabled={page <= 1}
          aria-label="Previous page"
          className="rounded-control border border-border-strong px-3 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span aria-live="polite" className="text-sm tabular-nums text-muted">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="rounded-control border border-border-strong px-3 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </nav>
    </section>
  );
}
