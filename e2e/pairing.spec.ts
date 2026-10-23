import { expect, test } from '@playwright/test';

// Battleplan pictures come from Wahapedia; serve a local stand-in so tests never depend on it.
const MAP_FIXTURE = 'e2e/fixtures/map.png';
const WAHAPEDIA_IMAGES = 'https://wahapedia.ru/**/*.png';

test('falls back to the drawn map when the original picture cannot load', async ({ page }) => {
  await page.route(WAHAPEDIA_IMAGES, (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Quick play with sample teams' }).click();
  await page.getByRole('radio', { name: 'R3' }).click();
  await expect(page.getByRole('img', { name: 'Warped Ruins map' })).toBeVisible();
  await expect(page.locator('img[alt="Warped Ruins battleplan map"]')).toHaveCount(0);
});

test('parses a pasted GW app list', async ({ page }) => {
  const { readFileSync } = await import('node:fs');
  await page.goto('/');
  await page.getByRole('button', { name: 'Set up teams & lists' }).click();
  const box = page.locator('#list-0');
  await box.fill(readFileSync('e2e/fixtures/lists/gw-app-ogors.txt', 'utf8'));
  await box.blur();
  await expect(page.getByText(/Ogor Mawtribes · 2000 pts · 7 units/)).toBeVisible();
  await expect(page.getByText(/Maw-Cult Fanatics \(10 pts\)/)).toBeVisible();
  await expect(page.getByText('Not found in the', { exact: false })).toHaveCount(0);
  await expect(
    page.getByText('Points differ from the BSData catalogue', { exact: false }),
  ).toHaveCount(0);
});

test('loads a team from the shared library', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Set up teams & lists' }).click();
  await page
    .getByLabel('Load a saved team (shared library)')
    .selectOption({ label: 'The Rot Pact' });
  await expect(page.getByRole('status')).toHaveText('Loaded "The Rot Pact".');
  await expect(page.getByLabel('Team name')).toHaveValue('The Rot Pact');
  await expect(page.getByText('Grak', { exact: true })).toBeVisible();
});

test('plays a full pairing against the NPC with sample teams', async ({ page }, info) => {
  await page.route(WAHAPEDIA_IMAGES, (route) => route.fulfill({ path: MAP_FIXTURE }));
  const shot = (name: string) =>
    page.screenshot({
      path: `test-results/shots/${info.project.name}-${name}.png`,
      fullPage: true,
    });
  await page.goto('/');
  await shot('home');
  await page.getByRole('button', { name: 'Quick play with sample teams' }).click();

  await page.getByRole('radio', { name: 'R3' }).click();
  // The original GHB map picture is shown (served from the fixture above).
  await expect
    .poll(() =>
      page
        .locator('img[alt="Warped Ruins battleplan map"]')
        .evaluate((i) => (i as { naturalWidth: number }).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Warped Ruins' })).toBeVisible();
  // GHB 2026-27 battleplan rules and battle tactics for the selected round.
  await page.getByText('Rules: twist & scoring').first().click();
  await expect(page.getByText('Spreading Warpfire')).toBeVisible();
  await page.getByText('Battle tactics cards').click();
  await expect(page.getByText('Blazing Onslaught')).toBeVisible();
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
