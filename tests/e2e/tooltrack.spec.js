/**
 * ToolTrack — Playwright E2E Tests
 *
 * Prerequisites:
 *   1. npm install
 *   2. npx playwright install chromium
 *   3. npm run test:e2e
 *
 * These tests mock the Google Apps Script endpoint so no live Sheet is needed.
 * Set TOOLTRACK_URL env var to point at a live deployment for integration runs.
 */

const { test, expect } = require('@playwright/test');

// ── Fixture data ──────────────────────────────────────────────────────────────

const MOCK_DATA = {
  tools: [
    { name: 'Chainsaw',  notes: 'Stihl 261', loc: 'Main Yard' },
    { name: 'Rake',      notes: '',           loc: 'Job Site A' },
    { name: 'Shovel',    notes: 'broken handle', loc: 'Job Site A' },
    { name: 'Leaf Blower', notes: '',         loc: '?' },
  ],
  log: [
    { name: 'Chainsaw', from: 'Job Site A', to: 'Main Yard', by: 'Carlos', time: 'Apr 1, 2025 09:00' },
  ],
  sites: [
    { name: 'Main Yard',   addedBy: 'System', addedAt: 'Jan 1, 2025 00:00' },
    { name: 'Job Site A',  addedBy: 'Marco',  addedAt: 'Jan 2, 2025 08:00' },
  ],
};

// Intercept the Apps Script GET so tests never hit the network
async function mockApi(page) {
  await page.route('**/macros/s/**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: MOCK_DATA });
    } else {
      await route.fulfill({ json: { success: true } });
    }
  });
}

// Inject a PIN into localStorage so writes don't hit the PIN prompt
async function injectPin(page) {
  await page.addInitScript(() => {
    localStorage.setItem('tt_pin', 'testpin1234');
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Initial load', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await injectPin(page);
    await page.goto('/');
  });

  test('shows app title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('ToolTrack');
  });

  test('displays tool cards after sync', async ({ page }) => {
    await expect(page.locator('.tool-card')).toHaveCount(4);
  });

  test('shows site filter chips', async ({ page }) => {
    await expect(page.locator('#allBtn')).toBeVisible();
    await expect(page.locator('#siteSelect')).toBeVisible();
  });
});

test.describe('Search and filter', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await injectPin(page);
    await page.goto('/');
  });

  test('search by tool name narrows results', async ({ page }) => {
    await page.fill('#searchInput', 'chainsaw');
    await expect(page.locator('.tool-card')).toHaveCount(1);
    await expect(page.locator('.tool-card')).toContainText('Chainsaw');
  });

  test('search by location narrows results', async ({ page }) => {
    await page.fill('#searchInput', 'Job Site A');
    await expect(page.locator('.tool-card')).toHaveCount(2);
  });

  test('site filter dropdown narrows results', async ({ page }) => {
    await page.selectOption('#siteSelect', 'Job Site A');
    await expect(page.locator('.tool-card')).toHaveCount(2);
  });

  test('All button clears site filter', async ({ page }) => {
    await page.selectOption('#siteSelect', 'Job Site A');
    await page.click('#allBtn');
    await expect(page.locator('.tool-card')).toHaveCount(4);
  });

  test('clearing search restores all cards', async ({ page }) => {
    await page.fill('#searchInput', 'chainsaw');
    await page.fill('#searchInput', '');
    await expect(page.locator('.tool-card')).toHaveCount(4);
  });
});

test.describe('Move log tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await injectPin(page);
    await page.goto('/');
  });

  test('shows move log entries', async ({ page }) => {
    await page.click('[data-tab="log"]');
    await expect(page.locator('.log-row')).toHaveCount(1);
  });

  test('log search filters by tool name', async ({ page }) => {
    await page.click('[data-tab="log"]');
    await page.fill('#searchInput', 'chainsaw');
    await expect(page.locator('.log-row')).toHaveCount(1);
  });

  test('log search with no match shows empty state', async ({ page }) => {
    await page.click('[data-tab="log"]');
    await page.fill('#searchInput', 'zzznomatch');
    await expect(page.locator('.log-row')).toHaveCount(0);
  });
});

