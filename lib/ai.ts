import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { GoogleGenAI } from "@google/genai";

/**
 * One text-in/text-out call, whichever inference backend is configured.
 *
 * MAINPAGE_AI_PROVIDER = anthropic | bedrock | vertex | google
 * (left unset, the first provider whose credentials are present wins).
 */
export type Provider = "anthropic" | "bedrock" | "vertex" | "google";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  bedrock: "anthropic.claude-sonnet-4-5-20250929-v1:0",
  vertex: "claude-sonnet-4-5@20250929",
  google: "gemini-2.5-flash",
};

function credentialled(provider: Provider): boolean {
  switch (provider) {
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "bedrock":
      return Boolean(
        (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
          process.env.AWS_PROFILE ||
          process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
          process.env.AWS_WEB_IDENTITY_TOKEN_FILE,
      );
    case "vertex":
      return Boolean(
        process.env.ANTHROPIC_VERTEX_PROJECT_ID &&
          (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT),
      );
    case "google":
      return Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
  }
}

export function resolveProvider(): Provider | null {
  const forced = process.env.MAINPAGE_AI_PROVIDER as Provider | undefined;
  if (forced) return credentialled(forced) ? forced : null;
  const order: Provider[] = ["anthropic", "bedrock", "vertex", "google"];
  return order.find(credentialled) ?? null;
}

export function aiStatus() {
  const forced = process.env.MAINPAGE_AI_PROVIDER as Provider | undefined;
  const provider = resolveProvider();
  return {
    ready: provider !== null,
    provider,
    requested: forced ?? null,
    model: provider ? (process.env.MAINPAGE_AI_MODEL ?? DEFAULT_MODEL[provider]) : null,
  };
}

const modelFor = (provider: Provider) => process.env.MAINPAGE_AI_MODEL ?? DEFAULT_MODEL[provider];

async function anthropicLike(
  client: Anthropic | AnthropicBedrock | AnthropicVertex,
  model: string,
  system: string,
  messages: ChatTurn[],
): Promise<string> {
  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return res.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

export async function generateText({
  system,
  messages,
}: {
  system: string;
  messages: ChatTurn[];
}): Promise<string> {
  const provider = resolveProvider();
  if (!provider) throw new Error("No inference provider is configured");
  const model = modelFor(provider);

  switch (provider) {
    case "anthropic":
      return anthropicLike(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }), model, system, messages);

    case "bedrock":
      return anthropicLike(
        new AnthropicBedrock({ awsRegion: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1" }),
        model,
        system,
        messages,
      );

    case "vertex":
      return anthropicLike(
        new AnthropicVertex({
          projectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID,
          region: process.env.CLOUD_ML_REGION ?? "us-east5",
        }),
        model,
        system,
        messages,
      );

    case "google": {
      const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY });
      const res = await genai.models.generateContent({
        model,
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        config: { systemInstruction: system, responseMimeType: "application/json", maxOutputTokens: 8192 },
      });
      return res.text ?? "";
    }
  }
}
