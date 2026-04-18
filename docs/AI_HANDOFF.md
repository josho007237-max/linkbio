# AI Handoff

## Current goal
Add Google Sheets integration for existing in-site support forms while keeping current UX/routes unchanged and preserving local-dev fallback.

## Last completed
- Added submission adapter layer:
  - `SUPPORT_SUBMISSION_ADAPTER_MODE=auto|local_dev|google_sheets`
  - Google Sheets adapter selected by env configuration
  - local-dev JSON store remains fallback in development
- Kept existing support endpoints and client UX unchanged:
  - `POST /api/support/deposit-issues`
  - `POST /api/support/withdraw-issues`
- Added Google Sheets row writing with service-account JWT auth.
- Added dedicated sheet/tab target support:
  - deposit tab (default: `ฝากเงินไม่เข้า`)
  - withdraw tab (default: `ถอนเงินไม่ได้`)
- Added server route for uploaded slip file references:
  - `GET /api/support/uploads/[kind]/[file]`
  - deposit submissions now store usable `slip_url` references for sheet rows.

## Changed files
- `.env.example`
- `src/lib/server/support-submission-adapter.ts`
- `src/lib/server/support-submissions-store.ts`
- `src/lib/server/support-submissions-store.ts`
- `src/app/api/support/deposit-issues/route.ts`
- `src/app/api/support/withdraw-issues/route.ts`
- `src/app/api/support/uploads/[kind]/[file]/route.ts`
- `docs/AI_HANDOFF.md`

## Behavior change
- Support submissions can now be routed to Google Sheets in production without changing endpoint or UI flow.
- Local dev file storage remains available as fallback/development target.
- Deposit sheet rows include: `submitted_at, issue_type, user, registered_phone, slip_url, transaction_time, note, status`.
- Withdraw sheet rows include: `submitted_at, issue_type, user, phone, full_name, bank_account, transaction_time, note, status`.

## Lint result
- `npm run lint`: PASS

## Build result
- `npm run build`: PASS (required escalated run due sandbox `spawn EPERM` on non-escalated execution)

## Known issues
- In this environment, non-escalated production build may fail with `spawn EPERM`; escalated build succeeds.
- Local-dev storage still writes to:
  - `data/support-submissions.dev.json`
  - `data/support-uploads/...`
- For Google Sheets mode, target tabs must already exist in the spreadsheet and match env tab names.
- Uploaded slip URLs use local app host path (`/api/support/uploads/...`), so external readers need network access to this app host.

## Google Sheets setup
1. Create one Google Sheet and two tabs:
   - `ฝากเงินไม่เข้า`
   - `ถอนเงินไม่ได้`
2. Add header columns exactly:
   - Deposit tab:
     - `submitted_at, issue_type, user, registered_phone, slip_url, transaction_time, note, status`
   - Withdraw tab:
     - `submitted_at, issue_type, user, phone, full_name, bank_account, transaction_time, note, status`
3. Create a Google service account and share the sheet with service account email (Editor).
4. Configure env:
   - `SUPPORT_SUBMISSION_ADAPTER_MODE=google_sheets` (or `auto`)
   - `GOOGLE_SHEETS_SUPPORT_SPREADSHEET_ID=<sheet-id>`
   - `GOOGLE_SHEETS_SUPPORT_DEPOSIT_TAB=ฝากเงินไม่เข้า`
   - `GOOGLE_SHEETS_SUPPORT_WITHDRAW_TAB=ถอนเงินไม่ได้`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account-email>`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<private-key-with-\\n>`
5. Mode behavior:
   - `auto`: uses Google when configured, otherwise local dev store.
   - `local_dev`: always local JSON/file store.
   - `google_sheets`: requires valid config; in development, missing config falls back to local with warning.

## Next recommended step
1. Add rate limiting and bot/abuse checks on support submit routes.
2. Add a secure signed URL / private object storage strategy for slip files in production.
3. Add lightweight submission monitoring/alerting for failed Google Sheets writes.

## Update 2026-04-18 (deposit_issue submit flow)

### Changed files
- `src/components/preview/mobile-preview.tsx`
- `docs/AI_HANDOFF.md`

### Behavior change
- Fixed `deposit_issue` validation flow so `file_image` required checks now validate against selected file state (`formFilesByLink`) before generic text/choice required checks.
- This unblocks form submit when slip preview is visible and allows the existing submit branch to run:
  - append selected file to `FormData` as `slip`
  - call `POST /api/support/deposit-issues`
