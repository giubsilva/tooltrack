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

// Inject crew PIN into localStorage so writes don't hit the PIN prompt
async function injectPin(page) {
  await page.addInitScript(() => {
    localStorage.setItem('tt_pin', 'testpin1234');
  });
}

// Inject admin PIN into localStorage so admin tab is unlocked
async function injectAdminPin(page) {
  await page.addInitScript(() => {
    localStorage.setItem('tt_pin', 'testpin1234');
    localStorage.setItem('tt_admin_pin', 'adminpin1234');
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
    await expect(page.locator('.logo')).toContainText('ToolTrack');
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
    await page.fill('#mainSearchInput', 'chainsaw');
    await expect(page.locator('.tool-card')).toHaveCount(1);
    await expect(page.locator('.tool-card')).toContainText('Chainsaw');
  });

  test('search by location narrows results', async ({ page }) => {
    await page.fill('#mainSearchInput', 'Job Site A');
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
    await page.fill('#mainSearchInput', 'chainsaw');
    await page.fill('#mainSearchInput', '');
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
    await page.click('.nav-tab:has-text("Move Log")');
    await expect(page.locator('.history-card')).toHaveCount(1);
  });

  test('log search filters by tool name', async ({ page }) => {
    await page.click('.nav-tab:has-text("Move Log")');
    await page.fill('#mainSearchInput', 'chainsaw');
    await expect(page.locator('.history-card')).toHaveCount(1);
  });

  test('log search with no match shows empty state', async ({ page }) => {
    await page.click('.nav-tab:has-text("Move Log")');
    await page.fill('#mainSearchInput', 'zzznomatch');
    await expect(page.locator('.history-card')).toHaveCount(0);
  });
});

test.describe('Sites tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await injectPin(page);
    await page.goto('/');
  });

  test('shows site cards with tools', async ({ page }) => {
    await page.click('.nav-tab:has-text("By Site")');
    await expect(page.locator('.site-card')).toHaveCount(2);
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
    await expect(page.locator('#moveOverlay')).toBeVisible();
  });

  test('move sheet lists available sites', async ({ page }) => {
    await page.locator('.move-btn').first().click();
    await expect(page.locator('.site-opt')).toHaveCount(2);
  });

  test('confirming move requires name and selected site', async ({ page }) => {
    await page.locator('.move-btn').first().click();
    // Try confirm without selecting site — should not post
    let postCount = 0;
    await page.route('**/macros/s/**', async route => {
      if (route.request().method() === 'POST') { postCount++; }
      await route.fulfill({ json: { success: true } });
    });
    await page.click('#confirmBtn');
    expect(postCount).toBe(0);
  });

  test('confirming move with site and name closes sheet and posts', async ({ page }) => {
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
    await page.fill('#movedByInput', 'Test User');
    await page.click('#confirmBtn');

    expect(postCount).toBe(1);
    await expect(page.locator('#moveOverlay')).not.toBeVisible();
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
    await page.fill('#movedByInput', 'Test User');
    await page.click('#confirmBtn');

    await expect(page.locator('#pinOverlay')).toBeVisible();
  });

  test('correct PIN saves and closes overlay', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');

    await page.locator('#pinInput').fill('correctpin');
    await page.locator('#savePinBtn').click();

    await expect(page.locator('#pinOverlay')).not.toBeVisible();
  });
});

test.describe('Admin tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await injectAdminPin(page);
    await page.goto('/');
  });

  test('admin tab is visible when admin PIN is stored', async ({ page }) => {
    await expect(page.locator('#adminTab')).toBeVisible();
  });

  test('admin lock button shows unlocked state', async ({ page }) => {
    await expect(page.locator('#adminLockBtn')).toContainText('🔓');
  });

  test('admin tab shows dashboard stats', async ({ page }) => {
    await page.click('#adminTab');
    await expect(page.locator('#statGrid')).toBeVisible();
  });

  test('admin tab shows tool inventory', async ({ page }) => {
    await page.click('#adminTab');
    await expect(page.locator('#adminToolList')).toBeVisible();
    await expect(page.locator('.admin-tool-row')).toHaveCount(4);
  });

  test('admin logout hides admin tab', async ({ page }) => {
    await page.click('#adminTab');
    await page.click('button:has-text("Log out of Admin")');
    await expect(page.locator('#adminTab')).not.toBeVisible();
  });
});

test.describe('Admin PIN prompt', () => {
  test('admin tab hidden before admin PIN entered', async ({ page }) => {
    await mockApi(page);
    await injectPin(page);
    await page.goto('/');
    await expect(page.locator('#adminTab')).not.toBeVisible();
  });

  test('lock button opens admin PIN overlay', async ({ page }) => {
    await mockApi(page);
    await injectPin(page);
    await page.goto('/');
    await page.click('#adminLockBtn');
    await expect(page.locator('#adminPinOverlay')).toBeVisible();
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
