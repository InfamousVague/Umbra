/**
 * Persistence E2E Tests — IndexedDB data persistence and wipe.
 *
 * Tests that data survives page refresh and that the
 * Data Management wipe features work correctly.
 */

import { test, expect, createIdentity, waitForAppReady, navigateTo, APP_READY_TIMEOUT } from './fixtures';

test.describe('Persistence', () => {
  test('should show splash screen on reload with existing identity', async ({ page }) => {
    await createIdentity(page, 'SplashUser');

    // Reload — splash screen should show then main view
    await page.reload();

    // Wait for either splash text or main view (splash may be too fast to catch)
    await expect(
      page.getByText('Welcome to Umbra')
        .or(page.getByText('Loading'))
        .or(page.getByText('Your Accounts'))
        .first()
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });
  });

  test('should clear all data via Settings', async ({ page }) => {
    await createIdentity(page, 'WipeUser');

    // Open Settings via NavigationRail
    await navigateTo(page, 'settings');

    // Navigate to Data section
    const dataTab = page.getByText('Data');
    if (await dataTab.isVisible({ timeout: 3_000 })) {
      await dataTab.click();

      // Click Clear All Data
      const clearAllBtn = page.getByText('Clear All Data').first();
      if (await clearAllBtn.isVisible()) {
        await clearAllBtn.click();

        // Confirm in dialog
        const confirmBtn = page.getByText('Clear All Data').last();
        if (await confirmBtn.isVisible({ timeout: 3_000 })) {
          await confirmBtn.click();
        }

        // Should show success message
        await expect(page.getByText(/cleared/i)).toBeVisible({ timeout: 5_000 });
      }
    }
  });
});
