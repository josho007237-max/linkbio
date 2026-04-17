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
