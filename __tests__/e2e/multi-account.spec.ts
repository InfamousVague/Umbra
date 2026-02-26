/**
 * Multi-Account E2E Tests — Account creation, switching, and management.
 *
 * Tests the AccountSwitcher component and multi-account flow.
 */

import {
  test, expect,
  createIdentity,
  waitForAppReady,
  openAccountSwitcher,
  APP_READY_TIMEOUT,
} from './fixtures';

test.describe('Multi-Account', () => {
  test('should create an account and see it in the account switcher', async ({ page }) => {
    await createIdentity(page, 'Alice');

    // Open account switcher
    await openAccountSwitcher(page);

    // Should see the "Accounts" header and "Alice" in the list
    await expect(page.getByText('Accounts')).toBeVisible();
    await expect(page.getByText('Alice')).toBeVisible();

    // Should have an "Add Account" button
    await expect(page.getByText('Add Account')).toBeVisible();
  });

  test('should add a second account via the switcher', async ({ page }) => {
    // Create the first account
    await createIdentity(page, 'FirstAccount');

    // Open switcher and add a new account
    await openAccountSwitcher(page);
    await page.getByText('Add Account').click();

    // Should navigate back to auth screen
    await expect(
      page.getByRole('button', { name: 'Create New Account' })
        .or(page.getByText('Your Accounts'))
    ).first().toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Create the second account
    await createIdentity(page, 'SecondAccount');

    // Open switcher — should now show both accounts
    await openAccountSwitcher(page);
    await expect(page.getByText('SecondAccount')).toBeVisible();
    // FirstAccount should also be in the list
    await expect(page.getByText('FirstAccount')).toBeVisible();
  });

  test('should switch between accounts', async ({ page }) => {
    // Create first account
    await createIdentity(page, 'SwitchAlice');

    // Add second account
    await openAccountSwitcher(page);
    await page.getByText('Add Account').click();
    await createIdentity(page, 'SwitchBob');

    // We're now logged in as SwitchBob
    // Open switcher and switch to SwitchAlice
    await openAccountSwitcher(page);
    await page.getByText('SwitchAlice').click();

    // App should reload as SwitchAlice (provider tree remounts)
    // Wait for the app to be ready again
    // Avoid "Conversations" — it substring-matches the tagline
    await expect(
      page.getByText('Welcome to Umbra')
        .or(page.getByText('Enter your PIN'))
    ).first().toBeVisible({ timeout: APP_READY_TIMEOUT });
  });

  test('should show stored accounts on auth screen after logout', async ({ page }) => {
    // Create an account
    await createIdentity(page, 'StoredUser');

    // "Add Account" logs out and goes to auth screen
    await openAccountSwitcher(page);
    await page.getByText('Add Account').click();

    // Auth screen should show "Your Accounts" with the stored account
    await expect(
      page.getByText('Your Accounts').or(page.getByText('StoredUser'))
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });
  });
});
