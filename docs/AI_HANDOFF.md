# AI Handoff

## Current goal
Implement current priority items with minimal/safe edits:
1. Embed Post / Social Embed block clarity
2. EN / TH language switch availability
3. Clear destructive action copy and typed confirmations

## Last completed
- Kept existing `embed_post` behavior intact and updated user-facing wording to "Social Embed".
- Added/expanded EN/TH language toggle visibility on public pages.
- Improved destructive dialog copy and added stricter typed confirmations:
  - Data Tools `clear current route` now requires typing `/{slug}`.
  - Saved Profiles delete now requires typing `/{slug}`.

## Changed files
- `src/i18n/en.ts`
- `src/i18n/th.ts`
- `src/features/builder/utils.ts`
- `src/components/admin/data-tools-card.tsx`
- `src/components/admin/save-status-bar.tsx`
- `src/components/admin/saved-profiles-manager-card.tsx`
- `src/components/public/public-profile.tsx`
- `src/components/public/public-profile-page-client.tsx`

## Behavior change
- Labels changed from "Embed Post" to "Social Embed" in UI text only (data model/content type remains `embed_post`).
- Language switch now has explicit "Language/ภาษา" label and is available on public profile and public missing-profile states.
- Destructive flows are clearer and stricter:
  - Clear current route requires exact typed `/{slug}` + PIN (if enabled).
  - Delete saved route requires exact typed `/{slug}`.
  - Confirmation copy now explicitly states permanent removal scope.

## Lint result
- `npm run lint`: PASS

## Build result
- `npm run build`: FAIL
- First attempt failed with `spawn EPERM` in sandbox.
- Escalated run proceeded further, then failed during prerender:
  - `Error occurred prerendering page "/_global-error"`
  - `TypeError: Cannot read properties of null (reading 'useContext')`
- Additional warnings observed during build:
  - non-standard `NODE_ENV`
  - repeated React key warnings in Next internal render boundaries

## Known issues
- Production build currently fails at prerendering `/_global-error` with `useContext` null.
- Environment warning: non-standard `NODE_ENV`.
- Repeated React key warnings appear during build output.

## Next recommended step
- Isolate and fix the `/_global-error` prerender issue first (likely independent baseline issue), then rerun `npm run build` and verify no regressions in destructive flows and language switching.