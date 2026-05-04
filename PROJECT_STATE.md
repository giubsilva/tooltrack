# ToolTrack

## What this is
A lightweight tool-location tracker for field crews at Fossil Landscape. Workers use it on their phones to log where physical tools are across job sites, move tools between sites, and view the full move history. There is no server or database — all data lives in a Google Sheet, and the frontend is hosted as a static file on GitHub Pages.

**Live app:** https://giubsilva.github.io/tooltrack/

## Current status
- Fully deployed and working at the live URL above. **Admin layer shipped 2026-05-04.**
- `doGet` returns tools, move log, and job sites (unauthenticated).
- `doPost` handles crew action `move` (crew PIN) and admin actions `addTool`, `editTool`, `decommissionTool`, `deleteTool`, `bulkMove`, `addSite`, `removeSite` (admin PIN).
- Frontend has four crew tabs: Tools, By Site, Move Log (Sites+ removed — admin only). Admin tab appears after admin PIN auth.
- XSS protection in place: all user data rendered via `esc()`, event handlers use `data-*` attributes and event delegation.
- Input validation on all text inputs: required fields, `maxlength` attrs, character allowlist, backend `sanitizeText()`.
- 38 unit tests pass for all utility functions in `src/utils.js` (including `buildCsv`).
- Playwright E2E tests cover load, search/filter, move flow, PIN prompt, and admin tab behavior — no live Sheet required (API is mocked).

## Stack
- **Frontend**: Vanilla JS, single `index.html`, no build step, no frameworks
- **Backend**: Google Apps Script deployed as a Web App (`doGet` / `doPost`)
- **Database**: Google Sheets (3 tabs: `ToolInventory`, `MoveLog`, `JobSites`)
- **Hosting**: GitHub Pages (static)
- **Auth**: PIN stored in Apps Script `PropertiesService`; sent in every POST body; cached in `localStorage`
- **Testing**: Jest 29 + jsdom (unit), Playwright 1.44 (E2E)

## Architecture
```
Browser (index.html)
  │
  ├── src/utils.js          Pure functions: esc, locClass, siteNames, filterTools,
  │                         filterSites, filterLog, buildCsv
  │                         (loaded by both index.html and the Jest test suite)
  │
  └── Google Apps Script    Web App URL in CONFIG.scriptUrl
        │  doGet  → returns { tools, log, sites } — no auth
        │  doPost (crew PIN)  → move
        │  doPost (admin PIN) → addTool | editTool | decommissionTool | deleteTool
        │                       bulkMove | addSite | removeSite
        └── Google Sheet
              ├── ToolInventory   Name | Notes | Location
              ├── MoveLog         ToolName | FromLocation | ToLocation | MovedBy | MoveTime
              └── JobSites        SiteName | AddedBy | AddedAt
```

**localStorage keys**: `tt_pin` (crew PIN), `tt_admin_pin` (admin PIN), `tt_worker_name` (pre-fills name fields).

**Action bar** swaps content per tab: Tools/By Site/Move Log show the search+filter bar. Sites+ removed from crew nav — site management is admin-only.

## Decisions made
- **No server, no database** — Google Sheets as the backend removes all hosting costs and maintenance. Acceptable for a small crew with low write volume.
- **Single shared PIN** — simpler than per-user accounts. If compromised, reset by re-running `setupPin()`. The PIN is server-side only; the browser stores it in `localStorage` for convenience.
- **Reads are unauthenticated** — anyone with the Apps Script URL can read tool data. Accepted risk for a non-sensitive internal tool.
- **`esc()` + `data-*` attributes for XSS** — user-controlled strings are never interpolated into event handler attributes; all rendering uses `data-*` + event delegation.
- **`src/utils.js` extracted** — separating pure functions into a module makes them testable in Node.js without a browser.
- **E2E tests mock the API** — no live Google Sheet required to run tests; the Playwright suite intercepts fetch calls.

## Blockers and pending
- No rate limiting beyond Apps Script's built-in daily quotas.
- `setupPin()` is still present in `apps-script.js` as a placeholder — must be deleted after running once in the deployed script.
- No CI configuration — tests run locally only.
- The `index.html` frontend script block is not covered by unit tests (only `src/utils.js` is); the rendering and API-call logic in `index.html` is only exercised by Playwright.
- `requirePin()` in `apps-script.js` silently allows all writes when `TOOLTRACK_PIN` is not set (`if (!stored) return;`) — intentional for initial setup, but must be addressed before final deploy. **Do not fix until PIN/auth approach is finalized.**

## Known bugs (to fix before next feature work)
These were audited on 2026-05-04.

