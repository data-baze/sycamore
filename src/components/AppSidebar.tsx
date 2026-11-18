import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import type { AuthSession } from "../types";

interface AppSidebarProps {
  user: AuthSession["user"];
  reviewCount: number;
  onSignOut(): void;
}

const navigationItems = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/transactions", label: "Transactions", icon: "transactions" },
  { to: "/review", label: "Transaction Review", icon: "review" },
] as const;

function NavigationIcon({
  name,
}: {
  name: (typeof navigationItems)[number]["icon"];
}) {
  if (name === "dashboard") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="size-5"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (name === "transactions") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="size-5"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 6.5h16M4 12h16M4 17.5h16" />
        <circle cx="6" cy="6.5" r=".7" fill="currentColor" />
        <circle cx="6" cy="12" r=".7" fill="currentColor" />
        <circle cx="6" cy="17.5" r=".7" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M8 4.5h8a2 2 0 0 1 2 2v13H6v-13a2 2 0 0 1 2-2Z" />
      <path d="M9 4.5v-1h6v1M9 10h6M9 14h2l1.5 1.5L15 13" />
    </svg>
  );
}

export default function AppSidebar({
  user,
  reviewCount,
  onSignOut,
}: AppSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const trigger = triggerRef.current;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [mobileOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={
          mobileOpen ? "Close navigation menu" : "Open navigation menu"
        }
        aria-controls="app-sidebar"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
        className="absolute left-4 top-4 z-40 flex min-h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-3 text-sm font-medium text-ink shadow-card lg:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="size-5"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 6.5h16M4 12h16M4 17.5h16" />
        </svg>
        Menu
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close navigation backdrop"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 size-full cursor-default"
          />
        </div>
      )}

      <aside
        ref={sidebarRef}
        id="app-sidebar"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label={
          mobileOpen ? "Application navigation" : "Application sidebar"
        }
        className={`inset-y-0 left-0 h-screen w-72 shrink-0 flex-col bg-surface px-5 py-6 ${
          mobileOpen ? "fixed z-50 flex shadow-2xl" : "hidden"
        } lg:sticky lg:top-0 lg:z-auto lg:flex lg:border-r lg:border-border lg:shadow-none`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-control bg-brand text-lg font-semibold text-white"
            >
              S
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                Sycamore Capital
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Transaction Intelligence
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="rounded-control p-2 text-muted hover:bg-canvas hover:text-ink lg:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="size-5"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-8 rounded-control bg-canvas px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Workspace
          </p>
          <p className="mt-1 truncate text-sm font-medium text-ink">
            {user.organizationName}
          </p>
        </div>

        <nav aria-label="Primary navigation" className="mt-7 grid gap-1">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors motion-reduce:transition-none ${
                  isActive
                    ? "bg-brand-soft text-brand"
                    : "text-muted hover:bg-canvas hover:text-ink"
                }`
              }
            >
              <NavigationIcon name={item.icon} />
              <span className="min-w-0 flex-1">{item.label}</span>
              {item.to === "/review" && reviewCount > 0 && (
                <span
                  role="status"
                  aria-label={`${reviewCount} pending ${reviewCount === 1 ? "review" : "reviews"}`}
                  className="grid min-w-6 place-items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-warning"
                >
                  {reviewCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-border pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand"
            >
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {user.name}
              </p>
              <p className="truncate text-xs text-muted">{user.username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-4 flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-muted hover:bg-canvas hover:text-ink"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="size-5"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M14 8l4 4-4 4m4-4H9" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
