import { expect, test } from '@playwright/test';

test('plays a full pairing against the NPC with sample teams', async ({ page }, info) => {
  const shot = (name: string) =>
    page.screenshot({
      path: `test-results/shots/${info.project.name}-${name}.png`,
      fullPage: true,
    });
  await page.goto('/');
  await shot('home');
  await page.getByRole('button', { name: 'Quick play with sample teams' }).click();

  await page.getByRole('radio', { name: 'R3' }).click();
  await expect(page.getByRole('heading', { name: 'Warped Ruins' })).toBeVisible();
  await page.getByRole('radio', { name: 'Hard' }).click();
  await shot('round');
  await page.getByRole('button', { name: /Start pairing/ }).click();

  const lock = page.getByRole('button', { name: /Lock in/ });
  const hand = page.locator('button[aria-pressed]');

  // Five decisions: guardian, invaders, choose, guardian, choose (stage-2 invaders are forced).
  let steps = 0;
  while (!(await page.getByRole('button', { name: 'See results' }).isVisible())) {
    await expect(lock).toBeVisible();
    await expect(page.getByText('Opponent captain is studying the lists…')).toHaveCount(0);
    const label = (await lock.textContent()) ?? '';
    const need = Number(/\/(\d)/.exec(label)?.[1] ?? 1);
    const have = Number(/\((\d)\//.exec(label)?.[1] ?? 0);
    for (let k = have; k < need; k++) await hand.nth(k).click();
    if (steps === 2) await shot('pairing-choose');
    await expect(lock).toBeEnabled();
    await lock.click();
    await expect(page.getByText(/Revealed:/)).toBeVisible();
    steps++;
    expect(steps).toBeLessThan(10);
  }
  expect(steps).toBe(6);
  await shot('pairing-done');
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText(/Projected for/)).toBeVisible();
  await expect(page.locator('article')).toHaveCount(5);
  await shot('results');
});
