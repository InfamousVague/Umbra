/**
 * Identity E2E Tests — Create identity, recovery phrase, persistence across refresh.
 */

import { test, expect, createIdentity, waitForAppReady } from './fixtures';

test.describe('Identity', () => {
  test('should create a new identity and display DID', async ({ page }) => {
    const did = await createIdentity(page, 'TestUser');

    expect(did).toMatch(/^did:key:/);

    // Should be in the main app
    await expect(
      page.getByText('Welcome to Umbra').or(page.getByText('Conversations'))
    ).toBeVisible();
  });

  test('should display recovery phrase during creation', async ({ page }) => {
    await waitForAppReady(page);

    const createBtn = page.getByText('Create New Account').or(page.getByText('Create New'));
    await createBtn.first().click();

    // Enter display name
    await expect(page.getByText('Choose Your Name')).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder('Enter your name').fill('PhraseUser');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Recovery phrase should appear (WASM identity creation happens here)
    await expect(page.getByText('Your Recovery Phrase')).toBeVisible({ timeout: 30_000 });
  });

  test('should persist identity across page refresh', async ({ page }) => {
    await createIdentity(page, 'PersistUser');

    // Reload the page
    await page.reload();

    // Should restore from IndexedDB (splash screen then main view)
    await expect(
      page.getByText('Welcome to Umbra')
        .or(page.getByText('Conversations'))
        .or(page.getByText('Your Accounts'))
    ).toBeVisible({ timeout: 30_000 });
  });
});
