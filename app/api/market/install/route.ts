import { NextResponse } from "next/server";
import { z } from "zod";
import { db, dbConfigured, type MarketRow } from "@/lib/db";

const schema = z.object({ id: z.string().uuid() });

/** Hand back a fresh copy of the spec and count the install. */
export async function POST(request: Request) {
  if (!dbConfigured) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { data, error } = await db().from("market_items").select("*").eq("id", parsed.data.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = data as MarketRow | null;
  if (!row) return NextResponse.json({ error: "That widget is gone" }, { status: 404 });

  await db().rpc("increment_installs", { item: row.id });
  return NextResponse.json({ spec: row.spec, installs: row.installs + 1 });
}
