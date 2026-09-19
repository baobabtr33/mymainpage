import { NextResponse } from "next/server";
import { authorizePage, db, dbConfigured } from "@/lib/db";
import { pagePayloadSchema } from "@/lib/types";

const tokenOf = (request: Request) => request.headers.get("x-edit-token");

export async function GET(request: Request, ctx: RouteContext<"/api/page/[slug]">) {
  if (!dbConfigured) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const { slug } = await ctx.params;

  try {
    const { page, owner } = await authorizePage(slug, tokenOf(request));
    if (!page) return NextResponse.json({ error: "No page lives at that address" }, { status: 404 });
    return NextResponse.json({
      slug: page.slug,
      displayName: page.display_name,
      prefs: page.prefs,
      widgets: page.widgets,
      owner,
      updatedAt: page.updated_at,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Load failed" }, { status: 500 });
  }
}

/** Full-document save. The client debounces, so writes stay cheap. */
export async function PUT(request: Request, ctx: RouteContext<"/api/page/[slug]">) {
  if (!dbConfigured) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const { slug } = await ctx.params;
  const parsed = pagePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad payload", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }

  try {
    const { page, owner } = await authorizePage(slug, tokenOf(request));
    if (!page) return NextResponse.json({ error: "No page lives at that address" }, { status: 404 });
    if (!owner) return NextResponse.json({ error: "This page belongs to someone else" }, { status: 403 });

    const { error } = await db()
      .from("pages")
      .update({
        prefs: parsed.data.prefs,
        widgets: parsed.data.widgets,
        display_name: parsed.data.displayName ?? page.display_name,
      })
      .eq("slug", slug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed" }, { status: 500 });
  }
}
