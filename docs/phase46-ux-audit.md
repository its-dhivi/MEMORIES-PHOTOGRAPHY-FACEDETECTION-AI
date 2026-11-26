# Phase 4.6 UX audit

## Scope and evidence

The Phase 4.5 application was inspected from the running Docker Compose build on 20 November 2026. The web application, API, PostgreSQL, Redis, and private object storage were running locally. Deterministic Playwright fixtures were used for authenticated views because no reusable administrator credentials are committed to the repository; the fixtures exercise the real Next.js pages and components while returning representative tenant-scoped API responses.

Baseline captures are stored in [`docs/screenshots/phase45-before`](./screenshots/phase45-before). They cover the dashboard, event library, event workspace, processing, analytics, guest event landing, and kiosk at 390 px, 1024 px, and 1440 px where appropriate. The capture test is [`e2e/phase46-baseline-capture.spec.ts`](../e2e/phase46-baseline-capture.spec.ts).

## Route and journey inventory

### Public and authentication

- `/` public product introduction
- `/login`, `/forgot-password`, `/reset-password`

### Photographer workspace

- `/dashboard`
- `/dashboard/events`, `/dashboard/events/new`
- `/dashboard/events/[eventId]`
- `/dashboard/events/[eventId]/photos`
- `/dashboard/events/[eventId]/qr`
- `/dashboard/events/[eventId]/settings`
- `/dashboard/photographs`
- `/dashboard/processing`
- `/dashboard/analytics`
- `/dashboard/settings`

### Guest and kiosk

- `/e/[slug]`, `/e/[slug]/access`, `/e/[slug]/privacy`
- `/e/[slug]/selfie`, `/e/[slug]/searching`, `/e/[slug]/results`
- `/booth/[slug]`

The route model is serviceable and should remain compatible. The problem is the presentation model: photographer, guest, and kiosk journeys currently share too much of the same visual vocabulary despite having very different intent and context.

## What Phase 4.5 gets right

- Authorization, guest sessions, consent, CSRF handling, secure downloads, and storage boundaries remain separated from presentation.
- Event and processing states are sourced from real APIs and are not fabricated.
- Navigation labels cover the major product capabilities.
- Primary routes provide loading, empty, and error states.
- The guest flow clearly states that matching is scoped to one event.
- Kiosk completion revokes consent and clears the session.

## Problems observed

### Information architecture and navigation

1. The desktop sidebar treats every capability as an equal destination. It does not reflect the photographer's sequence of creating, uploading, checking readiness, and sharing.
2. “Command center” and “AI processing” introduce technical language where task language would be clearer.
3. The AI operations callout occupies permanent navigation space but is not actionable.
4. The top search control appears global but has no implemented search behavior, creating a false affordance.
5. Mobile replaces the sidebar with a drawer but otherwise preserves the desktop hierarchy. The photographer receives no persistent task-oriented mobile navigation.

### Photographer dashboard

1. Nine equally weighted KPI cards dominate the page. The primary question—what should I work on now?—is not answered.
2. Active events, upload progress, and share readiness are below generic totals even though they are the most actionable content.
3. The desktop composition resembles administrative reporting software rather than a creative studio workspace.
4. On 390 px, the metrics become a long vertical sequence. The useful recent-event content appears several screens below the fold.
5. Identical card treatments flatten hierarchy and make critical failures visually equivalent to passive totals.

### Event library and event workspace

1. Event cards are conventional fixed-ratio SaaS cards. Photography is present but subordinate to chrome, status pills, and action rows.
2. Grid and list controls are visually subtle and the list mode does not establish a clearly different scanning model.
3. Destructive actions remain visible on every card, increasing clutter and accidental-action risk.
4. The event workspace repeats the same pattern as the dashboard: hero card, tabs, three metric cards, content card, actions card.
5. Upload, readiness, access, and sharing do not form an explicit event lifecycle. The user has to infer the next step.
6. Cover imagery is heavily darkened, reducing the emotional identity of each collection.

