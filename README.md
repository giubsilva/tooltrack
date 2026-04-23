# ToolTrack

A lightweight tool-location tracker for field crews. Workers use it on their phones to log where physical tools are across job sites. All data lives in a Google Sheet — no server, no database, no subscription fees.

**Live app:** https://giubsilva.github.io/tooltrack/

---

## Features

- View all tools and their current locations
- Move a tool to a new site with one tap (logged with who moved it and when)
- Filter and search by tool name, notes, or location
- Manage job sites without touching any code
- Move history log with full-text search
- Works on mobile and desktop
- Data stored in Google Sheets — open in Excel anytime

---

## Architecture

```
Browser (index.html)
  │
  ├── src/utils.js          Pure utility functions (also used by tests)
  │
  └── Google Apps Script    REST-like backend (doGet / doPost Web App)
        │
        └── Google Sheet
              ├── ToolInventory   Name | Notes | Location
              ├── MoveLog         ToolName | From | To | MovedBy | MoveTime
              └── JobSites        SiteName | AddedBy | AddedAt
```

- **Frontend:** Single HTML file, vanilla JS, no build step, no frameworks
- **Backend:** Google Apps Script deployed as a Web App — one URL, no server to maintain
- **Auth:** PIN stored server-side in Apps Script Properties Service; sent with every write request
- **Hosting:** GitHub Pages (static file, free, custom domain supported)

---

## Setting Up Your Own Instance

### 1. Copy the Google Sheet

Create a new Google Sheet with three tabs named exactly:

| Tab | Column A | Column B | Column C |
|-----|----------|----------|----------|
| `ToolInventory` | Name | Notes | Location |
| `MoveLog` | ToolName | FromLocation | ToLocation | MovedBy | MoveTime |
| `JobSites` | SiteName | AddedBy | AddedAt |

Row 1 in every tab is the header row. Data starts at row 2.

Populate `ToolInventory` with your tools and their starting locations.  
Populate `JobSites` with your initial job site list.

### 2. Deploy the Apps Script

1. In your Sheet: **Extensions → Apps Script**
2. Paste the contents of `apps-script.js` into the editor
3. Set your PIN (see [PIN Setup](#pin-setup) below)
4. **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the Web App URL

### 3. Configure the Frontend

In `index.html`, find the `CONFIG` block near the top of the `<script>` tag:

```js
const CONFIG = {
  scriptUrl: "PASTE_YOUR_APPS_SCRIPT_URL_HERE",
};
```

Replace the placeholder with your Web App URL.

### 4. Deploy the Frontend

Push `index.html` and `src/utils.js` to any static host. GitHub Pages works well:

1. Fork this repository
2. Enable GitHub Pages in Settings → Pages → branch: `main`, folder: `/`
3. Your app will be live at `https://<username>.github.io/<repo>/`

---

## PIN Setup

The PIN protects all write operations (moving tools, adding/removing sites). Reads are public.

**First-time setup:**

1. In the Apps Script editor, locate `setupPin()`:
   ```js
   function setupPin() {
     PropertiesService.getScriptProperties().setProperty('TOOLTRACK_PIN', 'CHANGE_THIS_PIN');
   }
   ```
2. Replace `CHANGE_THIS_PIN` with your chosen PIN
3. Click **Run** (▶) to execute the function once
4. Delete or comment out `setupPin()` — the PIN is now stored server-side and this function is no longer needed

**Changing the PIN:**

Re-add `setupPin()` with the new value, run it once, then delete it again.

**Workers:**

The first time someone opens the app, they'll be prompted for the PIN. It's stored in their browser's `localStorage` — they won't be asked again on the same device. Share the PIN with your crew via any secure channel (team chat, in-person).

---

## Development

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
npx playwright install chromium
```

### Run unit tests

```bash
npm test
```

Tests cover all pure utility functions in `src/utils.js` including XSS payload handling.

### Run E2E tests

```bash
npm run test:e2e
```

E2E tests mock the Apps Script API — no live Sheet required. Tests cover:

- Initial data load and rendering
- Search and filter interactions
- Move flow (open sheet → select site → confirm → API call)
- Sites tab add/remove flow
- PIN prompt behavior (missing PIN, wrong PIN, correct PIN)
- XSS resistance (HTML in tool names)

To run with the Playwright UI:

```bash
npm run test:e2e:ui
```

### Project Structure

```
tooltrack/
├── index.html              Main application (frontend)
├── apps-script.js          Google Apps Script backend
├── src/
│   └── utils.js            Pure utility functions (shared with tests)
├── tests/
│   ├── unit.test.js        Jest unit tests
│   └── e2e/
│       └── tooltrack.spec.js  Playwright E2E tests
├── playwright.config.js
├── package.json
├── README.md
├── SECURITY.md
└── CONTRIBUTING.md
```

---

## Google Sheet Backup

Because all data is in a Google Sheet:

- **Export:** File → Download → Microsoft Excel (.xlsx)
- **Version history:** File → Version history → See version history
- **Share:** Share the Sheet with read access to give anyone a live view of tool locations

---

## License

MIT — see [LICENSE](LICENSE) for details.
