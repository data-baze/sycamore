import type { DashboardData } from "../types";

interface DashboardViewProps {
  data: DashboardData;
  formatMoney(value: number): string;
  onInspect(transactionId: string): void;
}

export default function DashboardView({
  data,
  formatMoney,
  onInspect,
}: DashboardViewProps) {
  const categories = [...data.categoryBreakdown].sort(
    (first, second) =>
      second.total - first.total || first.category.localeCompare(second.category),
  );
  const largestCategoryTotal = Math.max(0, ...categories.map((row) => row.total));
  const maxCategoryTotal = Math.max(1, largestCategoryTotal);

  return (
    <div className="space-y-6">
      <section
        aria-label="Cash flow summary"
        className="grid gap-4 sm:grid-cols-3"
      >
        {[
          { label: "Total inflows", value: data.inflow, tone: "text-positive" },
          {
            label: "Total outflows",
            value: data.outflow,
            tone: "text-negative",
          },
          {
            label: "Net cash flow",
            value: data.net,
            tone: data.net >= 0 ? "text-positive" : "text-negative",
          },
        ].map((metric) => (
          <article
            key={metric.label}
            className="rounded-card border border-border bg-surface p-card shadow-card"
          >
            <h2 className="text-sm font-medium text-muted">{metric.label}</h2>
            <p
              className={`mt-3 text-2xl font-semibold tabular-nums tracking-tight ${metric.tone}`}
            >
              {formatMoney(metric.value)}
            </p>
          </article>
        ))}
      </section>

      <section
        aria-labelledby="category-spend-heading"
        className="rounded-card border border-border bg-surface p-card shadow-card"
      >
        <div className="mb-5">
          <h2
            id="category-spend-heading"
            className="text-lg font-semibold text-ink"
          >
            Spending by category
          </h2>
          <p className="mt-1 text-sm text-muted">Debit totals by category</p>
        </div>
        {categories.length > 0 ? (
          <ul className="space-y-4">
            {categories.map((row) => (
              <li
                key={row.category}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2"
              >
                <span className="min-w-0 break-words text-sm font-medium text-ink">
                  {row.category}
                </span>
                <span className="whitespace-nowrap text-sm font-medium tabular-nums text-ink">
                  {row.label}
                </span>
                <div className="col-span-2 h-2 overflow-hidden rounded-full bg-canvas">
                  <div
                    role="progressbar"
                    aria-label={`${row.category} spending`}
                    aria-valuemin={0}
                    aria-valuemax={maxCategoryTotal}
                    aria-valuenow={Math.max(0, row.total)}
                    aria-valuetext={row.label}
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${largestCategoryTotal > 0 ? Math.max(0, Math.min(100, (row.total / largestCategoryTotal) * 100)) : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-control bg-canvas px-4 py-3 text-sm text-muted">
            No category data available.
          </p>
        )}
      </section>

      <section
        aria-labelledby="flagged-transactions-heading"
        className="rounded-card border border-border bg-surface p-card shadow-card"
      >
        <div className="mb-5">
          <h2
            id="flagged-transactions-heading"
            className="text-lg font-semibold text-ink"
          >
            Flagged transactions
          </h2>
          <p className="mt-1 text-sm text-muted">
            Items that need a closer look
          </p>
        </div>
        {data.flaggedTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-subtle">
                <tr>
                  <th
                    scope="col"
                    className="border-b border-border px-3 py-2 font-medium"
                  >
                    Reference
                  </th>
                  <th
                    scope="col"
                    className="border-b border-border px-3 py-2 font-medium"
                  >
                    Reason
                  </th>
                  <th
                    scope="col"
                    className="border-b border-border px-3 py-2 font-medium"
                  >
                    Severity
                  </th>
                  <th
                    scope="col"
                    className="border-b border-border px-3 py-2 text-right font-medium"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="border-b border-border px-3 py-2 font-medium"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.flaggedTransactions.map((row) => (
                  <tr key={row.id}>
                    <th
                      scope="row"
                      className="max-w-40 truncate px-3 py-3 font-medium text-ink"
                    >
                      {row.external_reference}
                    </th>
                    <td className="max-w-sm px-3 py-3 text-muted">
                      {row.reason}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                          row.severity === "high"
                            ? "bg-negative/10 text-negative"
                            : row.severity === "low"
                              ? "bg-positive/10 text-positive"
                              : "bg-warning/10 text-warning"
                        }`}
                      >
                        {row.severity}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums text-ink">
                      {row.amount}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-control px-2 py-1 font-medium text-brand hover:bg-brand-soft"
                        onClick={() => onInspect(row.transaction_id)}
                        aria-label={`Inspect ${row.external_reference}`}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-control bg-canvas px-4 py-3 text-sm text-muted">
            No flagged transactions to review.
          </p>
        )}
      </section>
    </div>
  );
}
