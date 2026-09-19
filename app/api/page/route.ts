import { NextResponse } from "next/server";
import { z } from "zod";
import { db, dbConfigured, newSlug, type PageRow } from "@/lib/db";
import { pagePayloadSchema } from "@/lib/types";
import { defaultWidgets } from "@/lib/presets";

const createSchema = z.object({
  payload: pagePayloadSchema.optional(),
  displayName: z.string().max(60).optional(),
});

/** Create a brand-new page. The returned edit token is the only proof of ownership. */
export async function POST(request: Request) {
  if (!dbConfigured) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const payload = parsed.data.payload;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = newSlug();
    const { data, error } = await db()
      .from("pages")
      .insert({
        slug,
        display_name: parsed.data.displayName ?? payload?.displayName ?? "",
        prefs: payload?.prefs ?? {},
        widgets: payload?.widgets ?? defaultWidgets(),
      })
      .select("*")
      .single();

    if (!error && data) {
      const row = data as PageRow;
      return NextResponse.json({
        slug: row.slug,
        token: row.edit_token,
        displayName: row.display_name,
        prefs: row.prefs,
        widgets: row.widgets,
      });
    }
    // 23505 = slug collision; anything else is a real failure.
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Could not allocate a page address" }, { status: 500 });
}
