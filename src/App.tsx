import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import DashboardView from "./components/DashboardView";
import AppSidebar from "./components/AppSidebar";
import ReviewView from "./components/ReviewView";
import TransactionsView from "./components/TransactionsView";
import TransactionDetailDrawer from "./components/TransactionDetailDrawer";
import type {
  AuthSession,
  DashboardData,
  ReviewRow,
  TransactionDetails,
  TransactionRow,
} from "./types";

const pages = [
  {
    path: "/dashboard",
    view: "dashboard",
    title: "Dashboard",
    description: "Overview of cash flow and items that need attention.",
  },
  {
    path: "/transactions",
    view: "transactions",
    title: "Transactions",
    description: "Search and filter organization transactions.",
  },
  {
    path: "/review",
    view: "review",
    title: "Transaction Review",
    description:
      "Investigate flagged transactions and correct classifications.",
  },
] as const;

const categoryOptions = [
  "Revenue",
  "Payroll",
  "Software",
  "Marketing",
  "Travel",
  "Utilities",
  "Rent",
  "Tax",
  "Transfers",
  "Banking Fees",
  "Other",
];

export default function App() {
  const { pathname } = useLocation();
  const routePage = pages.find((candidate) => candidate.path === pathname);
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<Array<TransactionRow>>([]);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedTransactionId, setSelectedTransactionId] = useState<
    string | null
  >(null);
  const [transactionDetail, setTransactionDetail] =
    useState<TransactionDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const organizationId = auth?.user.organizationId ?? "";
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: auth ? `Bearer ${auth.token}` : "",
    }),
    [auth],
  );

  useEffect(() => {
    if (!auth || !organizationId) {
      return undefined;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError("");
    Promise.all([
      fetch("/api/dashboard", { headers, signal: controller.signal }).then(
        (response) => {
          if (!response.ok) {
            throw new Error(`Dashboard request failed (${response.status}).`);
          }
          return response.json();
        },
      ),
      fetch(
        `/api/transactions?search=${encodeURIComponent(search)}&category=${encodeURIComponent(categoryFilter)}&direction=${encodeURIComponent(directionFilter)}&page=${page}&limit=8`,
        {
          headers,
          signal: controller.signal,
        },
      ).then((response) => {
        if (!response.ok) {
          throw new Error(`Transactions request failed (${response.status}).`);
        }
        return response.json();
      }),
      fetch("/api/review", { headers, signal: controller.signal }).then(
        (response) => {
          if (!response.ok) {
            throw new Error(`Review request failed (${response.status}).`);
          }
          return response.json();
        },
      ),
    ])
      .then(([dashboardData, transactionData, reviewData]) => {
        setDashboard(dashboardData);
        setTransactions(transactionData.items ?? []);
        setPageCount(Math.max(1, Math.ceil((transactionData.total ?? 0) / 8)));
        setReviewRows(reviewData ?? []);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load organization data.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    auth,
    organizationId,
    headers,
    search,
    categoryFilter,
    directionFilter,
    page,
    refreshToken,
  ]);

  useEffect(() => {
    if (!auth || !selectedTransactionId) {
      setTransactionDetail(null);
      setDetailLoading(false);
      setDetailError("");
      return undefined;
    }

    const controller = new AbortController();
    setTransactionDetail(null);
    setDetailLoading(true);
    setDetailError("");
    fetch(`/api/transactions/${encodeURIComponent(selectedTransactionId)}`, {
      headers,
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(
            result.error ??
              `Transaction details request failed (${response.status}).`,
          );
        }
        return result as TransactionDetails;
      })
      .then((result) => {
        if (!controller.signal.aborted) setTransactionDetail(result);
      })
      .catch((reason: unknown) => {
        if (
          !controller.signal.aborted &&
          !(reason instanceof DOMException && reason.name === "AbortError")
        ) {
          setDetailError(
            reason instanceof Error
              ? reason.message
              : "Could not load transaction details.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });

    return () => controller.abort();
  }, [auth, headers, selectedTransactionId, refreshToken]);

  const formatMoney = (value: number) => {
    const amount = BigInt(value);
    const absoluteAmount = amount < 0n ? -amount : amount;
    const naira = Number(absoluteAmount / 100n);
    const kobo = String(absoluteAmount % 100n).padStart(2, "0");
    const formattedNaira = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(naira);
    return `${amount < 0n ? "-" : ""}${formattedNaira}.${kobo}`;
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? `Login failed (${response.status}).`);
      }

      setAuth(result as AuthSession);
      setLoginPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
    }
  };

  const signOut = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers,
      });
      if (!response.ok) {
        throw new Error(`Sign-out failed (${response.status}).`);
      }
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not sign out on the server.",
      );
    } finally {
      setAuth(null);
      setDashboard(null);
      setTransactions([]);
      setReviewRows([]);
      setSelectedTransactionId(null);
      setTransactionDetail(null);
      setDetailLoading(false);
      setDetailError("");
    }
  };

  const openTransaction = (transactionId: string) => {
    if (selectedTransactionId === transactionId) return;
    setSelectedTransactionId(transactionId);
    setTransactionDetail(null);
    setDetailError("");
    setDetailLoading(true);
  };

  const closeTransactionDetails = () => {
    setSelectedTransactionId(null);
    setTransactionDetail(null);
    setDetailLoading(false);
    setDetailError("");
  };

  const updateCategory = async (transactionId: string, newCategory: string) => {
    try {
      const response = await fetch(
        `/api/transactions/${transactionId}/category`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            category: newCategory,
            note: "Manual category review",
          }),
        },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.error ?? `Category update failed (${response.status}).`,
        );
      }

      setError("");
      setRefreshToken((current) => current + 1);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not update the category.",
      );
    }
  };

  if (!routePage) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!auth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
        <section
          aria-labelledby="login-heading"
          className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-card sm:p-8"
        >
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              Sycamore Capital
            </p>
            <p className="mt-2 text-sm text-muted">Transaction Intelligence</p>
            <h1
              id="login-heading"
              className="mt-6 text-2xl font-semibold tracking-tight text-ink"
            >
              Sign in to Sycamore
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Access your organization’s transaction workspace.
            </p>
          </div>
          <form className="grid gap-5" onSubmit={signIn}>
            <label className="grid gap-2 text-sm font-medium text-ink">
              Username
              <input
                autoComplete="username"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                required
                className="w-full rounded-control border border-border-strong bg-surface px-3 py-2.5 text-ink placeholder:text-subtle"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink">
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
                className="w-full rounded-control border border-border-strong bg-surface px-3 py-2.5 text-ink"
              />
            </label>
            <button
              type="submit"
              className="mt-1 rounded-control bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-strong"
            >
              Sign in
            </button>
          </form>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-control border border-negative/30 bg-negative/5 px-4 py-3 text-sm text-negative"
            >
              {error}
            </p>
          )}
          <p className="mt-6 border-t border-border pt-4 text-sm text-muted">
            Demo credentials are listed in the README.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen bg-canvas lg:flex">
      <AppSidebar
        user={auth.user}
        reviewCount={reviewRows.length}
        onSignOut={signOut}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8">
          <header className="mb-6">
            <div className="min-w-0 pl-24 lg:pl-0">
              <h1
                id="page-title"
                className="text-2xl font-semibold tracking-tight text-ink"
              >
                {routePage.title}
              </h1>
              <p className="mt-1 text-sm text-muted">{routePage.description}</p>
            </div>
          </header>

          {error && (
            <p
              role="alert"
              className="mb-5 rounded-control border border-negative/30 bg-negative/5 px-4 py-3 text-sm text-negative"
            >
              {error}
            </p>
          )}
          {isLoading && (
            <p
              role="status"
              aria-live="polite"
              className="mb-5 rounded-control border border-border bg-surface px-4 py-3 text-sm text-muted"
            >
              Loading organization data…
            </p>
          )}

          {!isLoading && routePage.view === "dashboard" && dashboard && (
            <DashboardView
              data={dashboard}
              formatMoney={formatMoney}
              onInspect={openTransaction}
            />
          )}

          {!isLoading && routePage.view === "transactions" && (
            <TransactionsView
              rows={transactions}
              categories={categoryOptions}
              search={search}
              category={categoryFilter}
              direction={directionFilter}
              page={page}
              pageCount={pageCount}
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              onCategoryChange={(value) => {
                setCategoryFilter(value);
                setPage(1);
              }}
              onDirectionChange={(value) => {
                setDirectionFilter(value);
                setPage(1);
              }}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
              onInspect={openTransaction}
            />
          )}

          {!isLoading && routePage.view === "review" && (
            <ReviewView
              rows={reviewRows}
              categories={categoryOptions}
              formatMoney={formatMoney}
              onInspect={openTransaction}
              onCategoryChange={updateCategory}
            />
          )}
          {selectedTransactionId && (
            <TransactionDetailDrawer
              detail={transactionDetail}
              loading={detailLoading}
              error={detailError}
              onClose={closeTransactionDetails}
            />
          )}
        </div>
      </main>
    </div>
  );
}
