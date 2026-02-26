/**
 * Shared E2E test fixtures and helpers.
 *
 * Provides reusable functions for common E2E flows:
 * - WASM init waiting
 * - Identity creation (6-step create-account flow)
 * - Two-user setup (separate browser contexts)
 * - Friend request sending / accepting
 * - Navigation helpers
 */

import { test as base, expect, type Page, type BrowserContext, type Browser } from '@playwright/test';

// ─── Timeouts ────────────────────────────────────────────────────────────────
export const WASM_INIT_TIMEOUT = 30_000;
export const IDENTITY_CREATE_TIMEOUT = 30_000;
export const APP_READY_TIMEOUT = 60_000;
export const RELAY_DELIVERY_TIMEOUT = 15_000;

// ─── waitForAppReady ─────────────────────────────────────────────────────────
/**
 * Navigate to `/` and wait for the app to finish WASM init.
 * Returns 'auth' if on the auth screen, 'main' if already authenticated.
 */
export async function waitForAppReady(page: Page): Promise<'auth' | 'main'> {
  await page.goto('/');

  // Wait until either auth screen or main app is visible.
  // Use .first() to avoid strict-mode violations when the auth screen
  // renders both mobile + desktop layouts with duplicate text nodes.
  // Avoid "Conversations" — it substring-matches the tagline
  // "Servers see ciphertext. You see conversations."
  await expect(
    page.getByRole('button', { name: 'Create New Account' })
      .or(page.getByText('Your Accounts'))
      .or(page.getByText('Welcome to Umbra'))
  ).first().toBeVisible({ timeout: APP_READY_TIMEOUT });

  // Determine which state we landed in
  const isAuth = await page.getByRole('button', { name: 'Create New Account' })
    .or(page.getByText('Your Accounts'))
    .first()
    .isVisible()
    .catch(() => false);

  return isAuth ? 'auth' : 'main';
}

// ─── createIdentity ──────────────────────────────────────────────────────────
/**
 * Create a new identity through the full 6-step UI flow.
 * Returns the DID string (did:key:...).
 *
 * Steps: Name → Recovery Phrase → Confirm Backup → PIN (skip) → Username (skip) → Get Started
 */
export async function createIdentity(
  page: Page,
  displayName: string,
  options?: { setPin?: string },
): Promise<string> {
  const state = await waitForAppReady(page);

  if (state === 'main') {
    // Already authenticated — skip creation
    return '';
  }

  // Click "Create New Account" (handles fresh + returning-user layouts).
  // Use getByRole to avoid matching tagline text that contains substrings.
  const createBtn = page.getByRole('button', { name: 'Create New Account' })
    .or(page.getByRole('button', { name: 'Create New' }));
  await createBtn.first().click();

  // Step 0: Display Name
  await expect(page.getByText('Choose Your Name').first()).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder('Enter your name').first().fill(displayName);
  await page.getByRole('button', { name: 'Continue' }).first().click();

  // Step 1: Recovery Phrase (WASM identity creation happens here — can be slow)
  await expect(page.getByText('Your Recovery Phrase').first()).toBeVisible({ timeout: IDENTITY_CREATE_TIMEOUT });
  await page.getByRole('button', { name: 'Continue' }).first().click();

  // Step 2: Confirm Backup
  await expect(page.getByText('Confirm Your Backup').first()).toBeVisible({ timeout: 10_000 });
  await page.getByText('I have written down my recovery phrase').first().click();
  await page.getByRole('button', { name: 'Continue' }).first().click();

  // Step 3: PIN Setup
  await expect(
    page.getByText('Security PIN')
      .or(page.getByText('Choose a Username'))
      .or(page.getByText('Account Created!'))
  ).first().toBeVisible({ timeout: 10_000 });

  const pinVisible = await page.getByText('Security PIN').first().isVisible().catch(() => false);
  if (pinVisible) {
    if (options?.setPin) {
      // Type each digit into the GrowablePinInput
      await page.keyboard.type(options.setPin);
      await expect(page.getByText('Confirm Your PIN').first()).toBeVisible({ timeout: 5_000 });
      await page.keyboard.type(options.setPin);
    } else {
      const skipBtn = page.getByText('Skip for now').first();
      if (await skipBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await skipBtn.click();
      }
    }
  }

  // Step 4: Username (skip)
  const usernameVisible = await page.getByText('Choose a Username').first().isVisible({ timeout: 5_000 }).catch(() => false);
  if (usernameVisible) {
    await page.getByText('Skip for now').first().click();
  }

  // Step 5: Success — extract DID
  await expect(page.getByText('Account Created!').first()).toBeVisible({ timeout: 10_000 });

  let did = '';
  const didLocator = page.locator('text=/did:key:/').first();
  if (await didLocator.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const text = await didLocator.textContent();
    did = text?.match(/did:key:\S+/)?.[0] ?? '';
    // Clean trailing punctuation
    did = did.replace(/[.,;:!?)]+$/, '');
  }

  // Click "Get Started"
  await page.getByRole('button', { name: 'Get Started' }).first().click();

  // Wait for main app — use .first() and avoid "Conversations" (matches tagline)
  await expect(
    page.getByText('Welcome to Umbra').first()
  ).toBeVisible({ timeout: APP_READY_TIMEOUT });

  return did;
}

