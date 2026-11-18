# Sycamore Transaction Intelligence Platform

A lightweight full-stack prototype for a multi-tenant transaction intelligence platform tailored to Nigerian businesses. The app ingests transactions, stores them with NGN minor-unit precision, automatically categorises them, surfaces review flags, and provides a simple React dashboard for operations teams.

## Features

- Multi-tenant backend with organization-scoped API access
- Demo username/password login with tenant-bound bearer sessions
- Transaction import with idempotent duplicate prevention and batch reporting
- NGN monetary storage in minor units to avoid floating-point drift
- Replaceable classification-provider interface with a local rules-based implementation
- Review engine for large payments and low-confidence classifications
- Manual category correction with audit-history tracking and low-confidence alert resolution
- Dashboard, transaction browse, and review queue UI

## Local setup

```bash
npm install
npm run seed
npm run dev
```

Then open:

- Frontend: http://localhost:5173/
- API: http://localhost:3010/api/health

`npm run dev` is a foreground process that stays open while the app runs. Stop both the API and frontend with **Ctrl+C** in that same terminal. Do not start it as a background task just to run tests; `npm test` and `npm run build` are bounded commands.

The seed data creates two tenants: `Alpha Retail & Logistics` and `Beta Manufacturing Co.`.

Demo login:

- Alpha: `analyst@alpha.test` / `Alpha-demo-2026`
- Beta: `analyst@beta.test` / `Beta-demo-2026`

## Architecture

- Backend: Express + TypeScript + SQLite
- Frontend: React + Vite
- Data model: organizations, users, accounts, transactions, review_flags, and classification_history
- Tenant isolation: authenticated sessions map to one organization; the backend ignores caller-supplied tenant headers and scopes SQL queries using the session identity
- Classification: the prototype uses a synchronous local rules provider; remote AI requires a durable queue and worker, which are not implemented

## API

Log in at `/api/auth/login` to receive a bearer token. All API routes except `/api/health` and login require `Authorization: Bearer <token>`. Tenant identity comes from that session; `x-organization-id` headers and organization query parameters do not select a tenant.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service health check |
| `POST` | `/api/auth/login` | Exchange a username/password for an organization-scoped session |
| `POST` | `/api/auth/logout` | Revoke the current in-memory session |
| `GET` | `/api/organizations` | Get the authenticated user's organization |
| `GET` | `/api/dashboard` | Tenant-scoped inflow, outflow, category totals, and review flags |
| `GET` | `/api/transactions?search=&category=all&direction=all&page=1&limit=10` | Search and paginate tenant transactions |
| `GET` | `/api/transactions/:id` | Retrieve a transaction with review flags and classification history |
| `POST` | `/api/transactions/import` | Import an array of transactions; returns inserted, duplicate, and failed counts |
| `GET` | `/api/review` | List tenant-scoped review items with explanations |
| `PATCH` | `/api/transactions/:id/category` | Correct a category and append an audit record |

Example login:

```json
{
  "username": "analyst@alpha.test",
  "password": "Alpha-demo-2026"
}
```

Send the returned `token` as a bearer token on subsequent calls.

Example import:

```json
{
  "transactions": [
    {
      "externalReference": "INV-2026-001",
      "accountId": "acct_cash",
      "amount": "12999.75",
      "direction": "debit",
      "description": "Google Workspace subscription",
      "currency": "NGN",
      "date": "2026-11-17"
    }
  ]
}
```

Batch rows that fail validation are reported individually; valid rows still import. Re-importing an existing organization/account/reference is treated as a duplicate and does not change the stored transaction.

## Financial correctness

NGN values are stored as integer minor units (kobo equivalents). For example, ₦12,999.75 is stored as `1299975`; formatting splits integer naira and kobo before applying locale grouping, avoiding floating-point conversion.

## AI reliability and resilience

The prototype currently uses a synchronous rules provider; it does not call an external AI service, so an AI outage cannot block imports here. The provider interface keeps the categorisation boundary replaceable, while a production remote provider should run asynchronously behind a durable queue so ingestion remains independent. Imports are idempotent, so callers can safely retry a batch after a network failure.

## Multi-tenancy and security

Tenant-scoped endpoints require a valid bearer session. The server maps the token to its organization and never trusts a tenant ID from the request. Queries are organization-scoped, category corrections use the authenticated username as their audit actor, and SQLite enforces foreign keys and transaction/account consistency. Demo passwords are public and sessions are in-memory, so this is not production authentication.

## Review detection

The review queue highlights:

- unusually large debits above the review threshold
- classifications below the 60% confidence threshold

Each review item carries a human-readable explanation and a severity so finance teams can triage quickly.

## Seed data

The seed script includes realistic NGN transactions for both organizations, including payroll, recurring software subscriptions, VAT payments, sales inflows, and flagged transfer activity. This provides a realistic dataset for dashboard and review testing.

## Testing

Automated checks cover:

- monetary conversion and formatting
- classification categorisation rules
- duplicate import handling, validation, and partial batch outcomes
- tenant-scoped authentication, history preservation, review-flag resolution, and database integrity
- low-confidence and large-payment review detection

Run:

```bash
npm test
npm run build
```

## AI reliability scenarios

### 1. Classification provider unavailable for six hours

This prototype uses only local rules, so it has no remote provider outage path. In production, ingestion should persist transactions and enqueue classification jobs independently; workers should retry with backoff, dead-letter persistent failures, and keep low-confidence/unclassified transactions visible for review. After recovery, workers drain the backlog without re-importing ledger rows.

### 2. AI cost optimisation at millions of transactions a day

The provider boundary allows a production implementation to batch low-risk transactions through a fast heuristic path and call a premium model only for outliers, unusual merchants, or low-confidence results. This is a proposed production strategy, not implemented model batching.

### 3. Scaling from 100k to 10M daily transactions

A production version would move to a horizontally scalable database, asynchronous workers, and read-optimised search indexes for transaction queries. Patterns such as queue-based classification jobs, partitioned ledgers by organization and date, and background review pipelines would keep ingestion and analysis independent.

### 4. Customer distrust due to inaccurate AI categorisation

The investigation would focus on classification drift, merchant dictionary coverage, and review backlog. The app exposes confidence scores, original classification history, and manual correction history to diagnose whether the problem is systemic or isolated to a few merchant patterns. Fixes would be targeted and audited before broad reclassification.

## Trade-offs and likely improvements

- This prototype uses a lightweight rules engine instead of an external AI provider to keep local running simple and reliable.
- SQLite is sufficient for a prototype and local development, but a production system would likely use PostgreSQL or MySQL with partitioning and concurrency controls.
- Frontend screens are intentionally minimal and focused on functional workflows rather than design-heavy polish.
- Demo users are seeded with public passwords and sessions are in-memory; replace this with managed authentication, credential rotation, and role-based access before production.
- The rules provider is local and synchronous. Remote AI retries/queues and end-to-end browser tests remain production hardening work.

## Potential next steps

- expose import retries and partial-batch retry jobs
- add remote AI job queues, rate limits, and provider fallback logic
- add audit exports and immutable ledger snapshots
