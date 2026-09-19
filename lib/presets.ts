import type { CustomWidget, Widget } from "./types";

export const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const id = newId;

export function defaultWidgets(): Widget[] {
  return [
    { kind: "search", id: id("search"), title: "Search", icon: "🔎", span: 3, settings: { engine: "google" } },
    { kind: "clock", id: id("clock"), title: "Today", icon: "🕒", span: 1, settings: {} },
    { kind: "weather", id: id("weather"), title: "Weather", icon: "⛅", span: 1, settings: {} },
    { kind: "news", id: id("news"), title: "News", icon: "📰", span: 1, settings: { source: "hn", limit: 8 } },
    {
      kind: "links",
      id: id("links"),
      title: "Quick links",
      icon: "🔗",
      span: 1,
      settings: {
        links: [
          { label: "Gmail", href: "https://mail.google.com" },
          { label: "Calendar", href: "https://calendar.google.com" },
          { label: "GitHub", href: "https://github.com" },
          { label: "YouTube", href: "https://youtube.com" },
        ],
      },
    },
  ];
}

const addItem = (list: string, draft: string, extra: Record<string, unknown> = {}) => [
  { a: "push" as const, path: list, value: { id: "{{uid()}}", text: `{{${draft}}}`, ...extra } },
  { a: "set" as const, path: draft, value: "" },
];

export const todoWidget = (): CustomWidget => ({
  kind: "custom",
  id: id("todo"),
  title: "To-do",
  icon: "✅",
  span: 1,
  state: { draft: "", items: [] },
  body: [
    {
      t: "row",
      gap: 2,
      children: [
        {
          t: "input",
          bind: "state.draft",
          placeholder: "Add a task…",
          grow: true,
          onSubmit: addItem("state.items", "state.draft", { done: false }),
        },
        { t: "button", label: "Add", variant: "primary", on: addItem("state.items", "state.draft", { done: false }) },
      ],
    },
    {
      t: "progress",
      value: "{{count(state.items,'done')}}",
      max: "{{len(state.items)}}",
      label: "{{count(state.items,'done')}} of {{len(state.items)}} done",
    },
    {
      t: "repeat",
      each: "state.items",
      as: "item",
      empty: "Nothing here yet.",
      children: [
        {
          t: "row",
          gap: 2,
          align: "between",
          children: [
            { t: "checkbox", bind: "state.items[{{itemIndex}}].done" },
            { t: "text", value: "{{item.text}}", grow: true, strikeWhen: "item.done" },
            { t: "button", label: "✕", variant: "ghost", on: { a: "removeAt", path: "state.items", index: "{{itemIndex}}" } },
          ],
        },
      ],
    },
  ],
});

export const habitWidget = (): CustomWidget => ({
  kind: "custom",
  id: id("habit"),
  title: "Habit tracker",
  icon: "🔥",
  span: 2,
  state: {
    draft: "",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    habits: [
      { id: "h1", text: "Read 20 min", marks: [false, false, false, false, false, false, false] },
      { id: "h2", text: "Workout", marks: [false, false, false, false, false, false, false] },
    ],
  },
  body: [
    {
      t: "row",
      gap: 2,
      children: [
        {
          t: "input",
          bind: "state.draft",
          placeholder: "New habit…",
          grow: true,
          onSubmit: addItem("state.habits", "state.draft", { marks: [false, false, false, false, false, false, false] }),
        },
        {
          t: "button",
          label: "Add",
          variant: "primary",
          on: addItem("state.habits", "state.draft", { marks: [false, false, false, false, false, false, false] }),
        },
      ],
    },
    {
      t: "repeat",
      each: "state.habits",
      as: "habit",
      empty: "Add a habit to start a streak.",
      children: [
        {
          t: "row",
          gap: 2,
          align: "between",
          children: [
            { t: "text", value: "{{habit.text}}", grow: true },
            {
              t: "row",
              gap: 1,
              children: [
                {
                  t: "repeat",
                  each: "state.days",
                  as: "day",
                  children: [
                    {
                      t: "button",
                      label: "{{habit.marks[dayIndex] ? '●' : '○'}}",
                      variant: "ghost",
                      on: { a: "toggle", path: "state.habits[{{habitIndex}}].marks[{{dayIndex}}]" },
                    },
                  ],
                },
              ],
            },
            { t: "badge", value: "{{count(habit.marks)}}/7", tone: "accent" },
            { t: "button", label: "✕", variant: "ghost", on: { a: "removeAt", path: "state.habits", index: "{{habitIndex}}" } },
          ],
        },
      ],
    },
    { t: "divider" },
    { t: "text", value: "{{join(state.days,'  ')}}", muted: true, size: "xs" },
  ],
});

