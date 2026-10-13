"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { moveCard, type BoardData } from "@/lib/kanban";
import * as api from "@/lib/api";

type KanbanBoardProps = {
  onLogout: () => void;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const load = useCallback(() => {
    api
      .fetchBoard()
      .then((data) => {
        setBoard(data);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(load, [load]);

  // Runs a server call; on failure shows an error and reloads the server's version of the board.
  const act = async (action: () => Promise<void>) => {
    try {
      await action();
      setError("");
    } catch {
      setError("Something went wrong. The board was reloaded.");
      load();
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  // The board updates immediately so the drop feels instant; the server call follows.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!board || !over || active.id === over.id) {
      return;
    }

    const cardId = active.id as string;
    const columns = moveCard(board.columns, cardId, over.id as string);
    if (columns === board.columns) {
      return;
    }
    setBoard({ ...board, columns });
    const target = columns.find((column) => column.cardIds.includes(cardId))!;
    act(() => api.moveCardOnServer(cardId, target.id, target.cardIds.indexOf(cardId)));
  };

  const handleRenameColumn = (columnId: string, title: string) =>
    act(async () => {
      await api.renameColumn(columnId, title);
      setBoard((prev) =>
        prev && {
          ...prev,
          columns: prev.columns.map((column) =>
            column.id === columnId ? { ...column, title } : column
          ),
        }
      );
    });

  const handleAddCard = (columnId: string, title: string, details: string) =>
    act(async () => {
      const card = await api.createCard(columnId, title, details);
      setBoard((prev) =>
        prev && {
          ...prev,
          cards: { ...prev.cards, [card.id]: card },
          columns: prev.columns.map((column) =>
            column.id === columnId
              ? { ...column, cardIds: [...column.cardIds, card.id] }
              : column
          ),
        }
      );
    });

  const handleUpdateCard = (cardId: string, title: string, details: string) =>
    act(async () => {
      const card = await api.updateCard(cardId, title, details);
      setBoard((prev) => prev && { ...prev, cards: { ...prev.cards, [cardId]: card } });
    });

  const handleDeleteCard = (columnId: string, cardId: string) =>
    act(async () => {
      await api.deleteCard(cardId);
      setBoard((prev) =>
        prev && {
          ...prev,
          cards: Object.fromEntries(
            Object.entries(prev.cards).filter(([id]) => id !== cardId)
          ),
          columns: prev.columns.map((column) =>
            column.id === columnId
              ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
              : column
          ),
        }
      );
    });

  const handleSendChat = async () => {
    const message = chatInput.trim();
    if (!message || chatLoading || !board) {
      return;
    }

    const nextHistory: ChatMessage[] = [...chatHistory, { role: "user", content: message }];
    setChatInput("");
    setChatHistory(nextHistory);
    setChatError("");
    setChatLoading(true);

    try {
      const response = await api.chat(message, chatHistory);
      setChatHistory([...nextHistory, { role: "assistant", content: response.message }]);
      setBoard(response.board);
    } catch {
      setChatError("Could not send the message. Try again.");
    } finally {
      setChatLoading(false);
    }
  };

  if (!board) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        {loadFailed ? (
          <>
            <p role="alert" className="text-sm font-medium text-red-600">
              Could not load the board.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoadFailed(false);
                load();
              }}
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Retry
            </button>
          </>
        ) : (
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Loading board...
          </p>
        )}
      </main>
    );
  }

  const activeCard = activeCardId ? board.cards[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
              >
                Log out
              </button>
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        {error && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="grid gap-6 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onUpdateCard={handleUpdateCard}
                />
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <aside className="flex h-[720px] flex-col rounded-3xl border border-[var(--stroke)] bg-white/90 p-5 shadow-[var(--shadow)]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]">
              AI Assistant
            </h2>
            <p className="mt-2 text-xs leading-5 text-[var(--gray-text)]">
              Ask to create, edit, move, or delete cards.
            </p>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3">
              {chatHistory.length === 0 ? (
                <p className="text-xs text-[var(--gray-text)]">
                  No messages yet. Try: Create a card in Backlog called Plan kickoff.
                </p>
              ) : (
                chatHistory.map((item, index) => (
                  <div
                    key={`${item.role}-${index}`}
                    data-testid={`chat-message-${item.role}`}
                    className={`rounded-2xl px-3 py-2 text-sm leading-5 ${
                      item.role === "user"
                        ? "ml-8 bg-[var(--primary-blue)] text-white"
                        : "mr-8 border border-[var(--stroke)] bg-white text-[var(--navy-dark)]"
                    }`}
                  >
                    {item.content}
                  </div>
                ))
              )}
            </div>

            {chatError && (
              <p role="alert" className="mt-3 text-xs font-medium text-red-700">
                {chatError}
              </p>
            )}

            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                handleSendChat();
              }}
            >
              <label htmlFor="chat-input" className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Message
              </label>
              <textarea
                id="chat-input"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSendChat();
                  }
                }}
                rows={4}
                placeholder="Ask AI to update your board"
                className="w-full rounded-2xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {chatLoading ? "Sending..." : "Send"}
              </button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
};
