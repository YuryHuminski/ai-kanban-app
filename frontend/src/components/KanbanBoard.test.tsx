import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as dnd from "@dnd-kit/core";
import { KanbanBoard } from "@/components/KanbanBoard";
import { mockServer, requestsTo } from "@/test/mockServer";

let dndProps: dnd.DndContextProps;

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: (props: dnd.DndContextProps) => {
      dndProps = props;
      return <actual.DndContext {...props} />;
    },
  };
});

afterEach(() => vi.unstubAllGlobals());

const renderBoard = async (options?: Parameters<typeof mockServer>[0]) => {
  const fetchMock = mockServer(options);
  render(<KanbanBoard onLogout={() => {}} />);
  await screen.findByTestId("column-col-1");
  return fetchMock;
};

// Server ids are plain numbers; the frontend prefixes them (see lib/api.ts).
const column = (id: string) => screen.getByTestId(`column-col-${id}`);

const drag = async (activeId: string, overId: string | null) => {
  await act(async () => {
    dndProps.onDragStart?.({ active: { id: activeId } } as dnd.DragStartEvent);
  });
  await act(async () => {
    dndProps.onDragEnd?.({
      active: { id: activeId },
      over: overId ? { id: overId } : null,
    } as dnd.DragEndEvent);
  });
};

describe("loading", () => {
  it("shows a loading state, then the board from the API", async () => {
    mockServer();
    render(<KanbanBoard onLogout={() => {}} />);
    expect(screen.getByText("Loading board...")).toBeInTheDocument();
    expect(await screen.findAllByTestId(/^column-/)).toHaveLength(5);
    expect(within(column("1")).getByText("Align roadmap themes")).toBeInTheDocument();
    expect(within(column("2")).getByText("No details yet.")).toBeInTheDocument();
  });

  it("shows an error and retries when the board cannot be loaded", async () => {
    const fetchMock = mockServer({ failOn: "GET /api/board" });
    render(<KanbanBoard onLogout={() => {}} />);
    expect(await screen.findByText("Could not load the board.")).toBeInTheDocument();

    fetchMock.mockClear();
    mockServer();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findAllByTestId(/^column-/)).toHaveLength(5);
  });
});

describe("column rename", () => {
  it("saves the new title to the API when the input loses focus", async () => {
    const fetchMock = await renderBoard();
    const input = within(column("1")).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Ideas");
    expect(requestsTo(fetchMock, "PUT /api/columns/1")).toHaveLength(0);

    await userEvent.tab();
    expect(requestsTo(fetchMock, "PUT /api/columns/1")).toEqual([{ title: "Ideas" }]);
    expect(await screen.findAllByText("Ideas")).not.toHaveLength(0);
  });

  it("restores the old title and makes no request when the title is blank", async () => {
    const fetchMock = await renderBoard();
    const input = within(column("1")).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue("Backlog");
    expect(requestsTo(fetchMock, "PUT /api/columns/1")).toHaveLength(0);
  });
});

describe("cards", () => {
  it("adds a card through the API", async () => {
    const fetchMock = await renderBoard();
    const backlog = column("1");
    await userEvent.click(within(backlog).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(backlog).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(backlog).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(backlog).getByRole("button", { name: /add card/i }));

    expect(await within(backlog).findByText("New card")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/cards")).toEqual([
      { column_id: "1", title: "New card", details: "Notes" },
    ]);
    expect(within(backlog).getByTestId("card-card-100")).toBeInTheDocument();
  });

  it("ignores an add with a blank title", async () => {
    const fetchMock = await renderBoard();
    const backlog = column("1");
    await userEvent.click(within(backlog).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(backlog).getByPlaceholderText(/card title/i), "   {enter}");
    expect(requestsTo(fetchMock, "POST /api/cards")).toHaveLength(0);
  });

  it("cancels adding a card", async () => {
    await renderBoard();
    const backlog = column("1");
    await userEvent.click(within(backlog).getByRole("button", { name: /add a card/i }));
    await userEvent.click(within(backlog).getByRole("button", { name: /^cancel$/i }));
    expect(within(backlog).getByRole("button", { name: /add a card/i })).toBeInTheDocument();
  });

  it("edits a card through the API", async () => {
    const fetchMock = await renderBoard();
    const backlog = column("1");
    await userEvent.click(within(backlog).getByRole("button", { name: /edit align roadmap themes/i }));
    const title = within(backlog).getByLabelText("Card title");
    const details = within(backlog).getByLabelText("Card details");
    await userEvent.clear(title);
    await userEvent.type(title, "Renamed card");
    await userEvent.clear(details);
    await userEvent.type(details, "Updated notes");
    await userEvent.click(within(backlog).getByRole("button", { name: /^save$/i }));

    expect(await within(backlog).findByText("Renamed card")).toBeInTheDocument();
    expect(within(backlog).getByText("Updated notes")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "PUT /api/cards/1")).toEqual([
      { title: "Renamed card", details: "Updated notes" },
    ]);
  });

  it("keeps the card and makes no request when editing is cancelled", async () => {
    const fetchMock = await renderBoard();
    const backlog = column("1");
    await userEvent.click(within(backlog).getByRole("button", { name: /edit align roadmap themes/i }));
    await userEvent.type(within(backlog).getByLabelText("Card title"), " changed");
    await userEvent.click(within(backlog).getByRole("button", { name: /^cancel$/i }));
    expect(within(backlog).getByText("Align roadmap themes")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "PUT /api/cards/1")).toHaveLength(0);
  });

  it("does not save a card with a blank title", async () => {
    const fetchMock = await renderBoard();
    const backlog = column("1");
    await userEvent.click(within(backlog).getByRole("button", { name: /edit align roadmap themes/i }));
    const title = within(backlog).getByLabelText("Card title");
    await userEvent.clear(title);
    await userEvent.type(title, "  {enter}");
    expect(requestsTo(fetchMock, "PUT /api/cards/1")).toHaveLength(0);
    expect(within(backlog).getByLabelText("Card title")).toBeInTheDocument();
  });

  it("deletes a card through the API", async () => {
    const fetchMock = await renderBoard();
    const backlog = column("1");
    await userEvent.click(within(backlog).getByRole("button", { name: /delete align roadmap themes/i }));
    await waitFor(() =>
      expect(within(backlog).queryByText("Align roadmap themes")).not.toBeInTheDocument()
    );
    expect(requestsTo(fetchMock, "DELETE /api/cards/1")).toHaveLength(1);
  });
});

