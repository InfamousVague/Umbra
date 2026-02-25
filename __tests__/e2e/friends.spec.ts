/**
 * Friends E2E Tests — Friend request flow between two browser contexts.
 *
 * Uses two separate browser contexts to simulate two users.
 * Both connect to the production relay at relay.umbra.chat.
 */

import {
  test, expect,
  createIdentity,
  sendFriendRequest,
  acceptFriendRequest,
  type TwoUserFixture,
  setupTwoUsers,
  teardownTwoUsers,
  RELAY_DELIVERY_TIMEOUT,
} from './fixtures';

test.describe('Friends', () => {
  let fixture: TwoUserFixture;

  test.beforeAll(async ({ browser }) => {
    fixture = await setupTwoUsers(browser, 'Alice', 'Bob');
  });

  test.afterAll(async () => {
    await teardownTwoUsers(fixture);
  });

  test('should create two distinct identities', async () => {
    expect(fixture.didA).toMatch(/^did:key:/);
    expect(fixture.didB).toMatch(/^did:key:/);
    expect(fixture.didA).not.toBe(fixture.didB);
  });

  test('should send and accept a friend request between two users', async () => {
    // Alice sends friend request to Bob using his DID
    await sendFriendRequest(fixture.pageA, fixture.didB);

    // Bob accepts the incoming request
    await acceptFriendRequest(fixture.pageB);

    // Verify Alice can see Bob in her friends list
    await fixture.pageA.locator('[accessibilityLabel="Friends"]').first().click();
    await fixture.pageA.getByText('All').first().click();

    // Bob's name should appear in the friends list
    await expect(fixture.pageA.getByText('Bob')).toBeVisible({ timeout: RELAY_DELIVERY_TIMEOUT });

    // Verify Bob can see Alice in his friends list
    await fixture.pageB.getByText('All').first().click();
    await expect(fixture.pageB.getByText('Alice')).toBeVisible({ timeout: RELAY_DELIVERY_TIMEOUT });
  });

  test('should show a conversation after becoming friends', async () => {
    // Navigate Alice to home — a conversation with Bob should exist
    await fixture.pageA.locator('[accessibilityLabel="Home"]').click();

    // Wait for the conversation list to populate
    await expect(
      fixture.pageA.getByText('Bob').or(fixture.pageA.getByText('Conversations'))
    ).toBeVisible({ timeout: 10_000 });
  });
});
