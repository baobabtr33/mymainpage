# mymainpage

A personal start page — weather, news, search and quick links out of the box — with a chat assistant
("Pip") that builds any other widget you ask for, and a marketplace where those widgets can be shared.

```bash
npm install
supabase start                  # local Postgres + API (Docker)
supabase status                 # copy the service_role key
cp .env.example .env.local      # fill MAINPAGE_SUPABASE_* (+ an inference key if you have one)
npm run dev                     # http://localhost:3000
```

Without `.env.local` the app still runs: the dashboard saves to `localStorage` and the marketplace
shows the built-in starter gallery.

## Identities: one secret address per person

There are no accounts. The first visit creates a page at `/p/<slug>` and stores `{ slug, edit_token }`
in that browser's `localStorage`.

- Anyone with the link can **look** at the page (read-only) and press **Make a copy I own** to fork it.
- Only a browser holding the edit token can save to it.

### Keeping your page

A banner on a new page, and the **💾 Save / share** button in the header, open a dialog with:

- **Page link** `/p/<slug>` — read-only, safe to hand out.
- **Edit link** `/p/<slug>#k=<token>` — opens with editing rights on any device. The token sits in the URL
  fragment, which browsers never send to the server; the app stores it, then strips it from the address bar.
  Treat it like a password.
- **Download recovery file** — a small text file with both links and the raw token.
- **Restore** — paste an edit link or token to move editing rights onto the browser you are using.

Bookmarking the tab (`⌘D` / `Ctrl+D`) is enough on the device that created the page, since the token is already
in its `localStorage`. The dialog spells this out in three steps.

Writes go through `/api/page/[slug]` and `/api/market`, which check the token server-side with the
Supabase service key. RLS denies the `anon` and `authenticated` roles everything, so the browser can
never reach the tables directly.

## What's on the page

| Widget | Notes |
| --- | --- |
| Search | Google / Bing / DuckDuckGo / Perplexity |
| Today | Clock, date and a greeting |
| Weather | Open-Meteo, no API key, city and °C/°F switchable |
| News | Hacker News top / best / new / Show HN |
| Quick links | Editable bookmarks with favicons |

Drag a widget by its icon to reorder, `⤢` to make it wider, `✕` to remove, `✎` to ask Pip to change it.
Theme, accent, layout and every widget's data sync to your page (or to `localStorage` in local mode).

## Marketplace

The **Marketplace** tab lists widgets other pages have published: search, sort by popular or newest,
filter to your own, preview one live before adding it, then **Add to my page** (which counts an install
and gives you your own copy). **Share one of your widgets** publishes any Pip-made widget from your page;
by default your entries are stripped and only the structure is shared, or tick the box to include data.
Unpublishing is limited to the author's page token.

A fresh database is seeded (`supabase/seed.sql`) with nine starter widgets so the tab is never empty.

## How Pip builds widgets

Pip never ships executable code to the browser. It answers with a **widget spec**: a JSON document validated
by `lib/types.ts` and interpreted by `components/SpecWidget.tsx`, so a generated widget uses the same inputs,
buttons and cards as the built-in ones and cannot run arbitrary script. The same schema gates the marketplace,
so an installed widget is as safe as a locally generated one.

```json
{
  "kind": "custom",
  "id": "todo-1",
  "title": "To-do",
  "icon": "✅",
  "span": 1,
  "state": { "draft": "", "items": [] },
  "body": [
    { "t": "row", "children": [
      { "t": "input", "bind": "state.draft", "grow": true,
        "onSubmit": [{ "a": "push", "path": "state.items",
                       "value": { "id": "{{uid()}}", "text": "{{state.draft}}", "done": false } },
                     { "a": "set", "path": "state.draft", "value": "" }] }
    ]},
    { "t": "progress", "value": "{{count(state.items,'done')}}", "max": "{{len(state.items)}}" },
    { "t": "repeat", "each": "state.items", "as": "item", "children": [
      { "t": "row", "align": "between", "children": [
        { "t": "checkbox", "bind": "state.items[{{itemIndex}}].done" },
        { "t": "text", "value": "{{item.text}}", "grow": true, "strikeWhen": "item.done" }
      ]}
    ]}
  ]
}
```

- **Nodes** (`stack`, `row`, `grid`, `text`, `heading`, `stat`, `badge`, `progress`, `button`, `input`,
  `textarea`, `checkbox`, `select`, `repeat`, `if`, `divider`, `timer`, `link`) render the UI.
- **Actions** (`set`, `toggle`, `inc`, `push`, `removeAt`, `clear`, `sound`) change the widget's own state.
- **`{{ expressions }}`** are evaluated by `lib/expr.ts`, a small sandboxed parser — no `eval`, no `Function`,
  no globals, and `__proto__` / `constructor` / `prototype` are unreachable. It supports arithmetic, comparisons,
  ternaries and helpers such as `len`, `count`, `sum`, `pct`, `today()`, `daysBetween()` and `uid()`.

## Inference providers

`lib/ai.ts` is one text-in/text-out call over four backends. Set `MAINPAGE_AI_PROVIDER`, or leave it unset and
the first provider with credentials wins:

| Provider | Credentials | Default model |
| --- | --- | --- |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-5` |
| `bedrock` | standard AWS credentials/role + `AWS_REGION` | `anthropic.claude-sonnet-4-5-20250929-v1:0` |
| `vertex` | ADC + `ANTHROPIC_VERTEX_PROJECT_ID`, `CLOUD_ML_REGION` | `claude-sonnet-4-5@20250929` |
| `google` | `GOOGLE_API_KEY` (AI Studio) | `gemini-2.5-flash` |

`MAINPAGE_AI_MODEL` overrides the model. If a spec fails schema validation the route feeds the errors back once
so the model can repair it. With no provider configured, `/api/chat` falls back to keyword-matched templates,
and the header chip says so.

## Layout

```
app/
  page.tsx            doorway: creates or restores your /p/<slug>
  p/[slug]/page.tsx   the page itself (owner or read-only viewer)
  api/status          what the server has configured
  api/page            create a page; [slug] reads and token-gated writes
  api/market          browse / publish / unpublish; install counts an install
  api/weather|news    keyless public data sources
  api/chat            Pip: provider call + schema repair retry, template fallback
components/
  Shell.tsx           tabs, viewer banner, keyboard shortcuts
  Dashboard.tsx       grid, drag-reorder, resize
  Marketplace.tsx     browse, live preview, install, publish
  SpecWidget.tsx      the spec interpreter
  Chat.tsx            the assistant dock
  widgets/            the built-in widgets
lib/
  types.ts            zod schema = the whole widget contract
  expr.ts             sandboxed expression evaluator
  runtime.ts          action reducer
  ai.ts               anthropic / bedrock / vertex / gemini
  db.ts               service-role Supabase client + token checks
  presets.ts          defaults + offline templates
  store.tsx           dashboard state, localStorage cache, debounced sync
supabase/
  migrations/         pages + market_items, RLS locked to the service role
  seed.sql            nine starter widgets for the marketplace
```
