# Phase 4.6 experience reimagination

## Structural changes

Phase 4.6 replaces the Phase 4.5 theme-led redesign with separate interaction models for photographers, guests, and kiosk users while retaining the existing routes and API contracts.

### Photographer workspace

- Replaced the wide collapsible sidebar with a compact 92px studio rail.
- Added a task-focused mobile dock and retained a full accessible navigation drawer.
- Removed the non-functional global search affordance and permanent AI operations promotion.
- Rebuilt `/dashboard` around an active collection, next actions, operational attention, recent album covers, and a quiet studio pulse. Passive totals no longer lead the page.
- Rebuilt `/dashboard/events` as an image-led event library with album-cover cards, contextual action menus, and a distinct list view.
- Rebuilt `/dashboard/events/[eventId]` as a collection workspace with an event identity hero, an explicit next step, lifecycle navigation, and sharing/access actions.
- Reworked event creation into a guided identity-first composition with progressive follow-on steps.
- Reworked uploads into a split workspace that distinguishes selection, transfer, verification, and later AI indexing.
- Reworked photograph management into a natural-proportion gallery with reduced interface chrome.
- Reworked processing into a calm operational timeline with truthful model availability.
- Reworked analytics into an editorial data layout with fewer decorative containers.
- Reworked QR sharing as a print-oriented invitation layout with preserved quiet zone and existing PNG/SVG exports.

### Guest journey

- Rebuilt `/e/[slug]` as an asymmetric editorial event composition led by cover photography.
- Rebuilt consent as a two-part privacy explanation and explicit action; consent remains unchecked by default.
- Rebuilt selfie capture as a split instruction/camera experience with a larger preview and calm controls.
- Replaced AI scanning rings with a restrained photographic exposure/focus loading treatment.
- Rebuilt results as a borderless personal album using natural image proportions and the existing authorized result set.
- Preserved the accessible fullscreen viewer, keyboard controls, zoom, and authorized downloads.

### Kiosk

- Rebuilt `/booth/[slug]` for tablets as a two-panel venue experience using event imagery and a large primary touch action.
- Replaced the technology-demo loading treatment with a quiet photographic transition.
- Preserved consent withdrawal, browser-history handling, camera cleanup, and secure session reset.

## Typography decision

DM Sans and Cormorant Garamond were reviewed in mobile, tablet, and desktop compositions. DM Sans was selected for UI legibility and compact controls; Cormorant was selected for event titles and album-like display moments. Both are self-hosted by Next.js and no third primary family is used.

## Accessibility and performance

- Automated axe checks pass for the public home and login pages.
- The champagne accent was darkened for task-critical small text after automated contrast review.
- Primary actions and navigation targets meet or exceed 44px; kiosk actions are substantially larger.
- Reduced-motion preferences remain honored.
- Galleries continue to use authorized thumbnail and preview URLs, lazy loading, pagination, and no eager full-resolution fetch.
- CSS columns preserve image proportions without adding a gallery dependency.

## Validation evidence

- Frontend unit tests: 4 passed.
- Backend unit tests: 20 passed.
- Playwright: 12 passed, 1 skipped because Phase 2 administrator credentials were not provided.
- Next.js production build: passed.
- TypeScript strict check: passed.
- ESLint: passed with existing `no-img-element` advisory warnings for presigned/private images.
- Visual capture suite: 5 passed across mobile, desktop, and tablet kiosk compositions.
- Public visual regression suite: 3 passed at 390px, 768px, and 1440px.

## Evidence

- [UX audit](./phase46-ux-audit.md)
- [Design system](./design-system.md)
- [Phase 4.5 before captures](./screenshots/phase45-before)
- [Phase 4.6 after captures](./screenshots/phase46-after)

## Known limitations

- The deterministic authenticated screenshots use real pages with fixture API responses because reusable administrator test credentials are intentionally not committed.
- Actual recognition still requires commercially licensed model weights; the interface reports an unavailable model truthfully.
- Browser camera behavior depends on HTTPS, device permissions, and the mobile browser. Automated tests cover permission handling and file-upload fallback, not every physical camera.
- The existing private-image delivery model uses expiring URLs, so `next/image` is intentionally not introduced without a stable loader/cache policy.
