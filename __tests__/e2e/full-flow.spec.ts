/**
 * Full Flow E2E Test — The complete happy path:
 *
 * 1. Alice creates an account
 * 2. Bob creates an account (separate browser context)
 * 3. Alice adds Bob as friend via DID
 * 4. Bob accepts the request
 * 5. Alice sends "Hello Bob!"
 * 6. Bob receives the message
 * 7. Alice opens AccountSwitcher → adds a new account "Charlie"
 * 8. Alice switches back to original account → verifies friend + message
 *
 * This is the "big integration test" that validates the entire chain.
 */

import {
  test, expect,
  createIdentity,
  sendFriendRequest,
  acceptFriendRequest,
  openAccountSwitcher,
  RELAY_DELIVERY_TIMEOUT,
  APP_READY_TIMEOUT,
} from './fixtures';
import type { BrowserContext, Page } from '@playwright/test';

test.describe('Full Flow', () => {
  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let pageA: Page;
  let pageB: Page;

  test.beforeAll(async ({ browser }) => {
    contextA = await browser.newContext();
    contextB = await browser.newContext();
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();
  });

  test.afterAll(async () => {
    await contextA.close();
    await contextB.close();
  });

  test('create account → add friend → chat → switch account', async () => {
    // ── Step 1: Alice creates an account ──
    const didAlice = await createIdentity(pageA, 'Alice');
    expect(didAlice).toMatch(/^did:key:/);

    // ── Step 2: Bob creates an account ──
    const didBob = await createIdentity(pageB, 'Bob');
    expect(didBob).toMatch(/^did:key:/);
    expect(didAlice).not.toBe(didBob);

    // ── Step 3: Alice adds Bob as friend ──
    await sendFriendRequest(pageA, didBob);

    // ── Step 4: Bob accepts the request ──
    await acceptFriendRequest(pageB);

    // ── Step 5: Alice sends a message ──
    // Navigate Alice home and select Bob's conversation
    await pageA.locator('[accessibilityLabel="Home"]').click();
    await expect(pageA.getByText('Bob')).toBeVisible({ timeout: RELAY_DELIVERY_TIMEOUT });
    await pageA.getByText('Bob').click();

    const inputA = pageA.getByPlaceholder(/message|type/i);
    await expect(inputA).toBeVisible({ timeout: 5_000 });
    await inputA.fill('Hello Bob!');
    await inputA.press('Enter');

    // Verify message appears locally
    await expect(pageA.getByText('Hello Bob!')).toBeVisible({ timeout: 5_000 });

    // ── Step 6: Bob receives the message ──
    await pageB.locator('[accessibilityLabel="Home"]').click();
    await expect(pageB.getByText('Alice')).toBeVisible({ timeout: RELAY_DELIVERY_TIMEOUT });
    await pageB.getByText('Alice').click();

    await expect(pageB.getByText('Hello Bob!')).toBeVisible({ timeout: RELAY_DELIVERY_TIMEOUT });

    // ── Step 7: Alice adds a new account "Charlie" ──
    await openAccountSwitcher(pageA);
    await pageA.getByText('Add Account').click();

    // Should go to auth screen
    await expect(
      pageA.getByRole('button', { name: 'Create New Account' })
        .or(pageA.getByText('Your Accounts'))
    ).first().toBeVisible({ timeout: APP_READY_TIMEOUT });

    await createIdentity(pageA, 'Charlie');

    // ── Step 8: Switch back to Alice ──
    await openAccountSwitcher(pageA);

    // Both Alice and Charlie should be in the switcher
    await expect(pageA.getByText('Alice')).toBeVisible();
    await expect(pageA.getByText('Charlie')).toBeVisible();

    // Click Alice to switch
    await pageA.getByText('Alice').click();

    // Wait for app to reload as Alice
    // Avoid "Conversations" — it substring-matches the tagline
    await expect(
      pageA.getByText('Welcome to Umbra')
        .or(pageA.getByText('Bob'))
        .or(pageA.getByText('Enter your PIN'))
    ).first().toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Navigate to home and verify Bob's conversation + message still exist
    await pageA.locator('[accessibilityLabel="Home"]').click();

    // Bob should still be in the conversation list
    await expect(pageA.getByText('Bob')).toBeVisible({ timeout: RELAY_DELIVERY_TIMEOUT });
    await pageA.getByText('Bob').click();

    // The message should still be persisted
    await expect(pageA.getByText('Hello Bob!')).toBeVisible({ timeout: 15_000 });
  });
});
