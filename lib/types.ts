import { z } from "zod";

/**
 * The widget DSL.
 *
 * Generated widgets are never executed as code. The assistant returns a JSON
 * document that matches the schemas below, and `components/SpecWidget.tsx`
 * interprets it. Strings may contain `{{ expression }}` templates that are
 * evaluated by the sandboxed evaluator in `lib/expr.ts`.
 */

export const actionSchema = z.discriminatedUnion("a", [
  z.object({ a: z.literal("set"), path: z.string(), value: z.unknown() }),
  z.object({ a: z.literal("toggle"), path: z.string() }),
  z.object({ a: z.literal("inc"), path: z.string(), by: z.unknown().optional() }),
  z.object({ a: z.literal("push"), path: z.string(), value: z.unknown() }),
  z.object({ a: z.literal("removeAt"), path: z.string(), index: z.string().optional() }),
  z.object({ a: z.literal("clear"), path: z.string() }),
  z.object({ a: z.literal("sound"), name: z.enum(["ding", "click"]).default("ding") }),
]);
export type Action = z.infer<typeof actionSchema>;

const actions = z.union([actionSchema, z.array(actionSchema)]);

const tone = z.enum(["neutral", "accent", "good", "warn", "bad"]);

export type Node =
  | { t: "stack"; gap?: number; children: Node[] }
  | { t: "row"; gap?: number; wrap?: boolean; align?: "start" | "center" | "between"; children: Node[] }
  | { t: "grid"; cols?: number; gap?: number; children: Node[] }
  | { t: "text"; value: string; muted?: boolean; size?: "xs" | "sm" | "md" | "lg" | "xl"; strikeWhen?: string; grow?: boolean }
  | { t: "heading"; value: string }
  | { t: "stat"; label: string; value: string; hint?: string }
  | { t: "badge"; value: string; tone?: z.infer<typeof tone> }
  | { t: "progress"; value: string; max?: string; label?: string }
  | { t: "button"; label: string; on: Action | Action[]; variant?: "primary" | "ghost" | "danger"; grow?: boolean }
  | { t: "input"; bind: string; placeholder?: string; inputType?: "text" | "number" | "date" | "time" | "color"; onSubmit?: Action | Action[]; grow?: boolean }
  | { t: "textarea"; bind: string; placeholder?: string; rows?: number }
  | { t: "checkbox"; bind: string; label?: string }
  | { t: "select"; bind: string; options: string[] }
  | { t: "repeat"; each: string; as?: string; empty?: string; children: Node[] }
  | { t: "if"; cond: string; children: Node[]; else?: Node[] }
  | { t: "divider" }
  | { t: "timer"; bind: string; running: string; direction?: "down" | "up"; onDone?: Action | Action[] }
  | { t: "link"; label: string; href: string };

export const nodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.discriminatedUnion("t", [
    z.object({ t: z.literal("stack"), gap: z.number().optional(), children: z.array(nodeSchema) }),
    z.object({
      t: z.literal("row"),
      gap: z.number().optional(),
      wrap: z.boolean().optional(),
      align: z.enum(["start", "center", "between"]).optional(),
      children: z.array(nodeSchema),
    }),
    z.object({ t: z.literal("grid"), cols: z.number().optional(), gap: z.number().optional(), children: z.array(nodeSchema) }),
    z.object({
      t: z.literal("text"),
      value: z.string(),
      muted: z.boolean().optional(),
      size: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
      strikeWhen: z.string().optional(),
      grow: z.boolean().optional(),
    }),
    z.object({ t: z.literal("heading"), value: z.string() }),
    z.object({ t: z.literal("stat"), label: z.string(), value: z.string(), hint: z.string().optional() }),
    z.object({ t: z.literal("badge"), value: z.string(), tone: tone.optional() }),
    z.object({ t: z.literal("progress"), value: z.string(), max: z.string().optional(), label: z.string().optional() }),
    z.object({
      t: z.literal("button"),
      label: z.string(),
      on: actions,
      variant: z.enum(["primary", "ghost", "danger"]).optional(),
      grow: z.boolean().optional(),
    }),
    z.object({
      t: z.literal("input"),
      bind: z.string(),
      placeholder: z.string().optional(),
      inputType: z.enum(["text", "number", "date", "time", "color"]).optional(),
      onSubmit: actions.optional(),
      grow: z.boolean().optional(),
    }),
    z.object({ t: z.literal("textarea"), bind: z.string(), placeholder: z.string().optional(), rows: z.number().optional() }),
    z.object({ t: z.literal("checkbox"), bind: z.string(), label: z.string().optional() }),
    z.object({ t: z.literal("select"), bind: z.string(), options: z.array(z.string()) }),
    z.object({
      t: z.literal("repeat"),
      each: z.string(),
      as: z.string().optional(),
      empty: z.string().optional(),
      children: z.array(nodeSchema),
    }),
    z.object({ t: z.literal("if"), cond: z.string(), children: z.array(nodeSchema), else: z.array(nodeSchema).optional() }),
    z.object({ t: z.literal("divider") }),
    z.object({
      t: z.literal("timer"),
      bind: z.string(),
      running: z.string(),
      direction: z.enum(["down", "up"]).optional(),
      onDone: actions.optional(),
    }),
    z.object({ t: z.literal("link"), label: z.string(), href: z.string() }),
  ]) as unknown as z.ZodType<Node>,
);

export const customWidgetSchema = z.object({
  kind: z.literal("custom"),
  id: z.string(),
  title: z.string(),
  icon: z.string().default("✨"),
  span: z.number().min(1).max(3).default(1),
  state: z.record(z.string(), z.unknown()).default({}),
  body: z.array(nodeSchema),
});
export type CustomWidget = z.infer<typeof customWidgetSchema>;

export const builtinKinds = ["weather", "news", "clock", "search", "links"] as const;
export type BuiltinKind = (typeof builtinKinds)[number];

export type BuiltinWidget = {
  kind: BuiltinKind;
  id: string;
  title: string;
  icon: string;
  span: number;
  settings: Record<string, unknown>;
};

export type Widget = CustomWidget | BuiltinWidget;

export const builtinWidgetSchema = z.object({
  kind: z.enum(builtinKinds),
  id: z.string(),
  title: z.string(),
  icon: z.string(),
  span: z.number().min(1).max(3).default(1),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export const widgetSchema = z.union([customWidgetSchema, builtinWidgetSchema]);

export const prefsSchema = z.object({
  name: z.string().max(60).default(""),
  theme: z.enum(["dark", "light"]).default("dark"),
  accent: z.string().max(32).default("#7c9cff"),
  place: z.string().max(80).default("Seoul"),
  units: z.enum(["metric", "imperial"]).default("metric"),
});

/** What a page sends up when it syncs. */
export const pagePayloadSchema = z.object({
  prefs: prefsSchema,
  widgets: z.array(widgetSchema).max(60),
  displayName: z.string().max(60).optional(),
});

export const marketItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  tags: z.array(z.string()),
  spec: customWidgetSchema,
  installs: z.number(),
  authorName: z.string(),
  authorSlug: z.string(),
  mine: z.boolean().default(false),
  createdAt: z.string(),
});
export type MarketItem = z.infer<typeof marketItemSchema>;

export const isCustom = (w: Widget): w is CustomWidget => w.kind === "custom";

/** What the assistant is allowed to answer with. */
export const assistantReplySchema = z.object({
  reply: z.string(),
  widget: customWidgetSchema.optional(),
  remove: z.string().optional(),
});
export type AssistantReply = z.infer<typeof assistantReplySchema>;
