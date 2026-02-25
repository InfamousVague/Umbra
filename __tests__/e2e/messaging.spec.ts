/**
 * Messaging E2E Tests — Send messages between two users.
 *
 * Uses two browser contexts with established friendship (via beforeAll).
 * Tests deterministic message flow rather than relying on pre-existing state.
 */

import {
  test, expect,
  setupTwoUsers,
  teardownTwoUsers,
  sendFriendRequest,
  acceptFriendRequest,
  createIdentity,
  waitForAppReady,
  type TwoUserFixture,
  RELAY_DELIVERY_TIMEOUT,
} from './fixtures';

test.describe('Messaging', () => {
  test('should display empty conversation state for new user', async ({ page }) => {
    await createIdentity(page, 'LonelyUser');

    // A new user with no friends should see the welcome/empty state
    await expect(
      page.getByText('Welcome to Umbra').or(page.getByText('Conversations'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test.describe('between friends', () => {
    let fixture: TwoUserFixture;

    test.beforeAll(async ({ browser }) => {
      // Set up two users and make them friends
      fixture = await setupTwoUsers(browser, 'MsgAlice', 'MsgBob');

      // Establish friendship
      await sendFriendRequest(fixture.pageA, fixture.didB);
      await acceptFriendRequest(fixture.pageB);

      // Navigate both back to home
      await fixture.pageA.locator('[accessibilityLabel="Home"]').click();
      await fixture.pageB.locator('[accessibilityLabel="Home"]').click();
    });

    test.afterAll(async () => {
      await teardownTwoUsers(fixture);
    });

    test('should send a message and have it appear', async () => {
      // Alice clicks on Bob's conversation
      await expect(fixture.pageA.getByText('MsgBob')).toBeVisible({ timeout: RELAY_DELIVERY_TIMEOUT });
      await fixture.pageA.getByText('MsgBob').click();

      // Type and send a message
      const input = fixture.pageA.getByPlaceholder(/message|type/i);
      await expect(input).toBeVisible({ timeout: 5_000 });
      await input.fill('Hello from Alice!');
      await input.press('Enter');

      // Message should appear in Alice's chat area
      await expect(fixture.pageA.getByText('Hello from Alice!')).toBeVisible({ timeout: 5_000 });
    });

    test('should deliver message to the other user', async () => {
      // Bob clicks on Alice's conversation
      await expect(fixture.pageB.getByText('MsgAlice')).toBeVisible({ timeout: RELAY_DELIVERY_TIMEOUT });
      await fixture.pageB.getByText('MsgAlice').click();

      // Bob should see Alice's message (delivered via relay)
      await expect(fixture.pageB.getByText('Hello from Alice!')).toBeVisible({
        timeout: RELAY_DELIVERY_TIMEOUT,
      });
    });

    test('should send and receive in both directions', async () => {
      // Bob sends a reply
      const input = fixture.pageB.getByPlaceholder(/message|type/i);
      await expect(input).toBeVisible({ timeout: 5_000 });
      await input.fill('Hey Alice, got your message!');
      await input.press('Enter');

      // Bob sees his own message
      await expect(fixture.pageB.getByText('Hey Alice, got your message!')).toBeVisible({ timeout: 5_000 });

      // Alice receives Bob's reply
      await expect(fixture.pageA.getByText('Hey Alice, got your message!')).toBeVisible({
        timeout: RELAY_DELIVERY_TIMEOUT,
      });
    });
  });
});