export const pomodoroWidget = (): CustomWidget => ({
  kind: "custom",
  id: id("pomodoro"),
  title: "Pomodoro",
  icon: "🍅",
  span: 1,
  state: { left: 1500, running: false, done: 0 },
  body: [
    { t: "timer", bind: "state.left", running: "state.running", onDone: [{ a: "set", path: "state.running", value: false }, { a: "inc", path: "state.done", by: 1 }, { a: "sound", name: "ding" }] },
    {
      t: "row",
      gap: 2,
      children: [
        { t: "button", label: "{{state.running ? 'Pause' : 'Start'}}", variant: "primary", grow: true, on: { a: "toggle", path: "state.running" } },
        { t: "button", label: "Reset", variant: "ghost", on: [{ a: "set", path: "state.left", value: 1500 }, { a: "set", path: "state.running", value: false }] },
      ],
    },
    {
      t: "row",
      gap: 2,
      children: [
        { t: "button", label: "25m", variant: "ghost", grow: true, on: { a: "set", path: "state.left", value: 1500 } },
        { t: "button", label: "5m", variant: "ghost", grow: true, on: { a: "set", path: "state.left", value: 300 } },
        { t: "button", label: "15m", variant: "ghost", grow: true, on: { a: "set", path: "state.left", value: 900 } },
      ],
    },
    { t: "stat", label: "Sessions finished", value: "{{state.done}}" },
  ],
});

export const notesWidget = (): CustomWidget => ({
  kind: "custom",
  id: id("notes"),
  title: "Scratchpad",
  icon: "📝",
  span: 1,
  state: { text: "" },
  body: [
    { t: "textarea", bind: "state.text", placeholder: "Think out loud…", rows: 7 },
    { t: "text", value: "{{len(state.text)}} characters", muted: true, size: "xs" },
  ],
});

export const waterWidget = (): CustomWidget => ({
  kind: "custom",
  id: id("water"),
  title: "Water",
  icon: "💧",
  span: 1,
  state: { glasses: 0, goal: 8 },
  body: [
    { t: "stat", label: "Today", value: "{{state.glasses}} / {{state.goal}} glasses" },
    { t: "progress", value: "{{state.glasses}}", max: "{{state.goal}}" },
    {
      t: "row",
      gap: 2,
      children: [
        { t: "button", label: "+1 glass", variant: "primary", grow: true, on: { a: "inc", path: "state.glasses", by: 1 } },
        { t: "button", label: "−", variant: "ghost", on: { a: "set", path: "state.glasses", value: "{{max(0, state.glasses - 1)}}" } },
        { t: "button", label: "Reset", variant: "ghost", on: { a: "set", path: "state.glasses", value: 0 } },
      ],
    },
  ],
});

export const expensesWidget = (): CustomWidget => ({
  kind: "custom",
  id: id("expenses"),
  title: "Spending",
  icon: "💸",
  span: 1,
  state: { label: "", amount: "", items: [], budget: 500 },
  body: [
    { t: "stat", label: "Spent this month", value: "{{fixed(sum(state.items,'amount'),2)}}", hint: "budget {{state.budget}}" },
    { t: "progress", value: "{{sum(state.items,'amount')}}", max: "{{state.budget}}" },
    {
      t: "row",
      gap: 2,
      children: [
        { t: "input", bind: "state.label", placeholder: "What for?", grow: true },
        { t: "input", bind: "state.amount", placeholder: "0", inputType: "number" },
        {
          t: "button",
          label: "Add",
          variant: "primary",
          on: [
            { a: "push", path: "state.items", value: { id: "{{uid()}}", text: "{{state.label}}", amount: "{{num(state.amount)}}", day: "{{today()}}" } },
            { a: "set", path: "state.label", value: "" },
            { a: "set", path: "state.amount", value: "" },
          ],
        },
      ],
    },
    {
      t: "repeat",
      each: "state.items",
      as: "item",
      empty: "No spending logged.",
      children: [
        {
          t: "row",
          align: "between",
          gap: 2,
          children: [
            { t: "text", value: "{{item.text}}", grow: true },
            { t: "text", value: "{{fixed(item.amount,2)}}", muted: true },
            { t: "button", label: "✕", variant: "ghost", on: { a: "removeAt", path: "state.items", index: "{{itemIndex}}" } },
          ],
        },
      ],
    },
  ],
});

