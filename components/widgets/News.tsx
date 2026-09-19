"use client";

import { useDashboard, useFetch } from "@/lib/store";

type NewsData = { items: { id: number; title: string; url: string; host: string; score: number; comments: number }[] };

const SOURCES = [
  { key: "hn", label: "Top" },
  { key: "best", label: "Best" },
  { key: "new", label: "New" },
  { key: "show", label: "Show HN" },
];

export default function News({ id, settings }: { id: string; settings: Record<string, unknown> }) {
  const { setSettings } = useDashboard();
  const source = String(settings.source ?? "hn");
  const limit = Number(settings.limit ?? 8);
  const { data, error, loading } = useFetch<NewsData>(`/api/news?source=${source}&limit=${limit}`);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {SOURCES.map((s) => (
          <button
            key={s.key}
            onClick={() => setSettings(id, { source: s.key })}
            className={`chip ${source === s.key ? "text-[var(--accent)]" : "muted"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-[var(--surface-strong)]" />
          ))}
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      <ol className="flex flex-col gap-2">
        {data?.items.map((item, i) => (
          <li key={item.id} className="flex gap-2 text-sm leading-snug">
            <span className="w-4 shrink-0 text-right text-[11px] muted">{i + 1}</span>
            <a className="min-w-0 hover:text-[var(--accent)]" href={item.url} target="_blank" rel="noreferrer noopener">
              <span className="line-clamp-2">{item.title}</span>
              <span className="text-[11px] muted">
                {item.host} · {item.score} points · {item.comments} comments
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
