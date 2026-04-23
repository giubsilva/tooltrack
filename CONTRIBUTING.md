# Contributing

Thank you for your interest in ToolTrack. This is a small, focused tool — contributions that keep it simple and mobile-friendly are welcome.

---

## Getting Started

```bash
git clone https://github.com/giubsilva/tooltrack.git
cd tooltrack
npm install
npx playwright install chromium
```

Open `index.html` directly in a browser for quick UI iteration, or run the E2E tests to confirm changes haven't broken anything.

---

## Running Tests

```bash
# Unit tests (fast, no browser needed)
npm test

# E2E tests (requires Chromium)
npm run test:e2e

# E2E with visual browser UI
npm run test:e2e:ui
```

All tests should pass before submitting a pull request.

---

## What Belongs Here

Good contributions:
- Bug fixes
- Mobile UX improvements
- Performance improvements in rendering
- New filter/search capabilities
- Security hardening

Out of scope:
- Framework rewrites (React, Vue, etc.) — the no-build-step constraint is intentional
- Server-side alternatives to Google Sheets — the portability is a feature
- Features that require users to create accounts

---

## Pull Request Guidelines

- Keep PRs focused: one feature or fix per PR
- Run the full test suite before opening a PR
- If you change Apps Script logic, describe what you tested manually in the PR description (Apps Script can't run in CI)
- If you change the Sheet structure (column layout, tab names), update the README table and the column index references in `apps-script.js`

---

## Code Style

- Vanilla JS, no build step, no transpilation
- CSS in the `<style>` block in `index.html`; pure utility functions in `src/utils.js`
- No comments unless the *why* is non-obvious
- Mobile-first — test on a 375px viewport before desktop

---

## Apps Script Changes

Apps Script cannot be tested in CI. When changing `apps-script.js`:

1. Paste the updated file into the Apps Script editor
2. Test each affected action manually (move, addSite, removeSite)
3. Re-deploy as a new version before testing the frontend against it
4. Document what you tested manually in the PR

---

## Reporting Bugs

Open a GitHub issue with:
- What you did
- What you expected
- What happened instead
- Device / browser (especially for mobile layout issues)
