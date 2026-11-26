# Memories Photography design system

## Direction

Phase 4.6 uses **Modern Luxury × Editorial Photography × Effortless Software**. The interface is intentionally light-first and relies on composition, negative space, type scale, and event imagery instead of decorative technology motifs. AI remains an underlying capability and is named only where it helps explain processing or privacy.

## Foundations

- Canvas: warm ivory `#FAF9F6`
- Surface: white `#FFFFFF`
- Secondary surface: soft stone `#F3F0EB`
- Primary text: warm charcoal `#252522`
- Secondary text: accessible warm gray `#696660`
- Accent: dark champagne `#765F45` for small text and UI; lighter champagne may be used decoratively where contrast is not required
- Border: `#E8E4DD`
- Success: `#53705A`; warning: `#9A6B2F`; error: `#9D4848`

Surfaces are not cards by default. Borders, dividers, and whitespace establish hierarchy; elevated containers are reserved for overlays, invitations, and focused workflows.

## Typography

- **DM Sans**: application UI, forms, body copy, navigation, data labels, and controls
- **Cormorant Garamond**: editorial display headings, event titles, collection counts, and emotionally important moments

Both families are self-hosted through `next/font`. Cormorant is used selectively at 400–600 weights. Body copy is at least 16px in reading contexts; task controls are at least 14px. Numeric values use tabular alignment where dense comparison matters.

DM Sans was selected over Manrope and Plus Jakarta Sans because its open forms remained more legible in the 390px compositions while retaining a quiet editorial tone. Cormorant Garamond provides a recognizably photographic personality without requiring a third family. The pairing was reviewed in the dashboard, guest landing, and kiosk captures at mobile, tablet, and desktop sizes.

## Layout model

### Photographer workspace

- A 92px desktop studio rail provides stable navigation without consuming album space.
- The page header carries studio context and the global “New event” action.
- Mobile uses a six-action bottom dock plus a complete navigation drawer.
- Page composition follows the photographer lifecycle: active work, next action, operational attention, recent collections, then passive metrics.

### Guest journey

- Guest pages use a distinct album-oriented shell and minimal header.
- One decision is presented per moment: enter, consent, capture, wait, view.
- Event imagery leads; software chrome remains secondary.

### Kiosk

- Tablet layouts use a two-panel venue composition with event cover imagery and large touch targets.
- Every completion returns to the welcome stage and revokes the prior guest session.

## Components

- Primary actions are charcoal pill buttons with at least 44px touch height.
- Secondary actions use a quiet outline and no decorative arrow glyphs.
- Event covers use edge-to-edge imagery, metadata overlays, and contextual menus.
- Event tabs use a simple baseline indicator and horizontal scrolling on narrow screens.
- Uploads use a split transfer workspace: selection on the left, real queue/progress on the right.
- Galleries favor natural image proportions and CSS columns over repeated square cards.
- QR output uses a print-oriented invitation surface and preserves the QR quiet zone.
- Operational states use text, icons, and structure; color is never the only signal.

## Motion

- Route content uses a restrained 280ms opacity/translation transition.
- Photography reveals may use a 650ms mask transition.
- Hover zoom is capped at roughly 1.02–1.035.
- Searching uses a soft photographic exposure/focus treatment, never scanning rings or invented percentages.
- `prefers-reduced-motion` reduces animations and transitions to effectively instantaneous behavior.

## Accessibility

- Focus is a 2px dark-champagne outline with 3px offset.
- Regular controls and primary touch targets are at least 44px.
- Small champagne text uses the darker accessible accent.
- Dialogs and the fullscreen viewer retain semantic roles, Escape handling, keyboard navigation, and labelled controls.
- Consent remains explicit and unchecked by default.
- Automated axe audits cover the public home and login pages; visual review covers 390px, 1024px, and 1440px compositions.

## Screenshot evidence

- Phase 4.5 baseline: [`docs/screenshots/phase45-before`](./screenshots/phase45-before)
- Phase 4.6 result: [`docs/screenshots/phase46-after`](./screenshots/phase46-after)
- Audit and structural findings: [`docs/phase46-ux-audit.md`](./phase46-ux-audit.md)
