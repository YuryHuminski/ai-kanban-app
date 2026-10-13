import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as dnd from "@dnd-kit/core";
import { KanbanBoard } from "@/components/KanbanBoard";

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

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

const drag = (activeId: string, overId: string | null) => {
  act(() => {
    dndProps.onDragStart?.({ active: { id: activeId } } as dnd.DragStartEvent);
  });
  act(() => {
    dndProps.onDragEnd?.({
      active: { id: activeId },
      over: overId ? { id: overId } : null,
    } as dnd.DragEndEvent);
  });
};

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<KanbanBoard onLogout={() => {}} />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("calls onLogout when Log out is clicked", async () => {
    const onLogout = vi.fn();
    render(<KanbanBoard onLogout={onLogout} />);
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("renames a column", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("uses a default detail text when details are empty", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Bare card");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    expect(within(column).getByText("No details yet.")).toBeInTheDocument();
  });

  it("ignores an add with a blank title", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    const title = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(title, "   {enter}");
    expect(within(column).getByPlaceholderText(/card title/i)).toBeInTheDocument();
    expect(within(column).getAllByTestId(/^card-/)).toHaveLength(2);
  });

  it("cancels adding a card", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.click(within(column).getByRole("button", { name: /cancel/i }));
    expect(within(column).getByRole("button", { name: /add a card/i })).toBeInTheDocument();
  });

  it("edits a card title and details", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    const column = getFirstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );
    const title = within(column).getByLabelText("Card title");
    const details = within(column).getByLabelText("Card details");
    await userEvent.clear(title);
    await userEvent.type(title, "Renamed card");
    await userEvent.clear(details);
    await userEvent.type(details, "Updated notes");
    await userEvent.click(within(column).getByRole("button", { name: /^save$/i }));

    expect(within(column).getByText("Renamed card")).toBeInTheDocument();
    expect(within(column).getByText("Updated notes")).toBeInTheDocument();
    expect(within(column).queryByText("Align roadmap themes")).not.toBeInTheDocument();
  });

  it("keeps the original card when editing is cancelled", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    const column = getFirstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );
    await userEvent.type(within(column).getByLabelText("Card title"), " changed");
    await userEvent.click(within(column).getByRole("button", { name: /^cancel$/i }));
    expect(within(column).getByText("Align roadmap themes")).toBeInTheDocument();
  });

  it("does not save a card with a blank title", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    const column = getFirstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );
    const title = within(column).getByLabelText("Card title");
    await userEvent.clear(title);
    await userEvent.type(title, "  {enter}");
    expect(within(column).getByLabelText("Card title")).toBeInTheDocument();
  });

  it("moves a card to another column on drag end", () => {
    render(<KanbanBoard onLogout={() => {}} />);
    drag("card-1", "col-review");
    const review = screen.getByTestId("column-col-review");
    expect(within(review).getByTestId("card-card-1")).toBeInTheDocument();
  });

  it("leaves the board unchanged when dropped outside or onto itself", () => {
    render(<KanbanBoard onLogout={() => {}} />);
    drag("card-1", null);
    drag("card-1", "card-1");
    const backlog = screen.getByTestId("column-col-backlog");
    expect(within(backlog).getByTestId("card-card-1")).toBeInTheDocument();
  });
});
