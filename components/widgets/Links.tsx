"use client";

import { useState } from "react";
import { useDashboard } from "@/lib/store";

type Link = { label: string; href: string };

const favicon = (href: string) => {
  try {
    return `https://www.google.com/s2/favicons?sz=64&domain=${new URL(href).hostname}`;
  } catch {
    return "";
  }
};

export default function Links({ id, settings }: { id: string; settings: Record<string, unknown> }) {
  const { setSettings } = useDashboard();
  const links = (Array.isArray(settings.links) ? settings.links : []) as Link[];
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");

  const add = () => {
    if (!label.trim() || !href.trim()) return;
    const url = href.startsWith("http") ? href.trim() : `https://${href.trim()}`;
    setSettings(id, { links: [...links, { label: label.trim(), href: url }] });
    setLabel("");
    setHref("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {links.map((l, i) => (
          <div key={`${l.href}-${i}`} className="group relative">
            <a
              href={l.href}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
              style={{ borderColor: "var(--border)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={favicon(l.href)} alt="" className="h-4 w-4 rounded" />
              <span className="truncate">{l.label}</span>
            </a>
            <button
              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-2)] text-[10px] group-hover:flex"
              onClick={() => setSettings(id, { links: links.filter((_, j) => j !== i) })}
              aria-label={`Remove ${l.label}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        <input className="field" placeholder="Name" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input
          className="field"
          placeholder="url"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn btn-ghost" onClick={add}>
          +
        </button>
      </div>
    </div>
  );
}
