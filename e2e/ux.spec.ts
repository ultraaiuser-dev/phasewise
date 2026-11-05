import { test, expect, Page } from "@playwright/test";
async function tapCard(page: Page, label: RegExp, scope = "hand") {
  const card = page
    .getByTestId(scope)
    .getByRole("button", { name: label })
    .first();
  await card.click({ position: { x: 8, y: 12 } });
}
async function tourToBuilder(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /How to Play/ }).click();
  await page
    .getByTestId("tour-coach")
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await page.getByTestId("draw-deck").click();
  await expect(
    page.getByTestId("hand").locator("[aria-pressed=true]"),
  ).toHaveCount(0);
  await tapCard(page, /7 of/);
  await page
    .getByTestId("tour-coach")
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await page.getByTestId("lay-down").click();
  await expect(page.getByTestId("meld-slot-0")).toContainText("0 of 3");
}
for (const mobile of [false, true])
  test(`playable guided tour from draw to Wild end choice, Skip and scoring${mobile ? " on phone" : ""}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 360, height: 640 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await tourToBuilder(page);
    await page.screenshot({
      path: `docs/screenshots/tour-builder-${mobile ? "phone" : "desktop"}.png`,
    });
    await expect(page.getByTestId("confirm-lay-down")).toBeDisabled();
    await page.getByTestId("suggest-melds").click();
    const placed = page
      .getByTestId("meld-slot-0")
      .getByRole("button", { name: /7 of/ })
      .first();
    await placed.click();
    await expect(page.getByTestId("confirm-lay-down")).toBeDisabled();
    await tapCard(page, /7 of/, "builder-hand");
    await page.getByTestId("confirm-lay-down").click();
    await tapCard(page, /7 of/);
    await page
      .locator(".table-melds")
      .getByTestId("meld-tour-run")
      .getByRole("button")
      .click();
    await tapCard(page, /Wild card/);
    await page
      .locator(".table-melds")
      .getByTestId("meld-tour-run")
      .getByRole("button")
      .click();
    await expect(page.getByTestId("hit-end-picker")).toBeVisible();
    await expect(
      page
        .getByTestId("hit-end-picker")
        .getByRole("button", { name: /Left end/ }),
    ).toBeVisible();
    await page
      .getByTestId("hit-end-picker")
      .getByRole("button", { name: /Right end/ })
      .click();
    await tapCard(page, /4 of/);
    await page
      .locator(".table-melds")
      .getByTestId("meld-tour-set")
      .getByRole("button")
      .click();
    await tapCard(page, /Skip card/);
    await page.getByTestId("discard-selected").click();
    await page
      .getByTestId("skip-picker")
      .getByRole("button", { name: /Skip Bot 1/ })
      .click();
    await expect(page.getByTestId("turn-banner")).toBeVisible();
    await page
      .getByTestId("discard-pile")
      .getByRole("button", { name: /Discard Pile/ })
      .click();
    await tapCard(page, /4 of/);
    await page
      .locator(".table-melds")
      .getByTestId("meld-tour-set")
      .getByRole("button")
      .click();
    await tapCard(page, /11 of/);
    await page.getByTestId("discard-selected").click();
    await expect(page.getByTestId("tour-coach")).toContainText(
      "You finished the round!",
    );
    await expect(
      page.getByRole("heading", { name: /Round 1 Complete/ }),
    ).toBeVisible();
    await page.waitForTimeout(450);
    await page.screenshot({
      path: `docs/screenshots/tour-scoring-${mobile ? "phone" : "desktop"}.png`,
    });
    await page
      .getByRole("button", { name: "Play a practice game", exact: true })
      .click();
    await expect(page.getByTestId("tour-coach")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
test("mobile guided builder is empty and editable with no page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await tourToBuilder(page);
  const sheet = page.getByTestId("lay-down-builder");
  await expect(sheet).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  await tapCard(page, /7 of/, "builder-hand");
  await expect(page.getByTestId("meld-slot-0")).toContainText("1 of 3");
  await page
    .getByTestId("meld-slot-0")
    .getByRole("button", { name: /7 of/ })
    .click();
  await expect(page.getByTestId("meld-slot-0")).toContainText("0 of 3");
});
test("reduced motion disables travel animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /How to Play/ }).click();
  await expect(page.getByTestId("game-table")).toHaveAttribute(
    "data-motion",
    "off",
  );
  await expect(page.getByTestId("card-travel")).toHaveCount(0);
});

test("selection clears after draw and turn change; discard by button and drag", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("pw_tour_suggested", "true");
    localStorage.setItem("pw_assist_mode", "false");
    localStorage.setItem("pw_motion_enabled", "false");
  });
  await page.goto("/");
  await page.clock.install();
  await page.getByRole("button", { name: /Practice vs Bots/ }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: /Start Practice Game/ }).click();
  for (
    let i = 0;
    i < 5 && !(await page.getByTestId("turn-banner").count());
    i++
  )
    await page.clock.fastForward(1000);
  const hand = page.getByTestId("hand");
  await hand
    .getByRole("button")
    .first()
    .click({ position: { x: 8, y: 12 } });
  await expect(hand.locator("[aria-pressed=true]")).toHaveCount(1);
  await page.getByTestId("draw-deck").click();
  await expect(hand.locator("[aria-pressed=true]")).toHaveCount(0);
  const chosen = hand
    .getByRole("button")
    .filter({ hasNotText: "Skip" })
    .first();
  await chosen.click({ position: { x: 8, y: 12 } });
  await page.getByTestId("discard-selected").click();
  await expect(hand.locator("[aria-pressed=true]")).toHaveCount(0);
  for (
    let i = 0;
    i < 12 && !(await page.getByTestId("turn-banner").count());
    i++
  )
    await page.clock.fastForward(1000);
  await expect(hand.locator("[aria-pressed=true]")).toHaveCount(0);
  await page.getByTestId("draw-deck").click();
  const draggable = hand
    .getByRole("button")
    .filter({ hasNotText: "Skip" })
    .first();
  const id = await draggable.getAttribute("data-card-id");
  const source = await draggable.boundingBox(),
    target = await page.getByTestId("discard-pile").boundingBox();
  await page.mouse.move(source!.x + 8, source!.y + 12);
  await page.mouse.down();
  await page.mouse.move(
    target!.x + target!.width / 2,
    target!.y + target!.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(hand.locator(`[data-card-id="${id}"]`)).toHaveCount(0);
  await expect(
    page.getByTestId("discard-pile").locator(`[data-card-id="${id}"]`),
  ).toHaveCount(1);
});
test("invite links show name entry and a public player preview", async ({
  page,
}) => {
  const response = await page.request.post("/api/rooms", {
    data: { hostName: "Preview host" },
  });
  const room = await response.json();
  await page.goto(`/r/${room.roomId}`);
  await expect(
    page.getByRole("heading", { name: `Join room ${room.roomId}` }),
  ).toBeVisible();
  await expect(page.getByText("At the table: Preview host")).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Invite guest");
  await page
    .getByRole("button", { name: "Join the table", exact: true })
    .click();
  await expect(page.getByText("Game Lobby", { exact: true })).toBeVisible();
});
test("the real table tour is completable with the keyboard alone", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /How to Play/ }).press("Enter");
  const next = () =>
    page
      .getByTestId("tour-coach")
      .getByRole("button", { name: "Next", exact: true })
      .press("Enter");
  const card = (name: RegExp, region = "hand") =>
    page
      .getByTestId(region)
      .getByRole("button", { name })
      .first()
      .press("Enter");
  const meld = (id: string) =>
    page
      .locator(".table-melds")
      .getByTestId(`meld-${id}`)
      .getByRole("button")
      .press("Enter");
  await next();
  await page.getByTestId("draw-deck").press("Enter");
  await page.getByTestId("hand").getByRole("button").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByTestId("hand").getByRole("button").nth(1),
  ).toBeFocused();
  await page.keyboard.press("Alt+ArrowRight");
  await expect(
    page.getByTestId("hand").getByRole("button").nth(2),
  ).toBeFocused();
  await card(/7 of/);
  await next();
  await page.getByTestId("lay-down").press("Enter");
  await page.getByTestId("suggest-melds").press("Enter");
  await page.getByTestId("confirm-lay-down").press("Enter");
  await card(/7 of/);
  await meld("tour-run");
  await card(/Wild card/);
  await meld("tour-run");
  await page
    .getByTestId("hit-end-picker")
    .getByRole("button", { name: /Left end/ })
    .press("Enter");
  await card(/4 of/);
  await meld("tour-set");
  await card(/Skip card/);
  await page.getByTestId("discard-selected").press("Enter");
  await page
    .getByTestId("skip-picker")
    .getByRole("button", { name: /Skip Bot 1/ })
    .press("Enter");
  await expect(page.getByTestId("turn-banner")).toBeVisible();
  await page
    .getByTestId("discard-pile")
    .getByRole("button", { name: /Discard Pile/ })
    .press("Enter");
  await card(/4 of/);
  await meld("tour-set");
  await card(/11 of/);
  await page.getByTestId("discard-selected").press("Enter");
  await expect(page.getByTestId("tour-coach")).toContainText(
    "You finished the round!",
  );
  const finish = page.getByRole("button", {
    name: "Play a practice game",
    exact: true,
  });
  for (
    let i = 0;
    i < 12 && !(await finish.evaluate((el) => el === document.activeElement));
    i++
  )
    await page.keyboard.press("Tab");
  await expect(finish).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("tour-coach")).toHaveCount(0);
});
test("the visible motion setting switches travel off", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("pw_tour_suggested", "true"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Practice vs Bots/ }).click();
  await page.getByRole("button", { name: /Start Practice Game/ }).click();
  await page
    .getByRole("button", { name: "Game settings and shortcuts" })
    .click();
  await page.getByTestId("motion-toggle").click();
  await expect(page.getByTestId("game-table")).toHaveAttribute(
    "data-motion",
    "off",
  );
  await expect(page.getByTestId("card-travel")).toHaveCount(0);
});
