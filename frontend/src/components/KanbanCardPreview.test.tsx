import { render, screen } from "@testing-library/react";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";

describe("KanbanCardPreview", () => {
  it("renders the card title and details", () => {
    render(<KanbanCardPreview card={{ id: "c", title: "Title", details: "Details" }} />);
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
  });
});
