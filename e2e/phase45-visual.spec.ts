import { expect, test } from '@playwright/test';

for (const viewport of [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
]) {
  test(`Phase 4.6 public experience visual regression — ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Find yourself in the story/i })).toBeVisible();
    await expect(page).toHaveScreenshot(`phase46-home-${viewport.name}.png`, {
      fullPage: true,
      animations: 'disabled',
    });
  });
}
