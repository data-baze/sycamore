import type { ReviewRow } from "../types";
import Select from "./Select";

interface ReviewViewProps {
  rows: ReviewRow[];
  categories: string[];
  formatMoney(value: number): string;
  onInspect(transactionId: string): void;
  onCategoryChange(transactionId: string, category: string): void;
}

export default function ReviewView({
  rows,
  categories,
  formatMoney,
  onInspect,
  onCategoryChange,
}: ReviewViewProps) {
  return (
    <section
      aria-label="Review queue"
      className="rounded-card border border-border bg-surface p-card shadow-card"
    >
      {rows.length > 0 ? (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="grid gap-5 py-5 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_16rem]"
            >
              <article>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink">
                    {row.external_reference}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                      row.severity === "high"
                        ? "bg-negative/10 text-negative"
                        : row.severity === "low"
                          ? "bg-positive/10 text-positive"
                          : "bg-warning/10 text-warning"
                    }`}
                  >
                    {row.severity} severity
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink">{row.description}</p>
                <p className="mt-1 text-sm text-muted">
                  {row.account_name} <span aria-hidden="true">·</span>{" "}
                  {row.transaction_date}
                </p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Amount</dt>
                    <dd className="mt-1 font-medium tabular-nums text-ink">
                      {row.direction === "debit" ? "−" : "+"}
                      {formatMoney(row.amount_minor)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Current classification</dt>
                    <dd className="mt-1 font-medium text-ink">
                      {row.category}{" "}
                      <span className="text-muted">
                        ({Math.round(row.confidence * 100)}% confidence)
                      </span>
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted">
                      Review reason · {row.kind.replaceAll("_", " ")}
                    </dt>
                    <dd className="mt-1 text-ink">{row.reason}</dd>
                  </div>
                </dl>
              </article>
              <div className="flex flex-col items-stretch gap-3 lg:items-end">
                <Select
                  label={`Correct category for ${row.external_reference}`}
                  options={categories.map((category) => ({
                    value: category,
                    label: category,
                  }))}
                  value={row.category}
                  onChange={(category) =>
                    onCategoryChange(row.transaction_id, category)
                  }
                  searchable
                />
                <button
                  type="button"
                  onClick={() => onInspect(row.transaction_id)}
                  aria-label={`Inspect ${row.external_reference}`}
                  className="rounded-control border border-border-strong px-3 py-2 text-sm font-medium text-brand hover:bg-brand-soft"
                >
                  Inspect transaction
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-control bg-canvas px-4 py-3 text-sm text-muted">
          No review flags are active for this organization.
        </p>
      )}
    </section>
  );
}