### Photo, upload, processing, and analytics workflows

1. Upload is embedded inside photo management instead of being treated as a sustained workflow with a clear transition from transfer to indexing.
2. The processing page repeats eleven statistic cards before showing operational activity. Worker readiness is low in the hierarchy.
3. The job table is useful on desktop but does not translate to a task-oriented mobile experience.
4. Analytics uses card containers for every region and a decorative gradient chart. It does not prioritize engagement, event performance, or change over time.
5. Technical labels such as `FACE_INDEX`, raw status names, and millisecond duration are not translated for photographers.

### Guest event experience

1. The guest landing is a dark hero card followed by another floating glass card. It still reads as a software funnel rather than opening an album.
2. The title competes with “Your moments are waiting” and the instructional card. Event photography is heavily overlaid and visually muted.
3. Numbered instructions and “Let AI search” foreground the mechanism rather than the guest's emotional outcome.
4. The guest header is too similar to application navigation and consumes valuable mobile height.
5. The purple CTA and dark glass surface visually connect the guest journey to the photographer dashboard when they should feel distinct.

### Kiosk

1. The welcome screen is essentially a scaled-up dark landing page. It does not use the event cover or venue context.
2. The central camera icon and AI-adjacent dark grid create a technology-demo tone.
3. Large empty areas are not used to create a two-person or guided touchscreen composition.
4. The primary touch action is smaller than expected for a standing tablet interaction.
5. The searching state uses orbiting rings, conflicting with the requested calm photography language.

### Visual hierarchy and consistency

1. Nearly every region is a rounded card with a border. Container repetition weakens hierarchy.
2. Serif headings are used at almost every level, so editorial typography no longer signals a special moment.
3. Low-contrast gray text on near-black surfaces is difficult to scan, especially in processing and analytics captures.
4. Purple and cyan accents imply a generic AI product and compete with the photography brand.
5. Multiple local component treatments mix light utility classes with global dark theme overrides, making intent difficult to maintain.

### Interaction, feedback, and accessibility

1. Several icon-only actions depend on `title` rather than an always-visible label or robust menu pattern.
2. The desktop collapse control is not useful enough to justify permanent prominence.
3. Mobile pages can become extremely long without section navigation or a prioritised summary.
4. Tables require horizontal scrolling without a mobile alternative.
5. Some secondary text and inactive controls are below a comfortable contrast level in screenshots.
6. Focus states are not consistently distinct from hover states on dark surfaces.
7. Motion exists primarily as page fade, card hover, and AI-themed loops rather than communicating workflow transitions.

## Redesign principles derived from the audit

1. Organize photographer navigation around **Work**, **Library**, **Delivery**, and **Studio**, while retaining existing URLs.
2. Replace the generic sidebar with a compact studio rail plus contextual page header and a purpose-built mobile dock.
3. Make the dashboard an editorial work queue: active-event spotlight, next actions, recent albums, and concise studio pulse.
4. Treat each event as a collection with a visible lifecycle: identity → photographs → processing → sharing → engagement.
5. Let photography provide structure and color; use containers only when they clarify interaction.
6. Give guests an album-like, light-first sequence with one clear action per moment.
7. Design the booth as a venue-specific, two-panel tablet experience with extremely large touch targets and explicit secure reset.
8. Use motion for continuity, selection, progress, and completion; remove decorative AI scanning effects.
9. Keep all existing API and security contracts intact. Redesign presentation and interaction without weakening privacy.

## Success criteria for Phase 4.6

- The dashboard no longer begins with a metric-card grid.
- Event management is image-led and supports both visual browsing and concise scanning.
- Event detail communicates the next task without requiring the user to inspect multiple cards.
- Guest pages do not reuse dashboard cards or navigation.
- Kiosk composition is recognizably designed for a tablet at a venue.
- Mobile content order differs intentionally from desktop and avoids KPI-induced page length.
- Final screenshots at 390 px, 1024 px, and 1440 px demonstrate structural—not merely stylistic—change.
