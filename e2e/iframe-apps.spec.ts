import { expect, test } from '@playwright/test';

/**
 * Browser smoke for first-party iframe apps (no LLM): proves bundles render in a real browser.
 */
test.describe('Internal app pages', () => {
  test('chess tutoring UI loads', async ({ page }) => {
    await page.goto('/apps/chess');
    await expect(page.getByText('Click a piece to start playing')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resign' })).toBeVisible();
  });

  test('flashcards app shows waiting state without tool_invoke', async ({ page }) => {
    await page.goto('/apps/flashcards');
    await expect(page.getByText('Waiting for a deck...')).toBeVisible();
    await expect(page.getByText('Ask the chatbot to create or load flashcards.')).toBeVisible();
  });
});