- Preserved existing image-only validation and 5MB max-size validation.
- No changes made to `withdraw_issue`, save/reset/restore, autosave, Google Sheets adapter, or success/error modal behavior.

### Lint result
- `npm run lint`: PASS

### Build result
- `npm run build`: PASS (after escalated rerun)
- Non-escalated build in this environment still hits sandbox `spawn EPERM`.

### Known issues
- In this environment, non-escalated production build can fail with `spawn EPERM`; escalated build succeeds.
- No additional deposit/withdraw flow regressions identified in static checks, but end-to-end browser interaction was not executed in this terminal-only run.

## Update 2026-04-18 (deposit_issue server parse fix)

### Changed files
- `src/app/api/support/deposit-issues/route.ts`
- `docs/AI_HANDOFF.md`

### Behavior change
- Removed `safeJsonParse` import from `deposit-issues` route because that utility is client-only (`"use client"`).
- Added a server-safe inline JSON helper (`parseJsonWithFallback`) and switched `responses` parsing to use it.
- Preserved existing `FormData` flow, `slip` file validation, upload write, `submitDepositIssue` call, and response shape.
- No changes made to UI, `withdraw_issue`, save/reset/restore, autosave, or Google Sheets adapter logic.

### Lint result
- `npm run lint`: PASS

### Build result
- `npm run build`: PASS (after escalated rerun)
- Non-escalated build in this environment still hits sandbox `spawn EPERM`.

### Known issues
- In this environment, non-escalated production build can fail with `spawn EPERM`; escalated build succeeds.
- End-to-end browser submission was not executed in this terminal-only run.

## Update 2026-04-18 (production root route safety default)

### Changed files
- `src/app/page.tsx`
- `docs/AI_HANDOFF.md`

### Behavior change
- Root route `/` no longer renders `AdminShell`.
- Root route now redirects to `/110` as a temporary production-safe default.
- Public slug routes such as `/<username>` remain unchanged (including `/110`).
- No changes made to support form logic, save/reset/restore behavior, autosave, or Google Sheets adapter.

### Lint result
- `npm run lint`: PASS

### Build result
- `npm run build`: PASS (after escalated rerun)
- Non-escalated build in this environment still hits sandbox `spawn EPERM`.

### Known issues
- In this environment, non-escalated production build can fail with `spawn EPERM`; escalated build succeeds.
- No separate internal editor route currently exists in `src/app`; editor code remains in the codebase but is no longer exposed via `/`.

## Update 2026-04-18 (production public page persistence via Supabase)

### Changed files
- `src/lib/server/public-pages-store.ts`
- `src/app/api/public-pages/[slug]/route.ts`
- `src/components/public/public-profile-page-client.tsx`
- `.env.example`
- `docs/AI_HANDOFF.md`

### Behavior change
- Replaced production public-page persistence backend with Supabase-backed storage (server-side) while preserving API endpoints:
  - `GET /api/public-pages/[slug]`
  - `PUT /api/public-pages/[slug]`
  - `DELETE /api/public-pages/[slug]`
- Superseded by the stricter update below: public-page persistence is now Supabase-only (no public localStorage fallback).
- Admin autosave/publish flow remains the same and continues publishing via `PUT /api/public-pages/[slug]`.

### Env setup
- Added required server env:
  - `SUPABASE_SERVICE_ROLE_KEY`
- Existing env still required:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (unchanged; still used by client-side Supabase code paths)
- Recommended Supabase table schema:
  - table name: `public_pages`
  - columns:
    - `slug text primary key`
    - `data jsonb not null`
    - `updated_at timestamptz not null default now()`
  - optional index:
    - `create index if not exists public_pages_updated_at_idx on public_pages (updated_at desc);`

### Lint result
- `npm run lint`: PASS

### Build result
- `npm run build`: PASS (after escalated rerun)
- Non-escalated build in this environment still hits sandbox `spawn EPERM`.

### Known issues
- In this environment, non-escalated production build can fail with `spawn EPERM`; escalated build succeeds.
- Supabase table must exist and service role key must be present in production env, or public page API will return server errors by design.

## Update 2026-04-18 (strict Supabase public-page persistence)

### Changed files
- `src/lib/server/public-pages-store.ts`
- `src/components/public/public-profile-page-client.tsx`
- `.env.example`
- `docs/AI_HANDOFF.md`

