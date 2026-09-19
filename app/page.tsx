"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readIdentity, writeIdentity } from "@/lib/store";
import Shell from "@/components/Shell";

/**
 * The root is a doorway: with a database it sends you to your own /p/<slug>
 * (creating one on first visit), otherwise it renders the local-only page.
 */
export default function Home() {
  const router = useRouter();
  const [localOnly, setLocalOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const boot = async () => {
      try {
        const status = await fetch("/api/status").then((r) => r.json());
        if (!alive) return;
        if (!status?.db) {
          setLocalOnly(true);
          return;
        }
        const identity = readIdentity();
        if (identity) {
          router.replace(`/p/${identity.slug}`);
          return;
        }
        const res = await fetch("/api/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Could not create your page");
        writeIdentity({ slug: body.slug, token: body.token });
        router.replace(`/p/${body.slug}`);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Could not start");
        setLocalOnly(true);
      }
    };
    boot();
    return () => {
      alive = false;
    };
  }, [router]);

  if (localOnly) return <Shell />;

  return (
    <main className="flex min-h-screen items-center justify-center p-8 text-sm muted">
      {error ?? "Setting up your page…"}
    </main>
  );
}
