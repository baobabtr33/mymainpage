import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai";
import { dbConfigured } from "@/lib/db";

/** The client uses this to decide between synced mode and local-only mode. */
export async function GET() {
  const ai = aiStatus();
  return NextResponse.json({
    db: dbConfigured,
    ai: { ready: ai.ready, provider: ai.provider, model: ai.model },
  });
}
