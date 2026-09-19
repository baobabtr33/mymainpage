"use client";

import { useEffect, useRef, useState } from "react";
import { useDashboard } from "@/lib/store";
import { assistantReplySchema, isCustom } from "@/lib/types";

type Message = { role: "user" | "assistant"; content: string; built?: string };

const SUGGESTIONS = [
  "Build me a habit tracker",
  "I need a to-do list",
  "Add a pomodoro timer",
  "Track my water intake",
  "Make a workout log with sets and reps",
  "A countdown to my next trip",
];

export default function Chat({
  open,
  setOpen,
  editingId,
  clearEditing,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  editingId: string | null;
  clearEditing: () => void;
}) {
  const { widgets, upsertWidget, removeWidget } = useDashboard();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const editing = editingId ? widgets.find((w) => w.id === editingId) : undefined;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, editingId]);

  async function send(text: string) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: prompt }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          history,
          widgets: widgets.map((w) => ({ id: w.id, title: w.title, kind: w.kind })),
          editing: editing && isCustom(editing) ? editing : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "The assistant is unavailable.");

      const parsed = assistantReplySchema.safeParse(body);
      if (!parsed.success) throw new Error("The assistant returned something I could not render.");

      const { reply, widget, remove } = parsed.data;
      if (widget) upsertWidget(widget);
      if (remove) removeWidget(remove);
      setMessages((m) => [...m, { role: "assistant", content: reply, built: widget?.title }]);
      clearEditing();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-primary fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full text-xl shadow-lg"
        aria-label={open ? "Close Pip" : "Open Pip"}
      >
        {open ? "✕" : "📎"}
      </button>

      {open ? (
        <aside className="card rise fixed bottom-20 right-5 z-40 flex h-[min(34rem,75vh)] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden">
          <header className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
            <span className="text-lg">📎</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">Pip</div>
              <div className="text-[11px] muted">Describe a widget, I build it into your page.</div>
            </div>
          </header>

          {editing ? (
            <div className="flex items-center gap-2 border-b px-4 py-2 text-[11px]" style={{ borderColor: "var(--border)" }}>
              <span className="chip">✎ editing {editing.title}</span>
              <button className="muted hover:underline" onClick={clearEditing}>
                cancel
              </button>
            </div>
          ) : null}

          <div ref={listRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm muted">
                  Ask for anything you want on your start page. I write it as a real widget — it saves its own data and
                  matches the theme.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chip hover:text-[var(--accent)]" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-[var(--accent)] text-[#0a0d18]" : "bg-[var(--surface-strong)]"
                  }`}
                >
                  {m.content}
                  {m.built ? <div className="mt-1 text-[11px] opacity-70">✓ added “{m.built}” to your page</div> : null}
                </div>
              </div>
            ))}

            {busy ? (
              <div className="flex items-center gap-1 text-sm muted">
                <span className="dot">●</span>
                <span className="dot" style={{ animationDelay: "0.15s" }}>
                  ●
                </span>
                <span className="dot" style={{ animationDelay: "0.3s" }}>
                  ●
                </span>
                <span className="ml-1 text-xs">building…</span>
              </div>
            ) : null}

            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          </div>

          <form
            className="flex items-end gap-2 border-t px-3 py-3"
            style={{ borderColor: "var(--border)" }}
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              ref={inputRef}
              className="field scroll-thin max-h-28 flex-1 resize-none"
              rows={1}
              placeholder={editing ? `Change ${editing.title}…` : "e.g. a reading list with progress"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </aside>
      ) : null}
    </>
  );
}
