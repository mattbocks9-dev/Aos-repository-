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
  const seeResults = page.getByRole('button', { name: 'See results' });
  // While the NPC thinks the button reads "Opponent is thinking…": wait for whichever comes next.
  const nextAction = page.getByRole('button', { name: /Lock in|See results/ });
  const hand = page.locator('button[aria-pressed]');

  // Five decisions: guardian, invaders, choose, guardian, choose (stage-2 invaders are forced).
  let steps = 0;
  await expect(nextAction).toBeVisible();

  // Battletome rules and warscrolls from BSData are browsable from any card.
  await page.getByRole('button', { name: "View Alex's list" }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Battle traits/ }).click();
  await expect(dialog.getByText('Scions of the Storm')).toBeVisible();
  await expect(dialog.getByText('Battle formation: Thunderhead Host')).toBeVisible();
  await dialog.getByRole('button', { name: /^Knight-Arcanum/ }).click();
  await expect(dialog.getByText('Indomitable Loreseekers')).toBeVisible();
  await shot('list-viewer');
  await dialog.getByRole('button', { name: 'Close' }).click();

  while (!(await seeResults.isVisible())) {
    await expect(page.getByText('Opponent captain is studying the lists…')).toHaveCount(0);
    const label = (await lock.textContent()) ?? '';
    const need = Number(/\/(\d)/.exec(label)?.[1] ?? 1);
    const have = Number(/\((\d)\//.exec(label)?.[1] ?? 0);
    for (let k = have; k < need; k++) await hand.nth(k).click();
    if (steps === 2) await shot('pairing-choose');
    await expect(lock).toBeEnabled();
    await lock.click();
    await expect(page.getByText(/Revealed:/)).toBeVisible();
    await expect(nextAction).toBeVisible();
    steps++;
    expect(steps).toBeLessThan(10);
  }
  expect(steps).toBe(6);
  await shot('pairing-done');
  await seeResults.click();
  await expect(page.getByText(/Projected for/)).toBeVisible();
  await expect(page.locator('article')).toHaveCount(5);
  await shot('results');
});
