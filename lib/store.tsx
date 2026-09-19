"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CustomWidget, Widget } from "./types";
import { defaultWidgets } from "./presets";

const DATA_KEY = "mymainpage:v1";
const IDENTITY_KEY = "mymainpage:identity";
const SAVED_KEY = "mymainpage:saved";

/** An owner link carries the token in the fragment: /p/<slug>#k=<token>. */
export const ownerLink = (origin: string, slug: string, token: string) => `${origin}/p/${slug}#k=${token}`;

export function isSaveAcknowledged(slug: string): boolean {
  try {
    return window.localStorage.getItem(SAVED_KEY) === slug;
  } catch {
    return false;
  }
}

export function acknowledgeSave(slug: string) {
  try {
    window.localStorage.setItem(SAVED_KEY, slug);
  } catch {
    // nothing to do: the banner simply shows again next visit
  }
}

export type Prefs = {
  name: string;
  theme: "dark" | "light";
  accent: string;
  place: string;
  units: "metric" | "imperial";
};

export type Dashboard = { prefs: Prefs; widgets: Widget[] };

export type Identity = { slug: string; token: string };

/** local = no database, owner = synced page you hold the token for, viewer = someone else's page. */
export type Mode = "loading" | "local" | "owner" | "viewer";

export const defaultPrefs: Prefs = {
  name: "",
  theme: "dark",
  accent: "#7c9cff",
  place: "Seoul",
  units: "metric",
};

export type ServerStatus = {
  db: boolean;
  ai: { ready: boolean; provider: string | null; model: string | null };
};

type Ctx = {
  ready: boolean;
  mode: Mode;
  slug: string | null;
  status: ServerStatus | null;
  saving: boolean;
  syncError: string | null;
  prefs: Prefs;
  widgets: Widget[];
  identity: Identity | null;
  setPrefs: (patch: Partial<Prefs>) => void;
  addWidget: (w: Widget) => void;
  upsertWidget: (w: CustomWidget) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, toIndex: number) => void;
  setSpan: (id: string, span: number) => void;
  setWidgetState: (id: string, next: Record<string, unknown>) => void;
  setSettings: (id: string, patch: Record<string, unknown>) => void;
  reset: () => void;
  claimCopy: () => Promise<string | null>;
};

const DashboardContext = createContext<Ctx | null>(null);

export function readIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    return parsed.slug && parsed.token ? { slug: parsed.slug, token: parsed.token } : null;
  } catch {
    return null;
  }
}

export function writeIdentity(identity: Identity) {
  try {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // private mode: the page still works, it just cannot be reclaimed later
  }
}

const TOKEN_PATTERN = /^[0-9a-fA-F-]{8,64}$/;

/** Read `#k=<token>` for this slug, store it, and strip it from the URL. */
export function claimTokenFromHash(slug?: string): Identity | null {
  if (typeof window === "undefined" || !slug) return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const token = new URLSearchParams(hash).get("k");
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const identity = { slug, token };
  writeIdentity(identity);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return identity;
}

function loadLocal(): Dashboard {
  if (typeof window === "undefined") return { prefs: defaultPrefs, widgets: defaultWidgets() };
  try {
    const raw = window.localStorage.getItem(DATA_KEY);
    if (!raw) return { prefs: defaultPrefs, widgets: defaultWidgets() };
    const parsed = JSON.parse(raw) as Partial<Dashboard>;
    return {
      prefs: { ...defaultPrefs, ...(parsed.prefs ?? {}) },
      widgets: Array.isArray(parsed.widgets) && parsed.widgets.length ? parsed.widgets : defaultWidgets(),
    };
  } catch {
    return { prefs: defaultPrefs, widgets: defaultWidgets() };
  }
}

const noopSubscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