### Behavior change
- Public page persistence now uses Supabase only for API-backed public data:
  - `GET /api/public-pages/[slug]`
  - `PUT /api/public-pages/[slug]`
  - `DELETE /api/public-pages/[slug]`
- Removed public page fallback to localStorage in `PublicProfilePageClient`; public slug pages now depend on API/Supabase data for cross-device consistency.
- Admin save/autosave flow remains unchanged and still publishes to `/api/public-pages/[slug]`, which persists to Supabase.
- Support form logic and Google Sheets deposit/withdraw flow are unchanged.

### Env setup (required)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### SQL / schema setup
Run in Supabase SQL editor:

```sql
create table if not exists public.public_pages (
  slug text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists public_pages_updated_at_idx
  on public.public_pages (updated_at desc);
```

Optional but recommended trigger to keep `updated_at` fresh on updates:

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_public_pages_updated_at on public.public_pages;
create trigger set_public_pages_updated_at
before update on public.public_pages
for each row
execute function public.set_updated_at();
```

RLS note:
- If RLS is enabled on `public.public_pages`, add policies that allow the service role to read/write rows. The API uses `SUPABASE_SERVICE_ROLE_KEY`.

### Lint result
- `npm run lint`: PASS

### Build result
- `npm run build`: PASS (after escalated rerun)
- Non-escalated build in this environment still hits sandbox `spawn EPERM`.

### Known issues
- In this environment, non-escalated production build can fail with `spawn EPERM`; escalated build succeeds.
- Missing Supabase env or missing `public.public_pages` table will cause public page API requests to fail.

## Update 2026-04-18 (Supabase envs from .env.local active)

### Changed files
- `src/lib/server/public-pages-store.ts`
- `src/app/api/public-pages/[slug]/route.ts`
- `src/components/public/public-profile-page-client.tsx`
- `.env.example`
- `docs/AI_HANDOFF.md`

### Behavior change
- Public page API persistence is Supabase-backed using configured envs:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Public API shape is preserved:
  - `GET /api/public-pages/[slug]`
  - `PUT /api/public-pages/[slug]`
  - `DELETE /api/public-pages/[slug]`
- Admin save/autosave continues publishing through `PUT /api/public-pages/[slug]`, now persisting to Supabase.
- Public slug rendering no longer depends on localStorage fallback; cross-device reads come from API/Supabase.
- Support form logic and Google Sheets deposit/withdraw flow remain unchanged.

### SQL / schema setup
```sql
create table if not exists public.public_pages (
  slug text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists public_pages_updated_at_idx
  on public.public_pages (updated_at desc);
```

### Lint result
- `npm run lint`: PASS

### Build result
- `npm run build`: PASS (after escalated rerun)
- Non-escalated build in this environment still hits sandbox `spawn EPERM`.

### Known issues
- In this environment, non-escalated production build can fail with `spawn EPERM`; escalated build succeeds.
- If Supabase table/schema is missing, public page API will fail until the SQL setup is applied.

## Update 2026-04-18 (dedicated admin route)

### Changed files
- `src/app/admin/page.tsx`
- `docs/AI_HANDOFF.md`

### Behavior change
- Added dedicated production editor route at `/admin`.
- `/admin` now renders existing `AdminShell` directly.
- Root route `/` remains unchanged and still redirects to `/110`.
- No changes made to support form logic, Google Sheets deposit/withdraw flow, public page Supabase persistence, save/reset/restore behavior, or autosave logic.

### Lint result
- `npm run lint`: PASS

### Build result
- `npm run build`: PASS (after escalated rerun)
- Non-escalated build in this environment still hits sandbox `spawn EPERM`.

### Known issues
- In this environment, non-escalated production build can fail with `spawn EPERM`; escalated build succeeds.
- Public page `/110` still requires a published row in Supabase (`public.public_pages`) to render content.

## Update 2026-04-18 (public pages list export fix)

### Changed files
- `src/lib/server/public-pages-store.ts`
- `docs/AI_HANDOFF.md`

### Behavior change
- Added and exported `listPublicPages` in server store.
- `listPublicPages` now reads from Supabase `public.public_pages` via admin client and returns rows for API list responses.
- Returned fields include at least:
  - `slug`
  - `updated_at` (when present)
  - `data` (kept for existing My Pages UI compatibility)
- Existing exports remain unchanged:
  - `getPublicPageBySlug`
  - `upsertPublicPage`
  - `removePublicPageBySlug`
- No changes made to support form logic, Google Sheets flow, `/` redirect behavior, or `/admin` route.