export const readingWidget = (): CustomWidget => ({
  kind: "custom",
  id: id("reading"),
  title: "Reading list",
  icon: "📚",
  span: 1,
  state: { draft: "", items: [] },
  body: [
    {
      t: "row",
      gap: 2,
      children: [
        { t: "input", bind: "state.draft", placeholder: "Title or link…", grow: true, onSubmit: addItem("state.items", "state.draft", { done: false }) },
        { t: "button", label: "Save", variant: "primary", on: addItem("state.items", "state.draft", { done: false }) },
      ],
    },
    {
      t: "repeat",
      each: "state.items",
      as: "item",
      empty: "Nothing saved yet.",
      children: [
        {
          t: "row",
          gap: 2,
          align: "between",
          children: [
            { t: "checkbox", bind: "state.items[{{itemIndex}}].done" },
            { t: "text", value: "{{item.text}}", grow: true, strikeWhen: "item.done" },
            { t: "button", label: "✕", variant: "ghost", on: { a: "removeAt", path: "state.items", index: "{{itemIndex}}" } },
          ],
        },
      ],
    },
    { t: "text", value: "{{count(state.items,'done')}} finished", muted: true, size: "xs" },
  ],
});

export const moodWidget = (): CustomWidget => ({
  kind: "custom",
  id: id("mood"),
  title: "Mood log",
  icon: "🌤️",
  span: 1,
  state: { entries: [] },
  body: [
    {
      t: "row",
      gap: 2,
      children: [
        { t: "button", label: "😄", variant: "ghost", grow: true, on: { a: "push", path: "state.entries", value: { id: "{{uid()}}", text: "😄", day: "{{today()}}" } } },
        { t: "button", label: "🙂", variant: "ghost", grow: true, on: { a: "push", path: "state.entries", value: { id: "{{uid()}}", text: "🙂", day: "{{today()}}" } } },
        { t: "button", label: "😐", variant: "ghost", grow: true, on: { a: "push", path: "state.entries", value: { id: "{{uid()}}", text: "😐", day: "{{today()}}" } } },
        { t: "button", label: "😔", variant: "ghost", grow: true, on: { a: "push", path: "state.entries", value: { id: "{{uid()}}", text: "😔", day: "{{today()}}" } } },
      ],
    },
    {
      t: "repeat",
      each: "state.entries",
      as: "entry",
      empty: "Tap a face to log how today feels.",
      children: [
        {
          t: "row",
          align: "between",
          gap: 2,
          children: [
            { t: "text", value: "{{entry.text}}  {{entry.day}}", grow: true },
            { t: "button", label: "✕", variant: "ghost", on: { a: "removeAt", path: "state.entries", index: "{{entryIndex}}" } },
          ],
        },
      ],
    },
  ],
});

export const countdownWidget = (): CustomWidget => ({
  kind: "custom",
  id: id("countdown"),
  title: "Countdown",
  icon: "📆",
  span: 1,
  state: { label: "New Year", date: "2027-01-01" },
  body: [
    { t: "stat", label: "{{state.label}}", value: "{{daysBetween(state.date, today())}} days", hint: "{{state.date}}" },
    { t: "input", bind: "state.label", placeholder: "What are you counting to?" },
    { t: "input", bind: "state.date", inputType: "date" },
  ],
});

/**
 * Keyword fallback used when no ANTHROPIC_API_KEY is configured, so the chat
 * still builds something useful offline.
 */
const FALLBACKS: { match: RegExp; build: () => CustomWidget; note: string }[] = [
  { match: /habit|streak|daily check/i, build: habitWidget, note: "a habit tracker with a 7-day grid" },
  { match: /todo|to-do|task|checklist/i, build: todoWidget, note: "a to-do list with progress" },
  { match: /pomodoro|timer|focus|countdown timer/i, build: pomodoroWidget, note: "a pomodoro timer" },
  { match: /note|scratch|journal|memo/i, build: notesWidget, note: "a scratchpad" },
  { match: /water|hydrat|drink/i, build: waterWidget, note: "a water tracker" },
  { match: /expense|spend|budget|money|cost/i, build: expensesWidget, note: "a spending log with a budget bar" },
  { match: /read|book|article|watch later/i, build: readingWidget, note: "a reading list" },
  { match: /mood|feel|gratitude|emotion/i, build: moodWidget, note: "a mood log" },
  { match: /countdown|days until|deadline|anniversar/i, build: countdownWidget, note: "a day countdown" },
];

export function fallbackWidget(prompt: string): { widget: CustomWidget; note: string } | null {
  for (const f of FALLBACKS) if (f.match.test(prompt)) return { widget: f.build(), note: f.note };
  return null;
}

export const exampleSpecs = {
  todo: todoWidget(),
  habit: habitWidget(),
  pomodoro: pomodoroWidget(),
};
