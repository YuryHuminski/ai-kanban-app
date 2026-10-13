import type { Page } from "@playwright/test";

const DEFAULT_TITLES = ["Backlog", "Discovery", "In Progress", "Review", "Done"];

type ApiBoard = { columns: { id: string }[]; cards: Record<string, unknown> };

/**
 * Signs in through the API and resets the board to its seeded state (default column titles, no
 * cards), then opens the app. The e2e tests share one database, so every test starts from here.
 * WARNING: this wipes the board of `user` in the app under test.
 */
export const openCleanBoard = async (page: Page) => {
  await page.request.post("/api/login", { data: { username: "user", password: "password" } });
  const board: ApiBoard = await (await page.request.get("/api/board")).json();
  for (const cardId of Object.keys(board.cards)) {
    await page.request.delete(`/api/cards/${cardId}`);
  }
  for (const [index, column] of board.columns.entries()) {
    await page.request.put(`/api/columns/${column.id}`, { data: { title: DEFAULT_TITLES[index] } });
  }
  await page.goto("/");
};

/** Column ids as the server numbers them, in board order. */
export const columnIds = async (page: Page): Promise<string[]> => {
  const board: ApiBoard = await (await page.request.get("/api/board")).json();
  return board.columns.map((column) => column.id);
};

/** Creates a card through the API; returns its server id. */
export const createCard = async (page: Page, columnId: string, title: string, details = "") => {
  const response = await page.request.post("/api/cards", {
    data: { column_id: columnId, title, details },
  });
  return (await response.json()).id as string;
};
