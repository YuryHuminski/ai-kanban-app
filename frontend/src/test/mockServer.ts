import type { BoardData } from "@/lib/kanban";

export const testBoard: BoardData = {
  columns: [
    { id: "1", title: "Backlog", cardIds: ["1", "2"] },
    { id: "2", title: "Discovery", cardIds: ["3"] },
    { id: "3", title: "In Progress", cardIds: [] },
    { id: "4", title: "Review", cardIds: [] },
    { id: "5", title: "Done", cardIds: [] },
  ],
  cards: {
    "1": { id: "1", title: "Align roadmap themes", details: "Draft themes." },
    "2": { id: "2", title: "Gather customer signals", details: "Review notes." },
    "3": { id: "3", title: "Prototype analytics view", details: "" },
  },
};

type Options = {
  signedIn?: boolean;
  loginOk?: boolean;
  /** Requests whose "METHOD url" starts with this string get a 400. */
  failOn?: string;
  chatResponse?: {
    message: string;
    board: BoardData;
    board_update?: unknown;
  };
};

/** Replaces global fetch with a fake of the backend API. Returns the mock for assertions. */
export const mockServer = ({
  signedIn = true,
  loginOk = true,
  failOn,
  chatResponse,
}: Options = {}) => {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const key = `${method} ${url}`;
    const body = init.body ? JSON.parse(init.body as string) : {};
    const reply = (ok: boolean, data: unknown = {}, status = ok ? 200 : 400) => ({
      ok,
      status,
      json: async () => data,
    });

    if (failOn && key.startsWith(failOn)) return reply(false);
    if (key === "GET /api/me") return reply(signedIn);
    if (key === "POST /api/login") return reply(loginOk);
    if (key === "POST /api/logout") return reply(true);
    if (key === "GET /api/board") return reply(true, structuredClone(testBoard));
    if (key === "POST /api/chat") {
      return reply(
        true,
        chatResponse ?? {
          message: "Done.",
          board: structuredClone(testBoard),
        }
      );
    }
    if (key === "POST /api/cards") return reply(true, { id: "100", title: body.title, details: body.details }, 201);
    if (key.startsWith("PUT /api/cards/")) {
      return reply(true, { id: url.split("/").pop(), title: body.title, details: body.details });
    }
    if (key.startsWith("PUT /api/columns/")) return reply(true, { id: url.split("/").pop(), title: body.title });
    return reply(true, undefined, 204);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

/** JSON bodies of the requests made to "METHOD url". */
export const requestsTo = (fetchMock: ReturnType<typeof mockServer>, key: string) =>
  fetchMock.mock.calls
    .filter(([url, init]) => `${init?.method ?? "GET"} ${url}` === key)
    .map(([, init]) => (init?.body ? JSON.parse(init.body as string) : undefined));
