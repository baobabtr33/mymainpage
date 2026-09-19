"use client";

import { useSyncExternalStore } from "react";

const greet = (hour: number) =>
  hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

/** One shared ticking source keeps the clock hydration-safe: null on the server. */
const subscribe = (notify: () => void) => {
  const t = window.setInterval(notify, 1000);
  return () => window.clearInterval(t);
};

export default function Clock({ name }: { name: string }) {
  const second = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000),
    () => null,
  );

  if (second === null) return <div className="h-20 animate-pulse rounded-xl bg-[var(--surface-strong)]" />;

  const now = new Date(second * 1000);
  return (
    <div>
      <div className="font-mono text-4xl font-semibold tabular-nums tracking-tight">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        <span className="ml-1 text-base muted">{String(now.getSeconds()).padStart(2, "0")}</span>
      </div>
      <div className="mt-1 text-sm muted">
        {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
      </div>
      <div className="mt-3 text-sm">
        {greet(now.getHours())}
        {name ? `, ${name}` : ""}.
      </div>
    </div>
  );
}
