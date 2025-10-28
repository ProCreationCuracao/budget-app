import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30 * 1000,
  fullyParallel: true,
  reporter: [['list']],
  webServer: {
    command: process.env.E2E_COMMAND || (process.env.CI ? 'npm run start' : 'npm run dev'),
    url: process.env.E2E_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
  use: {
    baseURL: process.env.E2E_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
