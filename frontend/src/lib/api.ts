import type { BoardData, Card } from "@/lib/kanban";

// The database numbers columns and cards separately, so a column and a card can share an id.
// Drag and drop needs ids that are unique across both, so ids are prefixed here, at the
// boundary, and the prefix is removed again before anything is sent to the server.
const withPrefix = (prefix: "col" | "card", id: string) => `${prefix}-${id}`;
const raw = (id: string) => id.replace(/^(col|card)-/, "");

const toCard = (card: Card): Card => ({ ...card, id: withPrefix("card", card.id) });

const normalizeBoard = (board: BoardData): BoardData => ({
  columns: board.columns.map((column) => ({
    ...column,
    id: withPrefix("col", column.id),
    cardIds: column.cardIds.map((id) => withPrefix("card", id)),
  })),
  cards: Object.fromEntries(
    Object.values(board.cards).map((card) => [withPrefix("card", card.id), toCard(card)])
  ),
});

export type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  message: string;
  board: BoardData;
};

const request = async (url: string, method = "GET", body?: unknown) => {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${method} ${url} failed with ${response.status}`);
  }
  return response.status === 204 ? undefined : response.json();
};

export const fetchBoard = async (): Promise<BoardData> => {
  const board: BoardData = await request("/api/board");
  return normalizeBoard(board);
};

export const renameColumn = (columnId: string, title: string) =>
  request(`/api/columns/${raw(columnId)}`, "PUT", { title });

export const createCard = async (columnId: string, title: string, details: string) =>
  toCard(await request("/api/cards", "POST", { column_id: raw(columnId), title, details }));

export const updateCard = async (cardId: string, title: string, details: string) =>
  toCard(await request(`/api/cards/${raw(cardId)}`, "PUT", { title, details }));

export const deleteCard = (cardId: string) => request(`/api/cards/${raw(cardId)}`, "DELETE");

export const moveCardOnServer = (cardId: string, columnId: string, position: number) =>
  request(`/api/cards/${raw(cardId)}/move`, "POST", { column_id: raw(columnId), position });

export const chat = async (
  message: string,
  history: ChatHistoryItem[]
): Promise<{ message: string; board: BoardData }> => {
  const response: ChatResponse = await request("/api/chat", "POST", { message, history });
  return { message: response.message, board: normalizeBoard(response.board) };
};
