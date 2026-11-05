import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  localStorage.setItem("pw_sound_enabled", "false");
  localStorage.setItem("pw_tour_suggested", "true");
  localStorage.setItem("pw_assist_mode", "false");
});
await page.goto("http://127.0.0.1:5180");
await page.getByRole("button", { name: /How to Play/ }).click();
await page.waitForTimeout(120);
console.log("Deal flights", await page.getByTestId("card-travel").count());
await page.screenshot({
  path: "docs/screenshots/animation-deal.png",
  animations: "allow",
});
await page.waitForTimeout(2300);
await page
  .getByTestId("tour-coach")
  .getByRole("button", { name: "Next", exact: true })
  .click();
await page.getByTestId("draw-deck").click();
await page.waitForTimeout(100);
console.log("Draw flights", await page.getByTestId("card-travel").count());
await page.screenshot({
  path: "docs/screenshots/animation-draw.png",
  animations: "allow",
});
await page.getByRole("button", { name: "Close tutorial" }).click();
for (let i = 0; i < 12 && !(await page.getByTestId("turn-banner").count()); i++)
  await page.waitForTimeout(800);
await page.waitForTimeout(800);
await page.getByTestId("draw-deck").click();
const card = page
  .getByTestId("hand")
  .getByRole("button")
  .filter({ hasNotText: "Skip" })
  .first();
await card.click({ position: { x: 8, y: 12 } });
await page.getByTestId("discard-selected").click();
await page.waitForTimeout(90);
console.log("Discard flights", await page.getByTestId("card-travel").count());
await page.screenshot({
  path: "docs/screenshots/animation-discard.png",
  animations: "allow",
});
await browser.close();
