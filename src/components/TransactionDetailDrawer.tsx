import { useEffect, useRef } from 'react';
import type { TransactionDetails } from '../types';

interface TransactionDetailDrawerProps {
  detail: TransactionDetails | null;
  loading: boolean;
  error: string;
  onClose(): void;
}

export default function TransactionDetailDrawer({ detail, loading, error, onClose }: TransactionDetailDrawerProps) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeHandler = useRef(onClose);

  useEffect(() => {
    closeHandler.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeHandler.current();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40">
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-detail-heading"
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-surface p-5 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">Transaction inspection</p>
            <h2 id="transaction-detail-heading" className="mt-1 break-words text-xl font-semibold text-ink">Transaction details</h2>
            {detail && <p className="mt-1 break-all text-sm text-muted">{detail.external_reference}</p>}
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Close transaction details"
            className="shrink-0 rounded-control border border-border-strong px-3 py-2 text-sm font-medium text-ink hover:bg-canvas"
          >
            Close
          </button>
        </div>

        {loading && <p role="status" aria-live="polite" className="py-6 text-sm text-muted">Loading transaction details…</p>}
        {error && <p role="alert" className="mt-5 rounded-control border border-negative/30 bg-negative/5 px-4 py-3 text-sm text-negative">{error}</p>}

        {!loading && !error && detail && (
          <div className="space-y-7 py-6">
            <section aria-labelledby="transaction-summary-heading">
              <h3 id="transaction-summary-heading" className="font-semibold text-ink">{detail.description}</h3>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-muted">Account</dt><dd className="mt-1 font-medium text-ink">{detail.account_name}</dd></div>
                <div><dt className="text-muted">Date</dt><dd className="mt-1 font-medium tabular-nums text-ink">{detail.transaction_date}</dd></div>
                <div><dt className="text-muted">Amount</dt><dd className="mt-1 font-medium tabular-nums text-ink">{detail.amount}</dd></div>
                <div><dt className="text-muted">Direction</dt><dd className="mt-1 font-medium capitalize text-ink">{detail.direction}</dd></div>
              </dl>
            </section>

            <section aria-labelledby="classification-heading" className="border-t border-border pt-5">
              <h3 id="classification-heading" className="font-semibold text-ink">Current classification</h3>
              <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
                <div><dt className="text-muted">Category</dt><dd className="mt-1 font-medium text-ink">{detail.category}</dd></div>
                <div><dt className="text-muted">Confidence</dt><dd className="mt-1 font-medium tabular-nums text-ink">{Math.round(detail.classification_confidence * 100)}%</dd></div>
                <div><dt className="text-muted">Source</dt><dd className="mt-1 font-medium capitalize text-ink">{detail.classification_source}</dd></div>
              </dl>
            </section>

            <section aria-labelledby="review-flags-heading" className="border-t border-border pt-5">
              <h3 id="review-flags-heading" className="font-semibold text-ink">Review flags</h3>
              {detail.reviewFlags.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {detail.reviewFlags.map((flag, index) => (
                    <li key={`${flag.kind}-${flag.created_at}-${index}`} className="rounded-control border border-border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium capitalize text-ink">{flag.kind.replaceAll('_', ' ')}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                          flag.severity === 'high' ? 'bg-negative/10 text-negative' : flag.severity === 'low' ? 'bg-positive/10 text-positive' : 'bg-warning/10 text-warning'
                        }`}>{flag.severity}</span>
                        <span className="text-sm font-medium text-muted">{flag.resolved_at ? `Resolved ${flag.resolved_at}` : 'Open'}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted">{flag.reason}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">No review flags are recorded for this transaction.</p>
              )}
            </section>

            <section aria-labelledby="classification-history-heading" className="border-t border-border pt-5">
              <h3 id="classification-history-heading" className="font-semibold text-ink">Classification history</h3>
              {detail.classificationHistory.length > 0 ? (
                <ol className="mt-3 space-y-3">
                  {detail.classificationHistory.map((entry, index) => (
                    <li key={`${entry.created_at}-${index}`} className="rounded-control border border-border p-4">
                      <p className="font-medium text-ink">
                        {entry.previous_category ?? 'Not recorded'} <span aria-hidden="true">→</span> {entry.new_category}
                      </p>
                      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <div><dt className="text-muted">Confidence</dt><dd className="mt-1 text-ink">{Math.round(entry.confidence * 100)}%</dd></div>
                        <div><dt className="text-muted">Source</dt><dd className="mt-1 capitalize text-ink">{entry.source}</dd></div>
                        <div><dt className="text-muted">Changed by</dt><dd className="mt-1 break-all text-ink">{entry.actor}</dd></div>
                        {entry.note && <div><dt className="text-muted">Note</dt><dd className="mt-1 text-ink">{entry.note}</dd></div>}
                        <div className="sm:col-span-2"><dt className="text-muted">Changed</dt><dd className="mt-1 tabular-nums text-ink"><time dateTime={entry.created_at}>{entry.created_at}</time></dd></div>
                      </dl>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-muted">No classification history is available.</p>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
