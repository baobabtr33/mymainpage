"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/store";
import { defaultWidgets, newId } from "@/lib/presets";
import type { Widget } from "@/lib/types";

const ACCENTS = ["#7c9cff", "#8ee6b8", "#ffb27c", "#ff8fb1", "#c79cff", "#6fd8e6"];

const BUILTINS: { kind: Widget["kind"]; label: string }[] = [
  { kind: "search", label: "🔎 Search" },
  { kind: "clock", label: "🕒 Clock" },
  { kind: "weather", label: "⛅ Weather" },
  { kind: "news", label: "📰 News" },
  { kind: "links", label: "🔗 Quick links" },
];

export type Tab = "dashboard" | "marketplace";

export default function TopBar({ tab, setTab, onSave }: { tab: Tab; setTab: (t: Tab) => void; onSave: () => void }) {
  const { prefs, setPrefs, addWidget, widgets, reset, mode, slug, saving, status, syncError } = useDashboard();
  const [menuOpen, setMenuOpen] = useState(false);

  // Theme + accent live on <html> so every CSS variable follows them.
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.style.setProperty("--accent", prefs.accent);
  }, [prefs.theme, prefs.accent]);

  const addBuiltin = (kind: Widget["kind"]) => {
    const template = defaultWidgets().find((w) => w.kind === kind);
    if (!template) return;
    addWidget({ ...template, id: newId(kind) } as Widget);
  };

  const syncLabel = syncError
    ? `⚠ ${syncError}`
    : saving
      ? "saving…"
      : mode === "owner"
        ? "synced"
        : mode === "viewer"
          ? "read-only"
          : "this device only";

  return (
    <header className="mb-6 flex flex-wrap items-center gap-2">
      <h1 className="text-lg font-semibold tracking-tight">
        my<span className="text-[var(--accent)]">main</span>page
      </h1>

      <nav className="flex gap-1 rounded-xl border p-1" style={{ borderColor: "var(--border)" }}>
        <button
          className={`btn ${tab === "dashboard" ? "btn-primary" : "btn-ghost"} px-3 py-1`}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`btn ${tab === "marketplace" ? "btn-primary" : "btn-ghost"} px-3 py-1`}
          onClick={() => setTab("marketplace")}
        >
          Marketplace
        </button>
      </nav>

      <span className="chip muted" title={status?.ai.model ?? undefined}>
        {status?.ai.ready ? `🤖 ${status.ai.provider}` : "🤖 offline templates"}
      </span>
      <span className={`chip ${syncError ? "text-rose-300" : "muted"}`}>{syncLabel}</span>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {slug ? (
          <button className="btn btn-ghost" onClick={onSave} title={`/p/${slug}`}>
            💾 Save / share
          </button>
        ) : null}

        <details className="relative" open={menuOpen} onToggle={(e) => setMenuOpen(e.currentTarget.open)}>
          <summary className="btn btn-ghost list-none">+ Widget</summary>
          <div className="card absolute right-0 z-30 mt-2 w-44 p-1.5">
            {BUILTINS.map((b) => (
              <button
                key={b.kind}
                className="btn btn-ghost w-full justify-start"
                onClick={() => {
                  addBuiltin(b.kind);
                  setMenuOpen(false);
                }}
              >
                {b.label}
              </button>
            ))}
            <p className="px-2 py-1.5 text-[11px] muted">Anything else: ask Pip (⌘K).</p>
          </div>
        </details>

        <input
          className="field w-28"
          placeholder="Your name"
          value={prefs.name}
          onChange={(e) => setPrefs({ name: e.target.value })}
        />

        <div className="flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: "var(--border)" }}>
          {ACCENTS.map((c) => (
            <button
              key={c}
              onClick={() => setPrefs({ accent: c })}
              className="h-4 w-4 rounded-full border transition-transform hover:scale-110"
              style={{ background: c, borderColor: prefs.accent === c ? "var(--text)" : "transparent" }}
              aria-label={`Accent ${c}`}
            />
          ))}
        </div>

        <button className="btn btn-ghost" onClick={() => setPrefs({ theme: prefs.theme === "dark" ? "light" : "dark" })}>
          {prefs.theme === "dark" ? "☀️" : "🌙"}
        </button>

        <button
          className="btn btn-ghost"
          onClick={() => {
            if (window.confirm("Reset the page back to the default widgets? Custom widgets and their data are deleted.")) reset();
          }}
          title="Reset dashboard"
        >
          ↺
        </button>

        <span className="chip muted">{widgets.length}</span>
      </div>
    </header>
  );
}
