# AI Handoff

## Current goal
Build the actual Form block editor UI inside the existing Links editing/settings flow.

## Last completed
- Form block editor is now fully available in `LinksSection` within existing edit/settings flow:
  - form title, intro, outro/thank-you, layout (classic/featured), optional T&Cs placeholder
  - field list, add/remove, reorder (up/down), required toggle
  - field type selector covering:
    - name, email, phone, country, date_of_birth
    - short_answer, paragraph, single_choice, checkboxes, dropdown, date
- Template behavior is wired:
  - Contact Form: sensible contact defaults
  - Email Sign Up: email-focused default field(s)
  - SMS Sign Up: phone-focused default field(s)
  - Custom Form: minimal starter field
- Form items remain in same Links list behavior as other content types:
  - enable/disable, edit, settings, delete, drag-reorder
- Type label path shows form as `FORM · CLASSIC` / `FORM · FEATURED` via existing uppercase badge style.
- Form submissions are runtime-only in preview/public UI and are not persisted into builder localStorage payload.

## Changed files
- `src/components/admin/sections/links-section.tsx`
- `src/features/builder/types.ts`
- `src/features/builder/schema.ts`
- `src/features/builder/utils.ts`
- `src/components/preview/mobile-preview.tsx`
- `src/i18n/en.ts`
- `src/i18n/th.ts`
- `docs/AI_HANDOFF.md`

## Behavior change
- Form content type now has a complete in-place editor and public modal form experience while staying inside the Links system.
- Existing link/discount/embed flows remain unchanged.

## Lint result
- `npm run lint`: PASS

## Build result
- `npm run build`: PASS (required escalated run due sandbox `spawn EPERM` on non-escalated execution)

## Known issues
- In this environment, non-escalated production build may fail with `spawn EPERM`; escalated build is green.
- V1 forms are schema/config + client validation only. There is no backend submission destination yet.

## Next recommended step
1. Add optional submission destination (webhook/API) for real form delivery with explicit opt-in.
2. Add field-level analytics hooks for form open/submit/success events.
3. Add stronger per-field validation patterns for country/date_of_birth based on locale rules.
