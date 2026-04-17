# AI Handoff

## Current goal
Build two operational in-site support forms (deposit issue / withdraw issue) using the existing Form block system, with server-side submission handling and mobile-first UX.

## Last completed
- Added two fixed support templates inside Form flow:
  - `deposit_issue` (`ฝากเงินไม่เข้า`)
  - `withdraw_issue` (`ถอนเงินไม่ได้`)
- Added support defaults in template factory:
  - Thai title/intro/outro
  - Thai submit button
  - sensible preset fields for each support type
- Extended Form field model with `file_image` type for deposit slip upload.
- Kept Form inside Links system and add flow:
  - add-picker now includes support form templates
  - form template dropdown now includes support templates
  - form field type dropdown includes image upload
- Added support-specific labels in Links list:
  - Support Deposit / Support Withdraw
- Public form UX updates:
  - submit inside site (no redirect)
  - inline validation and submit error state
  - disable submit while submitting
  - retry + cancel controls
  - success state remains in modal with readable mobile layout
  - deposit form supports image-only slip upload with size/type checks and contained preview
- Added server-side submission flow (not localStorage):
  - `POST /api/support/deposit-issues` (multipart + slip upload)
  - `POST /api/support/withdraw-issues` (JSON)
  - submissions stored in server-local dev JSON store
  - uploaded slips stored in server-local dev file path

## Changed files
- `src/features/builder/types.ts`
- `src/features/builder/schema.ts`
- `src/features/builder/utils.ts`
- `src/components/admin/sections/links-section.tsx`
- `src/components/preview/mobile-preview.tsx`
- `src/i18n/en.ts`
- `src/i18n/th.ts`
- `src/lib/server/support-submissions-store.ts`
- `src/app/api/support/deposit-issues/route.ts`
- `src/app/api/support/withdraw-issues/route.ts`
- `docs/AI_HANDOFF.md`

## Behavior change
- Form block now supports two fixed support presets with operational in-site submission.
- Deposit issue supports required image slip upload; withdraw issue is text-only.
- Submissions are handled server-side and are no longer just local success simulation for support templates.
- Builder autosave/save-reset/restore/profile manager/slug no-overwrite flow remains unchanged.

## Lint result
- `npm run lint`: PASS

## Build result
- `npm run build`: PASS (required escalated run due sandbox `spawn EPERM` on non-escalated execution)

## Known issues
- In this environment, non-escalated production build may fail with `spawn EPERM`; escalated build succeeds.
- Submission storage is currently local-dev file based:
  - `data/support-submissions.dev.json`
  - `data/support-uploads/...`
- Browser-local image refs (`idbimg:`) remain browser-scoped and are not cross-device assets.
- Google Sheets integration is not yet implemented (current code is adapter-ready at API/store layer).

## Next recommended step
1. Add a submission adapter interface implementation for Google Sheets (or webhook) behind environment-based config.
2. Add a lightweight admin-only dev viewer endpoint/page for support submissions to verify operations quickly.
3. Add rate-limit / abuse guard middleware for support submission endpoints before production deployment.