### Fixed ✅
- **E2E test selectors are all wrong** — corrected 2026-05-04.
- **Dead catch block in `init()`** — removed 2026-05-04.
- **Redundant guard in `addSite()`** — removed 2026-05-04.

### Deferred 🔜
- `setupPin()` / `setupAdminPin()` still in `apps-script.js` — delete both after running once in deployed script. Do not fix until PIN/auth approach is finalized post-SQL migration.
- `"No PIN set"` guard UI — if `TOOLTRACK_PIN` is unset, writes are silently allowed. Fix after auth approach is decided.

## Major planned change — SQL migration
**Goal: migrate backend from Google Sheets to a real SQL database before production deploy.**
- Google Sheets is adequate for the current crew size but will not scale and has no proper query layer.
- All read/write logic currently lives in `apps-script.js` (`doGet` / `doPost`). This file will be replaced or removed entirely once a real backend is in place.
- Frontend `post()` and `fetchData()` in `index.html` call a single Apps Script URL — this will need to point to a proper API (FastAPI or similar) instead.
- The three Google Sheet tabs (`ToolInventory`, `MoveLog`, `JobSites`) map cleanly to three SQL tables with the same columns.
- PIN auth will likely change as part of this migration — do not lock in the current PIN approach.

## Admin feature set — completed 2026-05-04

### What was built
- **Admin PIN** (`TOOLTRACK_ADMIN_PIN`) — separate from crew PIN; stored in `localStorage` as `tt_admin_pin`
- **Lock button** (🔒/🔓) in header — tapping opens admin PIN prompt; unlocks Admin tab
- **Admin tab** (hidden until authenticated) with four sections:
  - **Dashboard** — total tools, active/decom/repair counts, tools-per-site bar chart, recent log
  - **Tool Inventory** — add tool (name, notes, location, added-by), edit tool, remove tool (decommission vs. delete permanently with explanation dialog)
  - **Site Management** — add site, remove site (moved from crew access to admin only)
  - **Bulk Reassign** — move all tools from one site to another in one API call
  - **Export** — download full move log as CSV
- **Input validation** — all name/site fields: required, max-length enforced (`maxlength` attrs), character allowlist (letters, numbers, spaces, `-'.,#&/()`), backend `sanitizeText()` strips control chars
- **`movedBy` / name fields are now required** everywhere — move tool, add tool, edit tool, bulk move, add site
- **`buildCsv(moveLog)`** added to `src/utils.js` (pure function, tested)
- **38 unit tests passing**

### Backend actions added (`apps-script.js`)
`addTool`, `editTool`, `decommissionTool`, `deleteTool`, `bulkMove` — all require admin PIN.
`addSite`, `removeSite` — moved from crew PIN to admin PIN.

### Deploy steps (apps-script.js)
1. Run `setupPin()` once → delete it
2. Run `setupAdminPin()` once → delete it
3. Deploy as new Web App version

## Working with Claude on this project

**Token efficiency priority (applies to all projects):** Work from these sources in order — cheapest first, escalate only when quality requires it:
1. This file (PROJECT_STATE.md) + Claude memory files — read first, always cheapest
2. MemPalace — big-picture context across sessions; Giuliano must run `mp-mine` to sync it
3. Chat history — last resort only, when quality genuinely depends on a specific past exchange

## Pending features (approved 2026-05-04, not yet built)

### In scope — build before SQL migration
1. **Admin sub-tabs** — convert stacked admin sections into horizontal sub-tabs: Dashboard / Tools / Sites / Bulk / Export
2. **Job code on sites** — add `jobCode` column to `JobSites`; display format `"26-0006 - 160 31st St"` everywhere a site name appears; admin sets it when adding/editing a site
3. **Dark/Light mode** — CSS custom properties, `data-theme` toggle, sun/moon button in header, preference saved to `localStorage`

### Deferred until after SQL migration
- **Tool photos** — thumbnail beside tool name; clicking opens full photo (lightbox); admin can upload/remove, crew can only view. Plan: Google Drive URL stored in `ToolInventory` now → swap to S3/Cloudinary after migration. Do not build until SQL backend is in place.

## Next steps
1. **Build pending features 1–3** above (admin sub-tabs, job codes, dark/light mode).
2. **Delete `setupPin()` and `setupAdminPin()`** from the deployed Apps Script — both have been run; remove from live script.
3. **SQL migration** — design schema, stand up FastAPI backend, swap CONFIG.scriptUrl. All current actions map 1:1 to SQL INSERT/UPDATE/DELETE.
4. **Tool photos** — implement after SQL migration is stable.
5. **Expand E2E tests** to cover full admin flows.
6. **Fix deferred items** (no-PIN silent-allow guard) once auth is finalized post-migration.
7. **Add GitHub Actions CI** to run `npm test` on push.
