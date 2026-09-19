"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/lib/store";
import { customWidgetSchema, isCustom, type CustomWidget, type MarketItem } from "@/lib/types";
import {
  countdownWidget,
  expensesWidget,
  habitWidget,
  moodWidget,
  newId,
  notesWidget,
  pomodoroWidget,
  readingWidget,
  todoWidget,
  waterWidget,
} from "@/lib/presets";
import SpecWidget from "./SpecWidget";

/** Shown when no database is configured, so the tab is never empty. */
const STARTERS: { build: () => CustomWidget; description: string; tags: string[] }[] = [
  { build: todoWidget, description: "Tasks with a done counter and progress bar.", tags: ["productivity"] },
  { build: habitWidget, description: "Seven-day grid, one row per habit.", tags: ["habits"] },
  { build: pomodoroWidget, description: "25/5/15 focus timer that counts finished sessions.", tags: ["focus"] },
  { build: notesWidget, description: "A plain scratchpad that remembers itself.", tags: ["notes"] },
  { build: waterWidget, description: "Glasses per day against a goal.", tags: ["health"] },
  { build: expensesWidget, description: "Log spending against a monthly budget.", tags: ["money"] },
  { build: readingWidget, description: "Save links and tick them off.", tags: ["reading"] },
  { build: moodWidget, description: "One tap a day, with a running log.", tags: ["journal"] },
  { build: countdownWidget, description: "Days until any date you pick.", tags: ["time"] },
];

function Preview({ spec }: { spec: CustomWidget }) {
  const [draft, setDraft] = useState(spec);
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
      <SpecWidget widget={draft} onState={(state) => setDraft((d) => ({ ...d, state }))} />
    </div>
  );
}

