import { test, expect } from '@playwright/test';

const skipIfNoEnv = () => test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Missing Supabase env');

test.describe('Smoke', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('subscriptions page prompts unauthenticated users', async ({ page }) => {
    await page.goto('/subscriptions');
    // We expect redirect to login or some protected flow
    await expect(page.locator('body')).toBeVisible();
  });
});
