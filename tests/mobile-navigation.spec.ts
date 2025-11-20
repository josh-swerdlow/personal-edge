import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation', () => {
  test('should complete swipe up animation and open hamburger menu', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    // Wait for the intro screen to load
    await page.waitForLoadState('networkidle');

    // Wait for the search bar to appear (intro animation starts)
    // The search bar appears after 1 second according to HomeIntro.tsx
    await page.waitForTimeout(1500);

    // Verify we're on the intro screen - check for "Swipe up to continue" hint
    const swipeHint = page.locator('text=Swipe up to continue');
    await expect(swipeHint).toBeVisible();

    // Get viewport dimensions for swipe gesture
    const viewport = page.viewportSize();
    const centerX = viewport!.width / 2;
    const startY = viewport!.height * 0.7; // Start from 70% down the screen
    const endY = viewport!.height * 0.3;   // End at 30% (swipe up)

    // Perform swipe up gesture using touch events
    // Touch start
    await page.evaluate(({ x, y }) => {
      const touch = new Touch({
        identifier: 0,
        target: document.body,
        clientX: x,
        clientY: y,
        radiusX: 2.5,
        radiusY: 2.5,
        rotationAngle: 10,
        force: 0.5,
      });
      const touchEvent = new TouchEvent('touchstart', {
        cancelable: true,
        bubbles: true,
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
      });
      document.body.dispatchEvent(touchEvent);
    }, { x: centerX, y: startY });

    // Touch move (swipe up)
    await page.evaluate(({ x, y }) => {
      const touch = new Touch({
        identifier: 0,
        target: document.body,
        clientX: x,
        clientY: y,
        radiusX: 2.5,
        radiusY: 2.5,
        rotationAngle: 10,
        force: 0.5,
      });
      const touchEvent = new TouchEvent('touchmove', {
        cancelable: true,
        bubbles: true,
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
      });
      document.body.dispatchEvent(touchEvent);
    }, { x: centerX, y: endY });

    // Small delay to ensure the move event is processed
    await page.waitForTimeout(100);

    // Touch end
    await page.evaluate(({ x, y }) => {
      const touch = new Touch({
        identifier: 0,
        target: document.body,
        clientX: x,
        clientY: y,
        radiusX: 2.5,
        radiusY: 2.5,
        rotationAngle: 10,
        force: 0.5,
      });
      const touchEvent = new TouchEvent('touchend', {
        cancelable: true,
        bubbles: true,
        touches: [],
        targetTouches: [],
        changedTouches: [touch],
      });
      document.body.dispatchEvent(touchEvent);
    }, { x: centerX, y: endY });

    // Wait for the intro to transition out (300ms delay + animation time)
    await page.waitForTimeout(1000);

    // Verify the intro is gone and main content is visible
    // The nav should now be visible (it was hidden during intro)
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Verify the hamburger menu button is visible (mobile view)
    const hamburgerButton = page.locator('[aria-label="Toggle menu"]');
    await expect(hamburgerButton).toBeVisible();

    // Click the hamburger menu button
    await hamburgerButton.click();

    // Wait for menu animation
    await page.waitForTimeout(300);

    // Verify the mobile menu is open
    // Check for menu items that should be visible
    const progressTrackerLink = page.locator('text=Progress Tracker');
    await expect(progressTrackerLink).toBeVisible();

    // Verify menu backdrop is present
    const menuBackdrop = page.locator('.fixed.inset-0.bg-black.bg-opacity-50').first();
    await expect(menuBackdrop).toBeVisible();

    // Take a screenshot for verification
    await page.screenshot({ path: 'tests/screenshots/mobile-menu-open.png', fullPage: true });
  });
});

