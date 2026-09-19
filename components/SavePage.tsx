"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeSave, isSaveAcknowledged, ownerLink, useDashboard, writeIdentity } from "@/lib/store";

function CopyRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span>{label}</span>
        <button
          className="btn btn-ghost px-2 py-0.5 text-[11px]"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            } catch {
              // clipboard blocked: the field below is selectable
            }
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <input className="field font-mono text-[11px]" value={value} readOnly onFocus={(e) => e.currentTarget.select()} />
      <p className="text-[11px] muted">{hint}</p>
    </div>
  );
}

/** Nudges a brand-new page owner to keep their address before they lose it. */
export function SaveBanner({ onOpen }: { onOpen: () => void }) {
  const { mode, slug, ready } = useDashboard();
  const [dismissed, setDismissed] = useState(false);

  if (!ready || mode !== "owner" || !slug || dismissed || isSaveAcknowledged(slug)) return null;

  return (
    <div className="card mb-4 flex flex-wrap items-center gap-3 p-3 text-sm">
      <span className="flex-1">
        This page lives at <span className="font-mono">/p/{slug}</span>. There is no login — save the link or you
        cannot get back to it.
      </span>
      <button className="btn btn-primary" onClick={onOpen}>
        Save my page
      </button>
      <button
        className="btn btn-ghost"
        onClick={() => {
          acknowledgeSave(slug);
          setDismissed(true);
        }}
      >
        Already saved
      </button>
    </div>
  );
}

export default function SaveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { slug, identity, mode } = useDashboard();
  const router = useRouter();
  const [restore, setRestore] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  if (!open) return null;

  const viewUrl = slug ? `${origin}/p/${slug}` : "";
  const editUrl = identity ? ownerLink(origin, identity.slug, identity.token) : "";

  const download = () => {
    if (!identity) return;
    const body = [
      "mymainpage — keep this file, it is the only key to your page",
      "",
      `Page address : ${origin}/p/${identity.slug}`,
      `Edit link    : ${ownerLink(origin, identity.slug, identity.token)}`,
      `Edit token   : ${identity.token}`,
      "",
      "Open the edit link on any device to get editing rights there.",
      "Anyone holding it can change your page, so treat it like a password.",
      "The page address alone is read-only and safe to share.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `mymainpage-${identity.slug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    acknowledgeSave(identity.slug);
  };

  const applyRestore = () => {
    const text = restore.trim();
    const match = text.match(/\/p\/([a-z0-9]+)(?:[#?].*k=([0-9a-fA-F-]{8,64}))?/);
    const token = match?.[2] ?? (/^[0-9a-fA-F-]{8,64}$/.test(text) ? text : null);
    const target = match?.[1] ?? slug;
    if (!target || !token) {
      setRestoreError("Paste a full edit link, or the page address plus its token.");
      return;
    }
    writeIdentity({ slug: target, token });
    // Same address: the provider already booted for this slug, so reload to re-read
    // the identity. Different address: a normal client navigation remounts it.
    if (target === slug) window.location.reload();
    else router.push(`/p/${target}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className="card rise flex w-full max-w-lg flex-col gap-4 p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Save your page"
      >
        <header className="flex items-start gap-2">
          <div className="flex-1">
            <h2 className="text-base font-semibold">Save your page</h2>
            <p className="text-xs muted">
              No accounts here. Your page is its address, and editing rights live in this browser.
            </p>
          </div>
          <button className="btn btn-ghost px-2 py-0.5" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {slug ? <CopyRow label="Page link (read-only)" value={viewUrl} hint="Safe to share — visitors can look and copy, not edit." /> : null}

        {editUrl ? (
          <CopyRow
            label="Edit link (keep private)"
            value={editUrl}
            hint="Opens with editing rights on any device. Anyone who has it can change your page."
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          {identity ? (
            <button className="btn btn-primary" onClick={download}>
              ⬇ Download recovery file
            </button>
          ) : null}
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (slug) acknowledgeSave(slug);
              onClose();
            }}
          >
            Done, I saved it
          </button>
        </div>

        <ol className="flex flex-col gap-1 rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border)" }}>
          <li>
            <strong>1.</strong> Bookmark this tab — <span className="font-mono">⌘D</span> on Mac,{" "}
            <span className="font-mono">Ctrl+D</span> elsewhere.
          </li>
          <li>
            <strong>2.</strong> Keep the edit link somewhere private (password manager, notes) or download the file above.
          </li>
          <li>
            <strong>3.</strong> On a new device, open the edit link once — this browser then remembers it.
          </li>
        </ol>

        <div className="flex flex-col gap-1 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <label className="text-xs font-semibold">
            {mode === "owner" ? "Move a different page here" : "Restore editing access"}
          </label>
          <div className="flex gap-2">
            <input
              className="field flex-1"
              placeholder="Paste an edit link or token"
              value={restore}
              onChange={(e) => {
                setRestore(e.target.value);
                setRestoreError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && applyRestore()}
            />
            <button className="btn btn-ghost" onClick={applyRestore}>
              Restore
            </button>
          </div>
          {restoreError ? <p className="text-[11px] text-rose-300">{restoreError}</p> : null}
        </div>
      </div>
    </div>
  );
}
