"use client";

import { useState } from "react";
import { useDashboard } from "@/lib/store";

const ENGINES: Record<string, { label: string; url: (q: string) => string }> = {
  google: { label: "Google", url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  bing: { label: "Bing", url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  ddg: { label: "DuckDuckGo", url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  perplexity: { label: "Perplexity", url: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}` },
};

export default function SearchBar({ id, settings }: { id: string; settings: Record<string, unknown> }) {
  const { setSettings } = useDashboard();
  const [q, setQ] = useState("");
  const engine = String(settings.engine ?? "google");

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        window.open(ENGINES[engine].url(q.trim()), "_blank", "noopener");
        setQ("");
      }}
    >
      <input
        className="field flex-1 text-base"
        placeholder={`Search ${ENGINES[engine].label}…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="flex gap-1">
        {Object.entries(ENGINES).map(([key, e]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSettings(id, { engine: key })}
            className={`chip ${engine === key ? "text-[var(--accent)]" : "muted"}`}
          >
            {e.label}
          </button>
        ))}
      </div>
    </form>
  );
}
