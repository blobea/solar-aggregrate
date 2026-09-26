# CLAUDE.md — conventions for this repo

Clickable demo of a neutral rooftop-solar comparison platform for Bangalore. There is no backend; everything runs in the browser. All data is fictional sample data. Label the app "Demo — sample data".

## Stack (don't add to it without a strong reason)
- Vite + plain HTML/CSS + ES modules + **Alpine.js**.
- No TypeScript build. Use JSDoc types with `// @ts-check` at the top of every JS file. `npm run typecheck` runs tsc over them.
- Allowed libraries: Alpine.js, Tabulator (price grid), SheetJS/xlsx (Excel), Leaflet (map, OSM tiles), Chart.js (savings chart). Lazy-load the heavy ones (`await import(...)`) inside the screen or lib that uses them.
- Tests: Vitest (`engine/**/*.test.js`, `tests/unit/**`) and Playwright (`tests/e2e/*.spec.js`).

## Layout and size rules
- No file over ~400 lines. Split into `app/lib/*` helpers instead.
- One folder per screen: `app/screens/<name>/screen.html` + `screen.js`. `screen.js` does `import template from './screen.html?raw'`, `export { template }`, and `export default function (params, query) { return { ...alpine component } }`. The router wraps the template in a fresh `x-data` and loads screens lazily via `import.meta.glob`.
- Register routes in `app/router.js` (`ROUTES`) and nav items in `app/main.js` (`NAV`).
- Styles: design tokens live **only** in `app/styles/tokens.css`. Also `base.css` (elements, shell, forms), `components.css` (reusable) and `screens.css` (screen-specific). No inline colours; use `var(--c-*)`.
- Mobile-first. Everything must work at 360 px wide with no horizontal page scroll (wide tables scroll inside `.table-wrap`). Light theme. Every input has a label; keep focus-visible outlines and the 44 px tap target.

## Data flow rules
- **The engine (`engine/`) is pure.** No DOM, no storage, no `Date.now()`: callers pass `now`. It must run unchanged on a server.
- **All data goes through `app/api/*.js`** (import from `app/api/index.js`). Screens never touch `localStorage`. `api/store.js` is the only storage module, so swapping to Supabase means replacing it (plus `auth.js`) and keeping exported function names and shapes.
- API functions are `async` and simulate latency with `delay()`. Return deep clones.
- Seed JSON lives in `data/seed/`. Relative dates are written `"@-40d"` / `"@+30d"` and resolved at seed time (`seed-dates.js`).
- The demo clock is `store.now()` (real time + offset). "Advance time" moves the offset.

## Product invariants (tests rely on these)
- Estimates shown to a customer are **appended** to the estimates log and never edited. Leads snapshot the logged estimate.
- The customer UI never receives a vendor's price sheet, only computed estimates (`estimates.getEstimates` returns cards with line items). Price-sheet API functions are for the vendor/ops screens only.
- Every price is all-in. Fixed charges are always included. Show "Indicative estimate from the vendor's price sheet; final price after site survey." (`PRICE_DISCLAIMER`).
- The subsidy is computed by the platform (`engine/subsidy.js`): DCR only; ₹30k/kW for the first 2 kW, ₹18k for the 3rd kW, capped at ₹78k.
- Stale sheets (`validUntil` passed) get a warning and rank below fresh ones. They are never hidden.
- Sponsored: at most 1 slot above the list, labelled "Sponsored"; only for a fresh sheet and rating ≥ 3.5. It never changes the organic order, reviews or accuracy, and the vendor also appears in its organic position.
- Reviews: the same 72-hour check applies to every review. Negative reviews are never auto-hidden. Any score ≤ 2 needs a reason code. `discom_delay` and `subsidy_portal_delay` are shown but excluded from the vendor score. Only Ops removes a review, via a dispute (`removed | annotated | stands`).
- Ranking weights live in one object (`RANKING_WEIGHTS` in `engine/ranking.js`), and the How-we-rank page renders it directly.

## Auth (demo)
- Phone login; the OTP is always `123456`. Role switcher (Customer / Vendor / Ops) sits in the top demo bar. Visiting a route of another role switches the role automatically.

## Workflow
- Change the engine → add or adjust Vitest tests → `npm test`.
- Change the UI flow → keep `tests/e2e/demo.spec.js` green (`npm run e2e`) and keep `data-testid` hooks stable.
- After visual changes, run `npm run screenshots` and look at `docs/screenshots/*` for 390 px and 1280 px layout issues.
- Commit after each coherent stage.