describe("drag and drop", () => {
  it("moves a card to another column and tells the API the column and position", async () => {
    const fetchMock = await renderBoard();
    await drag("card-1", "col-3"); // drop on the empty In Progress column
    expect(within(column("3")).getByTestId("card-card-1")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/cards/1/move")).toEqual([
      { column_id: "3", position: 0 },
    ]);
  });

  it("sends the position when dropped on a card in another column", async () => {
    const fetchMock = await renderBoard();
    // Card 3 and column 3 share the server id "3"; the prefixes keep them apart.
    await drag("card-1", "card-3");
    expect(requestsTo(fetchMock, "POST /api/cards/1/move")).toEqual([
      { column_id: "2", position: 0 },
    ]);
  });

  it("reorders within a column", async () => {
    const fetchMock = await renderBoard();
    await drag("card-2", "card-1");
    expect(requestsTo(fetchMock, "POST /api/cards/2/move")).toEqual([
      { column_id: "1", position: 0 },
    ]);
  });

  it("makes no request when dropped outside or onto itself", async () => {
    const fetchMock = await renderBoard();
    await drag("card-1", null);
    await drag("card-1", "card-1");
    expect(requestsTo(fetchMock, "POST /api/cards/1/move")).toHaveLength(0);
  });
});

describe("chat sidebar", () => {
  it("sends a message, renders the reply, and refreshes the board from the response", async () => {
    const fetchMock = await renderBoard({
      chatResponse: {
        message: "Created it.",
        board: {
          columns: [
            { id: "1", title: "Backlog", cardIds: ["1", "2", "77"] },
            { id: "2", title: "Discovery", cardIds: ["3"] },
            { id: "3", title: "In Progress", cardIds: [] },
            { id: "4", title: "Review", cardIds: [] },
            { id: "5", title: "Done", cardIds: [] },
          ],
          cards: {
            "1": { id: "1", title: "Align roadmap themes", details: "Draft themes." },
            "2": { id: "2", title: "Gather customer signals", details: "Review notes." },
            "3": { id: "3", title: "Prototype analytics view", details: "" },
            "77": { id: "77", title: "AI card", details: "From chat" },
          },
        },
      },
    });

    await userEvent.type(screen.getByLabelText("Message"), "Create a card in Backlog");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(requestsTo(fetchMock, "POST /api/chat")).toEqual([
      { message: "Create a card in Backlog", history: [] },
    ]);
    expect(await screen.findByTestId("chat-message-user")).toHaveTextContent(
      "Create a card in Backlog"
    );
    expect(await screen.findByTestId("chat-message-assistant")).toHaveTextContent("Created it.");
    expect(within(column("1")).getByTestId("card-card-77")).toBeInTheDocument();
  });

  it("shows an error when sending fails", async () => {
    await renderBoard({ failOn: "POST /api/chat" });

    await userEvent.type(screen.getByLabelText("Message"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Could not send the message. Try again.")).toBeInTheDocument();
  });

  it("sends on Enter and keeps newline on Shift+Enter", async () => {
    const fetchMock = await renderBoard();
    const input = screen.getByLabelText("Message");

    await userEvent.type(input, "Line 1");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await userEvent.type(input, "Line 2");
    expect(input).toHaveValue("Line 1\nLine 2");
    expect(requestsTo(fetchMock, "POST /api/chat")).toHaveLength(0);

    await userEvent.keyboard("{Enter}");
    expect(requestsTo(fetchMock, "POST /api/chat")).toEqual([
      { message: "Line 1\nLine 2", history: [] },
    ]);
  });
});

describe("failures", () => {
  it("shows an error and reloads the board when an action fails", async () => {
    const fetchMock = await renderBoard({ failOn: "POST /api/cards/1/move" });
    await drag("card-1", "col-3");
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await waitFor(() => expect(requestsTo(fetchMock, "GET /api/board")).toHaveLength(2));
    // the reload restores the server's order
    await waitFor(() => expect(within(column("1")).getByTestId("card-card-1")).toBeInTheDocument());
  });
});

describe("logout", () => {
  it("calls onLogout when Log out is clicked", async () => {
    mockServer();
    const onLogout = vi.fn();
    render(<KanbanBoard onLogout={onLogout} />);
    await userEvent.click(await screen.findByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
