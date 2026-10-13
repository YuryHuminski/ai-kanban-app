import { expect, test, type Page } from "@playwright/test";
import { columnIds, createCard, openCleanBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await openCleanBoard(page);
});

const column = (page: Page, id: string) => page.getByTestId(`column-col-${id}`);
const card = (page: Page, id: string) => page.getByTestId(`card-card-${id}`);

test("loads the seeded board", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  await expect(page.getByLabel("Column title").first()).toHaveValue("Backlog");
  await expect(page.locator('[data-testid^="card-"]')).toHaveCount(0);
});

test("adds a card and keeps it after reload", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-testid^="column-"]').first().getByText("Playwright card")).toBeVisible();
  await expect(page.getByText("Added via e2e.")).toBeVisible();
});

test("edits a card and keeps it after reload", async ({ page }) => {
  const [backlog] = await columnIds(page);
  const id = await createCard(page, backlog, "Original title", "Original details");
  await page.reload();

  await card(page, id).getByRole("button", { name: /edit original title/i }).click();
  await card(page, id).getByLabel("Card title").fill("Edited title");
  await card(page, id).getByLabel("Card details").fill("Edited details");
  await card(page, id).getByRole("button", { name: "Save", exact: true }).click();
  await expect(card(page, id).getByText("Edited title")).toBeVisible();

  await page.reload();
  await expect(card(page, id).getByText("Edited title")).toBeVisible();
  await expect(card(page, id).getByText("Edited details")).toBeVisible();
});

test("renames a column and keeps it after reload", async ({ page }) => {
  const [backlog] = await columnIds(page);
  const input = column(page, backlog).getByLabel("Column title");
  await input.fill("Ideas");
  await input.press("Enter");
  await expect(page.getByText("Ideas").first()).toBeVisible();

  await page.reload();
  await expect(column(page, backlog).getByLabel("Column title")).toHaveValue("Ideas");
});

test("removes a card and keeps it removed after reload", async ({ page }) => {
  const [backlog] = await columnIds(page);
  const id = await createCard(page, backlog, "Doomed card");
  await page.reload();

  await card(page, id).getByRole("button", { name: /delete doomed card/i }).click();
  await expect(card(page, id)).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Doomed card")).toHaveCount(0);
});

test("moves a card between columns and keeps its place after reload", async ({ page }) => {
  const ids = await columnIds(page);
  const backlog = ids[0];
  const review = ids[3];
  const id = await createCard(page, backlog, "Traveller");
  await page.reload();

  const cardBox = await card(page, id).boundingBox();
  const columnBox = await column(page, review).boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, { steps: 12 });
  await page.mouse.up();
  await expect(column(page, review).getByTestId(`card-card-${id}`)).toBeVisible();

  await page.reload();
  await expect(column(page, review).getByTestId(`card-card-${id}`)).toBeVisible();
  await expect(column(page, backlog).getByTestId(`card-card-${id}`)).toHaveCount(0);
});

test("a second sign-in shows the changes made earlier", async ({ page }) => {
  const [backlog] = await columnIds(page);
  await createCard(page, backlog, "Survives logout");
  await page.reload();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Survives logout")).toBeVisible();
});
