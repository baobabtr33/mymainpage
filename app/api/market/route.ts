import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizePage, db, dbConfigured, type MarketRow } from "@/lib/db";
import { customWidgetSchema } from "@/lib/types";

const MAX_SPEC_BYTES = 64_000;

const publishSchema = z.object({
  slug: z.string().max(32),
  token: z.string().max(64),
  title: z.string().min(1).max(80),
  description: z.string().max(400).default(""),
  tags: z.array(z.string().max(24)).max(6).default([]),
  authorName: z.string().max(40).default("anonymous"),
  includeData: z.boolean().default(false),
  spec: customWidgetSchema,
});

/** Published widgets carry structure, not the author's personal rows. */
function blankState(value: unknown): unknown {
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, blankState(v)]));
  }
  if (typeof value === "string") return "";
  return value;
}

const toItem = (row: MarketRow, mySlug: string | null) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  icon: row.icon,
  tags: row.tags,
  spec: row.spec,
  installs: row.installs,
  authorName: row.author_name,
  authorSlug: row.author_slug,
  mine: mySlug === row.author_slug,
  createdAt: row.created_at,
});

export async function GET(request: Request) {
  if (!dbConfigured) return NextResponse.json({ items: [], db: false });
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const sort = params.get("sort") === "new" ? "new" : "popular";
  const mine = params.get("mine");
  const tag = params.get("tag");

  let query = db().from("market_items").select("*").limit(60);
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (tag) query = query.contains("tags", [tag]);
  if (mine) query = query.eq("author_slug", mine);
  query = sort === "new" ? query.order("created_at", { ascending: false }) : query.order("installs", { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ db: true, items: (data as MarketRow[]).map((row) => toItem(row, mine)) });
}

export async function POST(request: Request) {
  if (!dbConfigured) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const parsed = publishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }
  const { slug, token, title, description, tags, authorName, includeData, spec } = parsed.data;

  if (JSON.stringify(spec).length > MAX_SPEC_BYTES) {
    return NextResponse.json({ error: "That widget is too large to publish" }, { status: 413 });
  }

  try {
    const { page, owner } = await authorizePage(slug, token);
    if (!page || !owner) return NextResponse.json({ error: "Only the page owner can publish" }, { status: 403 });

    const shared = {
      ...spec,
      title,
      state: includeData ? spec.state : (blankState(spec.state) as Record<string, unknown>),
    };

    const { data, error } = await db()
      .from("market_items")
      .upsert(
        {
          author_slug: slug,
          author_name: authorName || page.display_name || "anonymous",
          title,
          description,
          icon: spec.icon || "✨",
          tags,
          spec: shared,
        },
        { onConflict: "author_slug,title" },
      )
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: toItem(data as MarketRow, slug) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Publish failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!dbConfigured) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const slug = params.get("slug");
  const token = request.headers.get("x-edit-token");
  if (!id || !slug) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  try {
    const { page, owner } = await authorizePage(slug, token);
    if (!page || !owner) return NextResponse.json({ error: "Only the author can unpublish" }, { status: 403 });
    const { error } = await db().from("market_items").delete().eq("id", id).eq("author_slug", slug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unpublish failed" }, { status: 500 });
  }
}
