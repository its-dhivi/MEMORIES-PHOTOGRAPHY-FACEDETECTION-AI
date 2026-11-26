# Phase 4.5 UX redesign audit

## Existing experience

The frontend contains a public product page, three authentication routes, a shared photographer dashboard, event CRUD and detail tabs, upload/photo management, processing, analytics, QR generation, six guest routes, and a secure guest BFF. The API integrations, tenant authorization, session cookies, consent, upload queue, and download authorization are already functional and must remain unchanged.

## Weaknesses observed

- Visual identity is split between an ivory guest/editorial theme and a generic light dashboard. Brand hierarchy and product naming are inconsistent in navigation.
- Typography relies on system fonts and Georgia without an optimized scale or technical metadata face.
- Dashboard cards, filters, tables, forms, loading states, and empty states are functional but visually repetitive and lack a clear information hierarchy.
- Navigation has no global search affordance, system-readiness cue, or polished responsive drawer treatment.
- Motion is limited to spinners and pulse utilities. There are no shared entrance, stagger, dialog, or reduced-motion primitives.
- Photographer galleries use minimal chrome but selection, status, and hover actions are difficult to discover on touch devices.
- The guest camera works but lacks a positioning guide and photo-booth framing. The results viewer lacks focus trapping and zoom.
- QR output is technically correct but the screen does not present it as a premium shareable event asset.
- No kiosk route exists. A tablet flow must isolate each guest and explicitly revoke authorization before reset.

## Redesign response

The new system uses a dark-first `Cinematic Intelligence` identity, optimized fonts, semantic CSS variables, a restrained violet/cyan AI spectrum, warm-gold editorial accents, shared motion primitives, stronger focus rings, larger touch targets, and explicit status treatments. Existing APIs and authorization logic are preserved.

## Known constraints

- No approved stock photography is bundled; presentation uses abstract light, real event covers, and private authorized thumbnails rather than unlicensed imagery.
- Recognition-dependent screens truthfully show model readiness from the backend. No accuracy, customer, or match-rate claims are introduced.
- Charts remain dependency-light and render only real aggregate values.
