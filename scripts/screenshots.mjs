import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const b = await chromium.launch({ args: ["--no-proxy-server"] });
await fs.mkdir("docs/screenshots", { recursive: true });
const issues = [];
for (const [width, height] of [
  [360, 640],
  [640, 360],
  [768, 1024],
  [1280, 800],
])
  for (const players of [2, 4, 6])
    for (const theme of ["dark", "light", "high-contrast"]) {
      const page = await b.newPage({
        viewport: { width, height },
        reducedMotion: "reduce",
      });
      await page.addInitScript(
        ({ theme }) => {
          localStorage.setItem("pw_theme", theme);
          localStorage.setItem("pw_tour_suggested", "true");
          localStorage.setItem("pw_sound_enabled", "false");
        },
        { theme },
      );
      page.on("pageerror", (e) =>
        issues.push({ width, height, players, theme, error: e.message }),
      );
      await page.goto("http://127.0.0.1:5180");
      await page.getByRole("button", { name: /Practice vs Bots/ }).click();
      await page
        .getByRole("button", { name: String(players - 1), exact: true })
        .click();
      await page.getByRole("button", { name: /Start Practice Game/ }).click();
      await page.waitForTimeout(100);
      const filename = `${width}x${height}-${players}p-${theme}.png`;
      await page.screenshot({ path: `docs/screenshots/${filename}` });
      const geometry = await page.evaluate(() => {
        const q = (s) =>
          document.querySelector(s)?.getBoundingClientRect().toJSON();
        return {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          table: q(".center-table"),
          piles: q(".piles"),
          footer: q(".player-area"),
          header: q(".table-header"),
          arena: q(".table-arena"),
          hand: q(".hand-row"),
        };
      });
      if (
        geometry.width > width ||
        geometry.height > height ||
        geometry.piles.y < geometry.header.bottom ||
        (geometry.piles.bottom > geometry.footer.y &&
          geometry.piles.x + geometry.piles.width > geometry.footer.x)
      )
        issues.push({ filename, ...geometry });
      console.log(filename);
      await page.close();
    }
await fs.writeFile(
  "docs/screenshots/geometry.json",
  JSON.stringify(issues, null, 2),
);
console.log("ISSUES", issues.length);
await b.close();
