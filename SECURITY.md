# Security Policy

## Scope

ToolTrack is a small internal tool for field crews. It is not intended to store sensitive personal data, financial records, or regulated information. The threat model is: prevent unauthorized modification of tool location data by someone who discovers the Apps Script URL.

---

## Authentication Model

All write operations (moving tools, adding/removing sites) require a PIN.

- **Storage:** PIN is stored server-side in Google Apps Script's `PropertiesService` — it is never embedded in the frontend code or the Sheet itself
- **Transport:** PIN is sent in the POST body over HTTPS (Apps Script enforces TLS)
- **Client:** PIN is stored in `localStorage` after the user enters it once per device; it is never logged or sent via GET requests
- **Error response:** An invalid PIN returns the generic message `"unauthorized"` — no details about what was wrong are leaked

**Limitations:**
- There is a single shared PIN for all crew members. If the PIN is compromised, change it via `setupPin()` and redistribute.
- The PIN is transmitted in plaintext within the HTTPS-encrypted request body. This is acceptable for this threat model but is not equivalent to token-based auth with expiry.
- Reads (`doGet`) are unauthenticated. Anyone with the Apps Script URL can read all tool and site data.

---

## XSS Mitigations

All user-controlled data (tool names, site names, notes, log entries) is HTML-escaped via `esc()` before being inserted into the DOM.

**What was changed:**
- `esc()` now escapes single quotes (`'` → `&#39;`) in addition to `<`, `>`, `&`, `"`
- All event handlers that received user data were moved from inline `onclick="fn('${name}')"` strings to `data-*` attributes with a central event delegation handler

This eliminates the class of XSS attack where a tool name containing `'); malice(); //` would execute arbitrary JavaScript.

---

## Input Validation

Server-side (Apps Script):

- All string fields are validated with `requireString(value, field, maxLen)`: rejects null/empty, enforces max length (200 chars for names/locations, 100 chars for person names)
- Duplicate site names are rejected (case-insensitive comparison)
- Unknown `action` values return an error and perform no write

Client-side:

- Empty tool names and site names are rejected before any POST is made
- Site name input is trimmed before submission

---

## Dependency Security

ToolTrack has no runtime dependencies. The frontend is a single HTML file with no npm packages loaded in production. Test dependencies (Jest, Playwright) are `devDependencies` only and are never shipped to users.

---

## Reporting a Vulnerability

This is an internal tool. If you find a security issue:

1. Open a GitHub issue marked `[Security]`
2. Or email the maintainer directly

Please do not publish proof-of-concept exploits before the issue is resolved.

---

## Known Limitations / Accepted Risks

| Risk | Mitigation | Status |
|------|-----------|--------|
| Single shared PIN | Change PIN if compromised | Accepted |
| Reads are unauthenticated | Tool data is not sensitive | Accepted |
| No rate limiting on POST | Apps Script has built-in quotas | Accepted |
| No PIN expiry / rotation policy | Manual rotation via setupPin() | Accepted |
| localStorage PIN storage | Cleared on browser data reset | Accepted |
