import { execSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { columnIds, createCard, openCleanBoard } from "./helpers";

// Needs Docker and the scripts/ at the repo root, and replaces the container under test.
test("data survives removing and recreating the container (database volume)", async ({ page }) => {
  test.setTimeout(240_000);
  await openCleanBoard(page);
  const [backlog] = await columnIds(page);
  await createCard(page, backlog, "Survives restart", "Stored in the volume");

  const root = path.resolve(__dirname, "../..");
  execSync("scripts/stop.sh && scripts/start.sh", { cwd: root, stdio: "ignore" });

  // The session cookie stays valid: it is signed with a fixed secret.
  await expect
    .poll(async () => (await page.request.get("/api/me").catch(() => null))?.status(), {
      timeout: 60_000,
    })
    .toBe(200);

  await page.goto("/");
  await expect(page.getByText("Survives restart")).toBeVisible();
  await expect(page.getByText("Stored in the volume")).toBeVisible();
});
