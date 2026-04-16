# AI Handoff

## Current goal
Stabilize Hero vs Classic header rendering so Hero is a true banner layout, never blank, and shared consistently across preview/public behavior.

## Last completed
- Extracted shared header media fallback helpers and shared header renderer.
- Wired `MobilePreview` to use shared header renderer for both Classic and Hero.
- Preserved existing fallback behavior:
  - Hero prefers `heroImageUrl`, falls back to `avatarUrl`, then placeholder.
  - Classic uses `avatarUrl` with placeholder fallback.
- Kept autosave, saved profiles manager, reset/restore, and no-overwrite slug logic unchanged.

## Changed files
- `src/components/preview/mobile-preview.tsx`
- `src/components/profile/profile-header.tsx`
- `src/features/builder/utils/header-media.ts`
- `docs/AI_HANDOFF.md`

## Behavior change
- Header layout rendering is now centralized in `ProfileHeader`:
  - `layout === "classic"` renders compact circular avatar header.
  - `layout === "hero"` renders banner/cover hero header with hero text alignment + overlay settings.
- Shared media helper (`header-media.ts`) now provides consistent, safe header image resolution and fallback logic.
- Header rendering path now has explicit separated layout logic and avoids blank hero header state by design.

## Lint result
- `npm run lint`: PASS

## Build result
- `npm run build`: PASS (required escalated run due sandbox `spawn EPERM` on non-escalated execution)

## Known issues
- In this environment, non-escalated production build may fail with `spawn EPERM`; escalated build is green.

## Next recommended step
1. Browser smoke test: switch Classic/Hero repeatedly and confirm `avatarUrl` and `heroImageUrl` remain intact in state.
2. Verify hero fallback visually with each case: hero image present, hero image missing + avatar present, both missing.