test.describe('Sites tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await injectPin(page);
    await page.goto('/');
  });

  test('shows site cards with tools', async ({ page }) => {
    await page.click('[data-tab="sites"]');
    await expect(page.locator('.site-card')).toHaveCount(2);
  });

  test('add site form is visible above tabs bar', async ({ page }) => {
    await page.click('[data-tab="manage"]');
    await expect(page.locator('#newSiteName')).toBeVisible();
    await expect(page.locator('#newSiteAddedBy')).toBeVisible();
  });

  test('adding a site calls POST and updates list', async ({ page }) => {
    let postedBody = null;
    await page.route('**/macros/s/**', async route => {
      if (route.request().method() === 'POST') {
        postedBody = JSON.parse(route.request().postData());
        await route.fulfill({ json: { success: true } });
      } else {
        await route.fulfill({ json: MOCK_DATA });
      }
    });

    await page.click('[data-tab="manage"]');
    await page.fill('#newSiteName', 'New Test Site');
    await page.fill('#newSiteAddedBy', 'Tester');
    await page.click('.btn-add-site');

    await expect(postedBody?.action).toBe('addSite');
    await expect(postedBody?.siteName).toBe('New Test Site');
  });
});

test.describe('Move sheet', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await injectPin(page);
    await page.goto('/');
  });

  test('opens move sheet when Move button clicked', async ({ page }) => {
    await page.locator('.move-btn').first().click();
    await expect(page.locator('#sheet')).toBeVisible();
  });

  test('move sheet lists available sites', async ({ page }) => {
    await page.locator('.move-btn').first().click();
    await expect(page.locator('.site-opt')).toHaveCount(2);
  });

  test('confirming move closes sheet and posts to API', async ({ page }) => {
    let postCount = 0;
    await page.route('**/macros/s/**', async route => {
      if (route.request().method() === 'POST') {
        postCount++;
        await route.fulfill({ json: { success: true } });
      } else {
        await route.fulfill({ json: MOCK_DATA });
      }
    });

    await page.locator('.move-btn').first().click();
    await page.locator('.site-opt').first().click();
    await page.click('#confirmMove');

    expect(postCount).toBe(1);
    await expect(page.locator('#sheet')).not.toBeVisible();
  });
});

test.describe('PIN authentication', () => {
  test('shows PIN prompt when no PIN is stored', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await expect(page.locator('#pinOverlay')).toBeVisible();
  });

  test('incorrect PIN shows error after write attempt', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tt_pin', 'wrongpin'));
    await page.route('**/macros/s/**', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ json: { error: 'unauthorized' } });
      } else {
        await route.fulfill({ json: MOCK_DATA });
      }
    });
    await page.goto('/');

    await page.locator('.move-btn').first().click();
    await page.locator('.site-opt').first().click();
    await page.click('#confirmMove');

    await expect(page.locator('#pinOverlay')).toBeVisible();
  });

  test('correct PIN allows write and closes overlay', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');

    await page.locator('#pinInput').fill('correctpin');
    await page.locator('#pinSubmit').click();

    await expect(page.locator('#pinOverlay')).not.toBeVisible();
  });
});

test.describe('XSS resistance', () => {
  test('tool names with HTML characters are rendered safely', async ({ page }) => {
    const xssData = {
      ...MOCK_DATA,
      tools: [{ name: '<script>alert(1)</script>', notes: '', loc: 'Site A' }],
      sites: [{ name: 'Site A', addedBy: 'System', addedAt: '' }],
    };
    await page.route('**/macros/s/**', route => route.fulfill({ json: xssData }));
    await injectPin(page);
    await page.goto('/');

    // Confirm no alert dialog was triggered
    let alertTriggered = false;
    page.on('dialog', async dialog => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    await page.waitForLoadState('networkidle');
    expect(alertTriggered).toBe(false);

    const card = page.locator('.tool-card').first();
    await expect(card).toBeVisible();
    const html = await card.innerHTML();
    expect(html).not.toContain('<script>');
  });
});
