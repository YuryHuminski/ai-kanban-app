import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";

const mockFetch = (handlers: Record<string, boolean>) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({ ok: handlers[url] ?? true }))
  );

afterEach(() => vi.unstubAllGlobals());

describe("AuthGate", () => {
  it("shows the login form when not signed in", async () => {
    mockFetch({ "/api/me": false });
    render(<AuthGate />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("shows an error for wrong credentials and stays on the form", async () => {
    mockFetch({ "/api/me": false, "/api/login": false });
    render(<AuthGate />);
    await userEvent.type(await screen.findByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("shows the board after signing in, and the login form after logging out", async () => {
    mockFetch({ "/api/me": false });
    render(<AuthGate />);
    await userEvent.type(await screen.findByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the board straight away with an existing session", async () => {
    mockFetch({});
    render(<AuthGate />);
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });
});
