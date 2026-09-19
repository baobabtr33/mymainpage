import { NextResponse } from "next/server";
import { z } from "zod";
import { assistantReplySchema, type AssistantReply } from "@/lib/types";
import { contextBlock, SYSTEM_PROMPT } from "@/lib/prompt";
import { fallbackWidget } from "@/lib/presets";
import { aiStatus, generateText, type ChatTurn } from "@/lib/ai";

export const maxDuration = 60;

const requestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(12)
    .default([]),
  widgets: z
    .array(z.object({ id: z.string(), title: z.string(), kind: z.string() }))
    .max(40)
    .default([]),
  editing: z.unknown().optional(),
});

/** Models sometimes wrap JSON in prose or fences; take the outermost object. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in response");
  return JSON.parse(raw.slice(start, end + 1));
}

function offlineAnswer(message: string): AssistantReply {
  const hit = fallbackWidget(message);
  if (hit) {
    return {
      reply: `Built you ${hit.note}. (No inference provider is configured, so I matched a built-in template — add a key to .env.local for widgets made to order.)`,
      widget: hit.widget,
    };
  }
  return {
    reply:
      "No inference provider is configured, so I can only build from templates right now: to-do list, habit tracker, pomodoro, notes, water, spending, reading list, mood log, countdown. Add ANTHROPIC_API_KEY, AWS Bedrock, Vertex or Gemini credentials and I can build anything you describe.",
  };
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { message, history, widgets, editing } = parsed.data;

  if (!aiStatus().ready) return NextResponse.json(offlineAnswer(message));

  const context = [
    contextBlock(widgets),
    editing ? `The user is editing this widget, return it with the same id:\n${JSON.stringify(editing)}` : "",
    `Today is ${new Date().toISOString().slice(0, 10)}.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: ChatTurn[] = [
    ...history,
    { role: "user", content: `${context}\n\nRequest: ${message}` },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await generateText({ system: SYSTEM_PROMPT, messages });
      const candidate = assistantReplySchema.safeParse(extractJson(text));
      if (candidate.success) return NextResponse.json(candidate.data);

      // Hand the schema errors back once so the model can repair its own spec.
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `That spec failed validation:\n${JSON.stringify(candidate.error.issues.slice(0, 8))}\nReturn the corrected JSON object only.`,
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : "unknown error";
      if (attempt === 1) return NextResponse.json({ error: `Assistant failed: ${detail}` }, { status: 502 });
      messages.push({ role: "user", content: "Your last reply was not valid JSON. Return one JSON object only." });
    }
  }

  return NextResponse.json({ error: "The assistant could not produce a valid widget." }, { status: 502 });
}