function Card({
  item,
  onInstall,
  onUnpublish,
  installing,
}: {
  item: MarketItem;
  onInstall: () => void;
  onUnpublish?: () => void;
  installing: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className="card flex flex-col gap-2 p-4">
      <header className="flex items-start gap-2">
        <span className="text-xl leading-none">{item.icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{item.title}</h3>
          <p className="text-[11px] muted">
            by {item.authorName} · {item.installs} {item.installs === 1 ? "install" : "installs"}
          </p>
        </div>
      </header>

      {item.description ? <p className="text-xs muted">{item.description}</p> : null}

      {item.tags.length ? (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((t) => (
            <span key={t} className="chip muted">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {open ? <Preview spec={item.spec} /> : null}

      <div className="mt-auto flex gap-1 pt-1">
        <button className="btn btn-primary flex-1" onClick={onInstall} disabled={installing}>
          {installing ? "Adding…" : "Add to my page"}
        </button>
        <button className="btn btn-ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Preview"}
        </button>
        {onUnpublish ? (
          <button className="btn btn-danger" onClick={onUnpublish}>
            Unpublish
          </button>
        ) : null}
      </div>
    </article>
  );
}

function PublishPanel({ onPublished }: { onPublished: () => void }) {
  const { widgets, identity, prefs, mode } = useDashboard();
  const mine = widgets.filter(isCustom);
  const [selected, setSelected] = useState<string>("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [author, setAuthor] = useState(prefs.name);
  const [includeData, setIncludeData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const widget = mine.find((w) => w.id === selected);

  if (mode !== "owner") {
    return (
      <p className="text-xs muted">
        Publishing needs a page of your own. {mode === "viewer" ? "Use “Make a copy” above first." : ""}
      </p>
    );
  }

  const publish = async () => {
    if (!widget || !identity) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: identity.slug,
          token: identity.token,
          title: widget.title,
          description,
          tags: tags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 6),
          authorName: author.trim() || "anonymous",
          includeData,
          spec: widget,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Publish failed");
      setDone(`“${widget.title}” is live in the marketplace.`);
      setDescription("");
      setTags("");
      onPublished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-col gap-2 p-4">
      <h3 className="text-sm font-semibold">Share one of your widgets</h3>
      {mine.length === 0 ? (
        <p className="text-xs muted">Ask Pip for a widget first — built-in weather and news cards cannot be shared.</p>
      ) : (
        <>
          <select className="field" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Pick a widget…</option>
            {mine.map((w) => (
              <option key={w.id} value={w.id} className="bg-[var(--bg-2)]">
                {w.icon} {w.title}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder="What does it do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-2">
            <input className="field" placeholder="tags, comma, separated" value={tags} onChange={(e) => setTags(e.target.value)} />
            <input className="field" placeholder="Your name" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-xs muted">
            <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--accent)]" checked={includeData} onChange={(e) => setIncludeData(e.target.checked)} />
            Include my current entries (off = share an empty copy)
          </label>
          <button className="btn btn-primary" onClick={publish} disabled={!widget || busy}>
            {busy ? "Publishing…" : "Publish"}
          </button>
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          {done ? <p className="text-xs text-emerald-300">{done}</p> : null}
        </>
      )}
    </div>
  );
}

export default function Marketplace() {
  const { addWidget, status, identity } = useDashboard();
  const dbOn = Boolean(status?.db);
  const [result, setResult] = useState<{ key: string; items: MarketItem[]; error: string | null } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"popular" | "new">("popular");
  const [onlyMine, setOnlyMine] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  // Fetch shape mirrors lib/store's useFetch: state only changes in async callbacks,
  // so a re-render never cascades out of the effect.
  const url = useMemo(() => {
    if (!dbOn) return null;
    const params = new URLSearchParams({ sort });
    if (q.trim()) params.set("q", q.trim());
    if (identity) params.set("mine", identity.slug);
    return `/api/market?${params}`;
  }, [dbOn, sort, q, identity]);

  const key = `${url ?? ""}#${nonce}`;

  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Could not load the marketplace");
        return (body.items as unknown[]).flatMap((raw) => {
          const row = raw as MarketItem;
          const spec = customWidgetSchema.safeParse(row.spec);
          return spec.success ? [{ ...row, spec: spec.data }] : [];
        });
      })
      .then((list) => alive && setResult({ key, items: list, error: null }))
      .catch((e: Error) => alive && setResult({ key, items: [], error: e.message }));
    return () => {
      alive = false;
    };
  }, [url, key]);

  const fresh = result?.key === key ? result : null;
  const items = fresh?.items ?? result?.items ?? [];
  const loading = Boolean(url) && !fresh;
  const loadError = fresh?.error ?? null;
  const load = useCallback(() => setNonce((n) => n + 1), []);

  const install = async (item: MarketItem) => {
    setInstalling(item.id);
    try {
      const res = await fetch("/api/market/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Install failed");
      const spec = customWidgetSchema.parse(body.spec);
      addWidget({ ...spec, id: newId("w") });
      setResult((r) =>
        r ? { ...r, items: r.items.map((i) => (i.id === item.id ? { ...i, installs: body.installs } : i)) } : r,
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Install failed");
    } finally {
      setInstalling(null);
    }
  };

  const unpublish = async (item: MarketItem) => {
    if (!identity) return;
    try {
      const res = await fetch(`/api/market?id=${item.id}&slug=${identity.slug}`, {
        method: "DELETE",
        headers: { "x-edit-token": identity.token },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Unpublish failed");
      setResult((r) => (r ? { ...r, items: r.items.filter((i) => i.id !== item.id) } : r));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unpublish failed");
    }
  };

  const starters = useMemo<MarketItem[]>(
    () =>
      STARTERS.map((s, i) => {
        const spec = s.build();
        return {
          id: `starter-${i}`,
          title: spec.title,
          description: s.description,
          icon: spec.icon,
          tags: s.tags,
          spec,
          installs: 0,
          authorName: "mymainpage",
          authorSlug: "",
          mine: false,
          createdAt: "",
        };
      }),
    [],
  );

  const visible = onlyMine ? items.filter((i) => i.mine) : items;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <input
          className="field flex-1 min-w-40"
          placeholder="Search widgets…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={!dbOn}
        />
        <button className={`chip ${sort === "popular" ? "text-[var(--accent)]" : "muted"}`} onClick={() => setSort("popular")}>
          Popular
        </button>
        <button className={`chip ${sort === "new" ? "text-[var(--accent)]" : "muted"}`} onClick={() => setSort("new")}>
          Newest
        </button>
        <button className={`chip ${onlyMine ? "text-[var(--accent)]" : "muted"}`} onClick={() => setOnlyMine((v) => !v)}>
          Mine
        </button>
        <button className="btn btn-ghost" onClick={load} disabled={!dbOn}>
          ↻
        </button>
      </div>

      {!dbOn ? (
        <p className="text-xs muted">
          No database is configured, so this is the built-in starter gallery. Set MAINPAGE_SUPABASE_URL and
          MAINPAGE_SUPABASE_SERVICE_KEY to browse and publish community widgets.
        </p>
      ) : null}
      {loadError ?? actionError ? <p className="text-xs text-rose-300">{loadError ?? actionError}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(dbOn ? visible : starters).map((item) => (
          <Card
            key={item.id}
            item={item}
            installing={installing === item.id}
            onInstall={() =>
              dbOn ? install(item) : addWidget({ ...item.spec, id: newId("w") })
            }
            onUnpublish={item.mine ? () => unpublish(item) : undefined}
          />
        ))}
      </div>

      {dbOn && !loading && visible.length === 0 ? (
        <p className="text-sm muted">Nothing published yet — be the first.</p>
      ) : null}

      {dbOn ? <PublishPanel onPublished={load} /> : null}
    </div>
  );
}
