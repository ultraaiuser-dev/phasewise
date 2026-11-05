import { test, expect } from "@playwright/test";

test.describe("Phasewise E2E Tests", () => {
  test("3 players create room, join by code, start game, play turns, refresh to rejoin, and check illegal move", async ({
    browser,
  }) => {
    // Context 1: Alice (Host)
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto("/");

    // Alice creates room
    await page1.fill("input#player-name-input", "Alice");
    await page1.click('button:has-text("Create Multiplayer Room")');

    // Wait for Lobby view and get Room Code
    await page1.waitForSelector("text=Game Lobby");
    const roomCodeEl = await page1.waitForSelector(".text-4xl, .text-5xl");
    const roomCode = (await roomCodeEl.textContent())?.trim();
    expect(roomCode).toHaveLength(5);

    // Context 2: Bob (Joins with code)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await page2.fill("input#player-name-input", "Bob");
    await page2.click('button:has-text("Join with Room Code")');
    await page2.fill('input[placeholder="5-letter code"]', roomCode!);
    await page2.getByRole("button", { name: "Join", exact: true }).click();

    // Context 3: Charlie (Joins with code)
    const context3 = await browser.newContext();
    const page3 = await context3.newPage();
    await page3.goto("/");
    await page3.fill("input#player-name-input", "Charlie");
    await page3.click('button:has-text("Join with Room Code")');
    await page3.fill('input[placeholder="5-letter code"]', roomCode!);
    await page3.getByRole("button", { name: "Join", exact: true }).click();

    // In Alice's lobby, all 3 players should be visible
    await expect(page1.locator("text=Bob").first()).toBeVisible();
    await expect(page1.locator("text=Charlie").first()).toBeVisible();

    // Alice starts the game
    const startButton = page1.locator('button:has-text("Start Game")');
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // All 3 pages should transition to game table with their hand region visible
    await expect(
      page1.getByRole("region", { name: "Your Hand" }),
    ).toBeVisible();
    await expect(
      page2.getByRole("region", { name: "Your Hand" }),
    ).toBeVisible();
    await expect(
      page3.getByRole("region", { name: "Your Hand" }),
    ).toBeVisible();

    // Find the player whose turn it is by waiting for data-testid="turn-banner"
    const pages = [page1, page2, page3];
    let activePage = page1;
    let found = false;

    for (let attempt = 0; attempt < 30; attempt++) {
      for (const p of pages) {
        if (await p.locator('[data-testid="turn-banner"]').isVisible()) {
          activePage = p;
          found = true;
          break;
        }
      }
      if (found) break;
      await page1.waitForTimeout(200);
    }

    expect(found).toBe(true);

    // Active player attempts an illegal move: discarding before drawing!
    await activePage.getByTestId("discard-selected").click({ force: true });

    // Should display human-friendly illegal move error toast
    await expect(
      activePage
        .getByTestId("error-toast")
        .getByText("You must draw a card before you can discard.", {
          exact: true,
        }),
    ).toBeVisible();

    // Now active player performs legal draw from deck
    await activePage.click('[aria-label*="Draw Pile"]');

    // Hand should now be in action stage
    await expect(activePage.locator("text=Play Melds / Discard")).toBeVisible();

    // Select a card and discard it
    const handCards = activePage.locator(
      '[aria-label="Your Hand"] [role="button"]',
    );
    await handCards
      .filter({ hasNotText: "Skip" })
      .first()
      .click({ position: { x: 8, y: 12 } });
    await activePage.click('button:has-text("Discard Selected")');

    const confirm = activePage.getByRole("button", {
      name: "Discard anyway",
      exact: true,
    });
    if (await confirm.isVisible()) await confirm.click();

    // Page refresh mid-game test: Refresh page 2 (Bob)
    await page2.reload();
    // Bob should automatically rejoin without being kicked to landing
    await expect(
      page2.getByRole("region", { name: "Your Hand" }),
    ).toBeVisible();

    await context1.close();
    await context2.close();
    await context3.close();
  });

  test("mobile viewport (360px wide) practice mode test", async ({
    browser,
  }) => {
    // 360x740 viewport (Galaxy S8 / modern narrow mobile)
    const context = await browser.newContext({
      viewport: { width: 360, height: 740 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("/");

    // Check title
    await expect(
      page.getByRole("heading", { name: "Phasewise" }),
    ).toBeVisible();

    // Practice vs Bots button
    await page.click('button:has-text("Practice vs Bots")');
    await page.click('button:has-text("Start Practice Game")');

    // Game table should be rendered comfortably on 360px
    await expect(page.locator("text=ROOM: PRACTICE")).toBeVisible();
    await expect(page.getByRole("region", { name: "Your Hand" })).toBeVisible();

    // Sorting buttons work
    await page.click('button:has-text("Sort #")');
    await page.click('button:has-text("Sort Color")');

    // Open scoreboard modal on mobile
    await page
      .getByRole("button", { name: "Game settings and shortcuts" })
      .click();
    await page.getByRole("button", { name: "Scoreboard", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Scoreboard", exact: true }),
    ).toBeVisible();
    await page.click('button[aria-label="Close scoreboard"]');

    await context.close();
  });

  test("guided tutorial is reachable and dismissible", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /How to Play/ }).click();
    await expect(page.getByTestId("tour-coach")).toContainText(
      "Welcome to Phasewise!",
    );
    await page.getByRole("button", { name: "Close tutorial" }).click();
    await expect(page.getByTestId("tour-coach")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Your Hand", exact: true }),
    ).toBeVisible();
  });
});