export function DashboardProvider({ slug, children }: { slug?: string; children: ReactNode }) {
  const [data, setData] = useState<Dashboard>(loadLocal);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const mounted = useMounted();
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);

  // 1. Ask the server what it can do, then load the right source.
  useEffect(() => {
    let alive = true;
    const boot = async () => {
      let serverStatus: ServerStatus = { db: false, ai: { ready: false, provider: null, model: null } };
      try {
        const res = await fetch("/api/status");
        if (res.ok) serverStatus = (await res.json()) as ServerStatus;
      } catch {
        // offline: fall through to local mode
      }
      if (!alive) return;
      setStatus(serverStatus);

      // An owner link hands write access to this device, then leaves the URL clean
      // so the token is not left sitting in the address bar or in a shared screenshot.
      const claimed = claimTokenFromHash(slug);
      const stored = claimed ?? readIdentity();
      setIdentity(stored);

      if (!serverStatus.db || !slug) {
        setData(loadLocal());
        setMode("local");
        return;
      }

      const token = stored?.slug === slug ? stored.token : null;
      try {
        const res = await fetch(`/api/page/${slug}`, { headers: token ? { "x-edit-token": token } : undefined });
        const body = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(body?.error ?? "Could not load that page");
        setData({
          prefs: { ...defaultPrefs, ...(body.prefs ?? {}) },
          widgets: Array.isArray(body.widgets) && body.widgets.length ? body.widgets : defaultWidgets(),
        });
        setMode(body.owner ? "owner" : "viewer");
      } catch (e) {
        if (!alive) return;
        setSyncError(e instanceof Error ? e.message : "Could not load that page");
        setData(loadLocal());
        setMode("local");
      }
    };
    boot();
    return () => {
      alive = false;
    };
  }, [slug]);

  // 2. Persist: localStorage always, the database when this page is ours.
  useEffect(() => {
    if (mode === "loading") return;
    // A viewer is looking at someone else's page: never let it overwrite the
    // local cache of their own dashboard.
    if (mode !== "viewer") {
      try {
        window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
      } catch {
        // storage can be unavailable (private mode, blocked cookies)
      }
    }
    if (mode !== "owner" || !identity || !dirty.current) return;

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      dirty.current = false;
      setSaving(true);
      fetch(`/api/page/${identity.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-edit-token": identity.token },
        body: JSON.stringify({ prefs: data.prefs, widgets: data.widgets, displayName: data.prefs.name }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Save failed");
          setSyncError(null);
        })
        .catch((e: Error) => setSyncError(e.message))
        .finally(() => setSaving(false));
    }, 700);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [data, mode, identity]);

  const claimCopy = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { prefs: data.prefs, widgets: data.widgets, displayName: data.prefs.name } }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not create your page");
      writeIdentity({ slug: body.slug, token: body.token });
      setIdentity({ slug: body.slug, token: body.token });
      return body.slug as string;
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Could not create your page");
      return null;
    }
  }, [data]);

  const value = useMemo<Ctx>(() => {
    const update = (fn: (d: Dashboard) => Dashboard) => {
      dirty.current = true;
      setData(fn);
    };
    // Before mount the tree must match the server render, so expose defaults.
    const view: Dashboard = mounted ? data : { prefs: defaultPrefs, widgets: [] };
    return {
      ready: mounted && mode !== "loading",
      mode,
      slug: slug ?? null,
      status,
      saving,
      syncError,
      identity,
      prefs: view.prefs,
      widgets: view.widgets,
      setPrefs: (patch) => update((d) => ({ ...d, prefs: { ...d.prefs, ...patch } })),
      addWidget: (w) => update((d) => ({ ...d, widgets: [...d.widgets, w] })),
      upsertWidget: (w) =>
        update((d) => {
          const i = d.widgets.findIndex((x) => x.id === w.id);
          if (i === -1) return { ...d, widgets: [...d.widgets, w] };
          const widgets = [...d.widgets];
          const prev = widgets[i];
          // Keep whatever the user already typed into the widget it replaces.
          widgets[i] = prev.kind === "custom" ? { ...w, state: { ...w.state, ...prev.state } } : w;
          return { ...d, widgets };
        }),
      removeWidget: (id) => update((d) => ({ ...d, widgets: d.widgets.filter((w) => w.id !== id) })),
      moveWidget: (id, toIndex) =>
        update((d) => {
          const from = d.widgets.findIndex((w) => w.id === id);
          if (from === -1) return d;
          const widgets = [...d.widgets];
          const [w] = widgets.splice(from, 1);
          widgets.splice(Math.max(0, Math.min(toIndex, widgets.length)), 0, w);
          return { ...d, widgets };
        }),
      setSpan: (id, span) => update((d) => ({ ...d, widgets: d.widgets.map((w) => (w.id === id ? { ...w, span } : w)) })),
      setWidgetState: (id, next) =>
        update((d) => ({
          ...d,
          widgets: d.widgets.map((w) => (w.id === id && w.kind === "custom" ? { ...w, state: next } : w)),
        })),
      setSettings: (id, patch) =>
        update((d) => ({
          ...d,
          widgets: d.widgets.map((w) =>
            w.id === id && w.kind !== "custom" ? { ...w, settings: { ...w.settings, ...patch } } : w,
          ),
        })),
      reset: () => update(() => ({ prefs: defaultPrefs, widgets: defaultWidgets() })),
      claimCopy,
    };
  }, [data, mounted, mode, slug, status, saving, syncError, identity, claimCopy]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): Ctx {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return ctx;
}

/** Small helper for the built-in widgets that fetch from our API routes. */
export function useFetch<T>(url: string | null) {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  const key = `${url ?? ""}#${nonce}`;

  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? `request failed (${r.status})`);
        return body as T;
      })
      .then((data) => alive && setResult({ key, data, error: null }))
      .catch((e: Error) => alive && setResult({ key, data: null, error: e.message }));
    return () => {
      alive = false;
    };
  }, [url, key]);

  const fresh = result?.key === key ? result : null;
  return {
    data: fresh?.data ?? (result?.data as T | null | undefined) ?? null,
    error: fresh?.error ?? null,
    loading: Boolean(url) && !fresh,
    reload: () => setNonce((n) => n + 1),
  };
}
