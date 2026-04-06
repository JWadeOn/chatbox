import { expect, test } from '@playwright/test';

const DEMO_EMAIL = process.env.E2E_DEMO_EMAIL ?? 'demo@chatbridge.com';
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'demo1234';

test.describe('Authenticated chat shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('chatbridge_token');
      } catch {
        /* ignore */
      }
    });
  });

  test('demo user can sign in and open a conversation with composer', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.removeItem('chatbridge_token'));
    await page.reload({ waitUntil: 'load' });

    const email = page.getByTestId('auth-email');
    await expect(email).toBeVisible({ timeout: 90_000 });
    await email.fill(DEMO_EMAIL);
    await page.getByTestId('auth-password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByRole('heading', { name: 'ChatBridge' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'New Chat' }).click();

    await expect(page.getByPlaceholder('Message ChatBridge...')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Let's play chess/i })).toBeVisible();
  });
});
