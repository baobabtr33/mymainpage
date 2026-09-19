import { NextResponse } from "next/server";

type Story = { id: number; title: string; url?: string; score?: number; by?: string; descendants?: number; time?: number };

const FEEDS: Record<string, string> = {
  hn: "topstories",
  best: "beststories",
  new: "newstories",
  show: "showstories",
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const feed = FEEDS[params.get("source") ?? "hn"] ?? FEEDS.hn;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 8), 1), 20);

  try {
    const idsRes = await fetch(`https://hacker-news.firebaseio.com/v0/${feed}.json`, { next: { revalidate: 300 } });
    if (!idsRes.ok) return NextResponse.json({ error: "News service unavailable" }, { status: 502 });
    const ids = ((await idsRes.json()) as number[]).slice(0, limit);

    const stories = await Promise.all(
      ids.map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { next: { revalidate: 300 } });
        return (await r.json()) as Story | null;
      }),
    );

    return NextResponse.json({
      items: stories
        .filter((s): s is Story => Boolean(s?.title))
        .map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
          host: s.url ? new URL(s.url).hostname.replace(/^www\./, "") : "news.ycombinator.com",
          score: s.score ?? 0,
          comments: s.descendants ?? 0,
        })),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the news service" }, { status: 502 });
  }
}
