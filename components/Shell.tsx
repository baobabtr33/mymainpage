"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardProvider, useDashboard } from "@/lib/store";
import TopBar, { type Tab } from "./TopBar";
import Dashboard from "./Dashboard";
import Marketplace from "./Marketplace";
import Chat from "./Chat";
import SaveDialog, { SaveBanner } from "./SavePage";

function ViewerBanner() {
  const { mode, claimCopy } = useDashboard();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (mode !== "viewer") return null;

  return (
    <div className="card mb-4 flex flex-wrap items-center gap-3 p-3 text-sm">
      <span className="flex-1">
        You are looking at someone else&apos;s page. Changes here are not saved.
      </span>
      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const slug = await claimCopy();
          if (slug) router.push(`/p/${slug}`);
          setBusy(false);
        }}
      >
        {busy ? "Copying…" : "Make a copy I own"}
      </button>
    </div>
  );
}

function Inner() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setChatOpen((v) => !v);
      }
      if (e.key === "Escape") setChatOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-6">
      <TopBar tab={tab} setTab={setTab} onSave={() => setSaveOpen(true)} />
      <ViewerBanner />
      <SaveBanner onOpen={() => setSaveOpen(true)} />
      {tab === "dashboard" ? (
        <Dashboard
          onEditWidget={(id) => {
            setEditingId(id);
            setChatOpen(true);
          }}
        />
      ) : (
        <Marketplace />
      )}
      <footer className="mt-10 text-center text-[11px] muted">
        Press ⌘K to ask Pip for a new widget · “Save / share” keeps your page address.
      </footer>
      <Chat open={chatOpen} setOpen={setChatOpen} editingId={editingId} clearEditing={() => setEditingId(null)} />
      <SaveDialog open={saveOpen} onClose={() => setSaveOpen(false)} />
    </main>
  );
}

export default function Shell({ slug }: { slug?: string }) {
  return (
    <DashboardProvider slug={slug}>
      <Inner />
    </DashboardProvider>
  );
}
