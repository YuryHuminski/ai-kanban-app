import { expect, test } from "@playwright/test";
import { openCleanBoard } from "./helpers";

test("chat uses API response to refresh the board", async ({ page }) => {
  await openCleanBoard(page);

  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Created via stub.",
        board_update: {
          operations: [
            {
              type: "create_card",
              column_id: "1",
              title: "Stubbed card",
              details: "From e2e chat",
            },
          ],
        },
        board: {
          columns: [
            { id: "1", title: "Backlog", cardIds: ["1"] },
            { id: "2", title: "Discovery", cardIds: [] },
            { id: "3", title: "In Progress", cardIds: [] },
            { id: "4", title: "Review", cardIds: [] },
            { id: "5", title: "Done", cardIds: [] },
          ],
          cards: {
            "1": { id: "1", title: "Stubbed card", details: "From e2e chat" },
          },
        },
      }),
    });
  });

  await page.getByLabel("Message").fill("Create a card");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByTestId("chat-message-assistant")).toContainText("Created via stub.");
  await expect(page.getByTestId("card-card-1")).toContainText("Stubbed card");
  await expect(page.getByText("From e2e chat")).toBeVisible();
});
