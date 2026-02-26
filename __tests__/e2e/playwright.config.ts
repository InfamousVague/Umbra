/**
 * Playwright E2E test configuration for Umbra.
 *
 * Runs tests against the local Expo web dev server.
 * Uses production relay at relay.umbra.chat.
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Project root is two levels up from __tests__/e2e/
const PROJECT_ROOT = path.resolve(__dirname, '../..');

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false, // Tests share relay state — run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: path.join(PROJECT_ROOT, 'playwright-report') }]],
  outputDir: path.join(PROJECT_ROOT, 'test-results'),
  timeout: 60_000,

  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start the Expo web server before running tests */
  webServer: {
    command: 'npx expo start --web --port 8081',
    cwd: PROJECT_ROOT,
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