// ─── Two-user fixture ────────────────────────────────────────────────────────
export interface TwoUserFixture {
  pageA: Page;
  pageB: Page;
  contextA: BrowserContext;
  contextB: BrowserContext;
  didA: string;
  didB: string;
}

/**
 * Create two separate browser contexts, each with a fresh identity.
 * Useful for friend request, messaging, and multi-user tests.
 */
export async function setupTwoUsers(
  browser: Browser,
  nameA: string,
  nameB: string,
): Promise<TwoUserFixture> {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const didA = await createIdentity(pageA, nameA);
  const didB = await createIdentity(pageB, nameB);

  return { pageA, pageB, contextA, contextB, didA, didB };
}

/**
 * Clean up two-user fixture by closing both browser contexts.
 */
export async function teardownTwoUsers(fixture: TwoUserFixture): Promise<void> {
  await fixture.contextA.close();
  await fixture.contextB.close();
}

// ─── Friend request helpers ──────────────────────────────────────────────────

/**
 * Send a friend request by DID from the current page.
 * Navigates to the Friends page → "All" tab → "Or add by DID" section.
 */
export async function sendFriendRequest(page: Page, targetDid: string): Promise<void> {
  // Navigate to friends page
  await page.locator('[accessibilityLabel="Friends"]').first().click();
  await expect(page.getByText('All').first()).toBeVisible({ timeout: 10_000 });

  // Make sure we're on the "All" tab (which has the add friend input)
  await page.getByText('All').first().click();

  // Wait for relay connection before sending
  await page.waitForTimeout(2_000);

  // Scroll down to "Or add by DID" and fill in the DID
  const didInput = page.getByPlaceholder('did:key:z6Mk...');
  await expect(didInput).toBeVisible({ timeout: 5_000 });
  await didInput.fill(targetDid);

  // Submit — the AddFriendInput has a send button
  await didInput.press('Enter');

  // Wait for feedback
  await expect(
    page.getByText('Friend request sent!').or(page.getByText(/sent|success/i))
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Accept the first incoming friend request on the current page.
 * Navigates to Friends → "Pending" tab → clicks "Accept".
 */
export async function acceptFriendRequest(page: Page): Promise<void> {
  // Navigate to friends page
  await page.locator('[accessibilityLabel="Friends"]').first().click();
  await expect(page.getByText('Pending').first()).toBeVisible({ timeout: 10_000 });

  // Switch to Pending tab
  await page.getByText('Pending').first().click();

  // Wait for the request to appear via relay
  await expect(page.getByText('Accept').first()).toBeVisible({ timeout: RELAY_DELIVERY_TIMEOUT });

  // Accept
  await page.getByText('Accept').first().click();

  // Wait a moment for the acceptance to propagate
  await page.waitForTimeout(2_000);
}

// ─── Navigation helpers ──────────────────────────────────────────────────────

export type AppSection = 'home' | 'friends' | 'files' | 'settings';

/**
 * Navigate to a section of the app using the NavigationRail accessibility labels.
 */
export async function navigateTo(page: Page, section: AppSection): Promise<void> {
  switch (section) {
    case 'home':
      await page.locator('[accessibilityLabel="Home"]').click();
      break;
    case 'friends':
      await page.locator('[accessibilityLabel="Friends"]').first().click();
      await expect(page.getByText('All').first()).toBeVisible({ timeout: 10_000 });
      break;
    case 'files':
      await page.locator('[accessibilityLabel="Files"]').click();
      break;
    case 'settings':
      await page.locator('[accessibilityLabel="Settings"]').click();
      await expect(page.getByText('Settings')).toBeVisible({ timeout: 5_000 });
      break;
  }
}

/**
 * Open the account switcher popover by clicking the avatar in NavigationRail.
 */
export async function openAccountSwitcher(page: Page): Promise<void> {
  await page.locator('[accessibilityLabel="Account"]').click();
  await expect(page.getByText('Accounts')).toBeVisible({ timeout: 5_000 });
}

// ─── Re-exports ──────────────────────────────────────────────────────────────
export const test = base;
export { expect };
