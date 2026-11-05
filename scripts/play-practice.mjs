import { chromium } from "@playwright/test";
import {
  getBotMove,
  createInitialState,
  createDeck,
} from "../packages/shared/dist/index.js";
import fs from "node:fs/promises";
const crowded = process.argv.includes("--crowded");
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const page = await browser.newPage({
  viewport: crowded
    ? { width: 360, height: 640 }
    : { width: 1280, height: 800 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("pw_tour_suggested", "true");
  localStorage.setItem("pw_assist_mode", "false");
  localStorage.setItem("pw_sound_enabled", "false");
  localStorage.setItem("pw_motion_enabled", "false");
});
await page.goto("http://127.0.0.1:5180");
await page.clock.install();
await page.getByRole("button", { name: /Practice vs Bots/ }).click();
await page
  .getByRole("button", { name: crowded ? "5" : "1", exact: true })
  .click();
await page.locator("input[type=checkbox]").check();
await page.getByRole("button", { name: /Start Practice Game/ }).click();
const catalog = new Map(createDeck().map((c) => [c.id, c]));
let actions = 0,
  rounds = 1;
try {
  for (let tick = 0; tick < 6000; tick++) {
    if (
      await page
        .getByRole("heading", { name: /Wins!|Win!|Winners|Game Over/i })
        .count()
    ) {
      break;
    }
    const restart = page.getByRole("button", { name: /Play Again/ });
    if (await restart.count()) {
      break;
    }
    const next = page.getByRole("button", { name: "Next Round", exact: true });
    if (await next.count()) {
      await next.click();
      rounds++;
      continue;
    }
    if (!(await page.getByTestId("turn-banner").count())) {
      await page.clock.fastForward(1000);
      continue;
    }
    const info = await page.evaluate(() => ({
      phase: document.querySelector("[data-testid=phase-panel] strong")
        ?.textContent,
      laid: document
        .querySelector("[data-testid=phase-panel] p")
        ?.textContent?.includes("Laid down"),
      draw: document
        .querySelector("[data-testid=turn-banner]")
        ?.textContent?.includes("Draw a card"),
      ids: [
        ...document.querySelectorAll("[data-testid=hand] [data-card-id]"),
      ].map((e) => e.getAttribute("data-card-id")),
      top: document
        .querySelector("[data-anchor=discard] [data-card-id]")
        ?.getAttribute("data-card-id"),
      melds: [...document.querySelectorAll(".table-melds .meld-group")].map(
        (e) => ({
          id: e.getAttribute("data-testid").slice(5),
          label: e.querySelector(".meld-label")?.textContent,
          ids: [...e.querySelectorAll("[data-card-id]")].map((c) =>
            c.getAttribute("data-card-id"),
          ),
        }),
      ),
    }));
    if (crowded && info.melds.length >= 2) {
      await page.getByTestId("coach-toggle").click();
      const geometry = await page.evaluate(() => {
        const q = (s) =>
          document.querySelector(s).getBoundingClientRect().toJSON();
        return {
          piles: q(".piles"),
          footer: q(".player-area"),
          melds: q(".table-melds"),
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        };
      });
      if (
        geometry.width > 360 ||
        geometry.height > 640 ||
        geometry.piles.right > 360 ||
        geometry.melds.right > 360 ||
        geometry.piles.bottom > geometry.footer.top ||
        geometry.melds.bottom > geometry.footer.top
      )
        throw new Error(JSON.stringify(geometry));
      await fs.writeFile(
        "docs/screenshots/crowded-geometry.json",
        JSON.stringify(geometry, null, 2),
      );
      break;
    }
    const state = createInitialState("UI", { id: "human-1", name: "You" });
    state.status = "playing";
    state.turnStage = info.draw ? "draw" : "action";
    state.currentTurnPlayerId = "human-1";
    state.players[0].hand = info.ids.map((id) => catalog.get(id));
    state.players[0].phase = Number(info.phase.match(/\d+/)[0]);
    state.players[0].hasLaidDownPhase = info.laid;
    state.players.push({
      ...state.players[0],
      id: "bot-1",
      name: "Bot 1",
      hand: [],
    });
    state.discardPile = info.top ? [catalog.get(info.top)] : [];
    state.tableMelds = info.melds.map((m) => {
      const run = m.label.match(/Run (\d+)–(\d+)/),
        set = m.label.match(/Set of (\d+)s/),
        color = m.label.match(/(red|blue|green|yellow) group/);
      return {
        id: m.id,
        ownerId: "bot-1",
        type: run ? "run" : set ? "set" : "color_group",
        targetNumber: set ? Number(set[1]) : undefined,
        targetColor: color?.[1],
        minRunValue: run ? Number(run[1]) : undefined,
        maxRunValue: run ? Number(run[2]) : undefined,
        cards: m.ids.map((id) => ({ cardId: id })),
      };
    });
    const action = getBotMove(state, "human-1");
    if (action.type === "DRAW_DECK")
      await page.getByTestId("draw-deck").click();
    if (action.type === "DRAW_DISCARD")
      await page
        .getByTestId("discard-pile")
        .getByRole("button", { name: /Discard Pile/ })
        .click();
    if (action.type === "LAY_DOWN_PHASE") {
      await page.getByTestId("lay-down").click();
      await page.getByTestId("suggest-melds").click();
      await page.getByTestId("confirm-lay-down").click();
    }
    if (action.type === "DISCARD" || action.type === "HIT_MELD") {
      const card = page
        .getByTestId("hand")
        .locator(`[data-card-id="${action.cardId}"]`);
      await card.click({ position: { x: 8, y: 12 } });
      if (action.type === "DISCARD") {
        await page.getByTestId("discard-selected").click();
        const skip = page.getByTestId("skip-picker");
        if (await skip.count())
          await skip.getByRole("button", { name: /Skip Bot 1 / }).click();
      } else {
        await page
          .locator(".table-melds")
          .getByTestId(`meld-${action.meldId}`)
          .getByRole("button")
          .click();
        const picker = page.getByTestId("hit-end-picker");
        if (await picker.count())
          await picker
            .getByRole("button", { name: /Right end|Left end/ })
            .first()
            .click();
      }
    }
    actions++;
    if (actions % 100 === 0)
      console.log("UI actions", actions, "rounds", rounds);
    const err = page.getByTestId("error-toast");
    if (await err.count()) throw new Error(await err.textContent());
    if (tick === 5999) throw new Error("Full practice game did not finish");
  }
  await page.screenshot({
    path: crowded
      ? "docs/screenshots/360x640-6p-with-melds.png"
      : "docs/screenshots/full-practice-finish.png",
  });
  const headings = await page.getByRole("heading").allTextContents();
  console.log(
    "FINISHED",
    JSON.stringify({ actions, rounds, errors, headings }),
  );
  await fs.writeFile(
    crowded
      ? "docs/screenshots/crowded-verification.json"
      : "docs/screenshots/practice-verification.json",
    JSON.stringify({ actions, rounds, errors, headings }, null, 2),
  );
} catch (e) {
  await page.screenshot({ path: "test-results/full-practice-error.png" });
  throw e;
} finally {
  await browser.close();
}
