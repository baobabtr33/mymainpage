/**
 * A tiny, sandboxed expression language for the widget DSL.
 *
 * Widget specs come from a language model, so nothing here touches `eval`,
 * `Function`, globals, or prototype chains. The evaluator only walks plain
 * data held in the widget's own state object.
 */

type Scope = Record<string, unknown>;

const BLOCKED = new Set(["__proto__", "prototype", "constructor"]);

type Token =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "ident"; v: string }
  | { k: "op"; v: string }
  | { k: "end" };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c);
  const isIdent = (c: string) => /[A-Za-z0-9_$.]/.test(c);

  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ k: "num", v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\" && j + 1 < src.length) {
          s += src[j + 1];
          j += 2;
        } else {
          s += src[j];
          j++;
        }
      }
      out.push({ k: "str", v: s });
      i = j + 1;
      continue;
    }
    if (isIdentStart(c)) {
      let j = i;
      while (j < src.length && isIdent(src[j])) j++;
      out.push({ k: "ident", v: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||", "??"].includes(two)) {
      out.push({ k: "op", v: two });
      i += 2;
      continue;
    }
    if ("+-*/%<>!?:(),[].".includes(c)) {
      out.push({ k: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`unexpected character ${c}`);
  }
  out.push({ k: "end" });
  return out;
}

type Ast =
  | { n: "lit"; v: unknown }
  | { n: "path"; parts: string[] }
  | { n: "call"; name: string; args: Ast[] }
  | { n: "unary"; op: string; arg: Ast }
  | { n: "bin"; op: string; l: Ast; r: Ast }
  | { n: "cond"; c: Ast; a: Ast; b: Ast }
  | { n: "index"; target: Ast; index: Ast };

const BINARY_PRECEDENCE: Record<string, number> = {
  "||": 1,
  "??": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  ">": 4,
  "<=": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};

function parse(src: string): Ast {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (v: string) => {
    const t = tokens[pos];
    if (t.k !== "op" || t.v !== v) throw new Error(`expected ${v}`);
    pos++;
  };

  function parsePrimary(): Ast {
    const t = tokens[pos];
    if (t.k === "num" || t.k === "str") {
      pos++;
      return { n: "lit", v: t.v };
    }
    if (t.k === "ident") {
      pos++;
      if (t.v === "true") return { n: "lit", v: true };
      if (t.v === "false") return { n: "lit", v: false };
      if (t.v === "null") return { n: "lit", v: null };
      const next = peek();
      if (next.k === "op" && next.v === "(") {
        pos++;
        const args: Ast[] = [];
        if (!(peek().k === "op" && (peek() as { v: string }).v === ")")) {
          for (;;) {
            args.push(parseExpr(0));
            const p = peek();
            if (p.k === "op" && p.v === ",") {
              pos++;
              continue;
            }
            break;
          }
        }
        eat(")");
        return { n: "call", name: t.v, args };
      }
      return withIndex({ n: "path", parts: t.v.split(".") });
    }
    if (t.k === "op" && t.v === "(") {
      pos++;
      const e = parseExpr(0);
      eat(")");
      return withIndex(e);
    }
    if (t.k === "op" && (t.v === "!" || t.v === "-")) {
      pos++;
      return { n: "unary", op: t.v, arg: parseExpr(7) };
    }
    throw new Error("unexpected token");
  }

  function withIndex(base: Ast): Ast {
    let node = base;
    for (;;) {
      const p = peek();
      if (p.k === "op" && p.v === "[") {
        pos++;
        const idx = parseExpr(0);
        eat("]");
        node = { n: "index", target: node, index: idx };
        continue;
      }
      if (p.k === "op" && p.v === ".") {
        const next = tokens[pos + 1];
        if (next && next.k === "ident") {
          pos += 2;
          for (const part of next.v.split(".")) {
            node = { n: "index", target: node, index: { n: "lit", v: part } };
          }
          continue;
        }
      }
      break;
    }
    return node;
  }

  function parseExpr(min: number): Ast {
    let left = parsePrimary();
    for (;;) {
      const t = peek();
      if (t.k !== "op") break;
      if (t.v === "?" && min <= 0) {
        pos++;
        const a = parseExpr(0);
        eat(":");
        const b = parseExpr(0);
        left = { n: "cond", c: left, a, b };
        continue;
      }
      const prec = BINARY_PRECEDENCE[t.v];
      if (prec === undefined || prec < min) break;
      pos++;
      const right = parseExpr(prec + 1);
      left = { n: "bin", op: t.v, l: left, r: right };
    }
    return left;
  }

  const ast = parseExpr(0);
  if (tokens[pos].k !== "end") throw new Error("trailing input");
  return ast;
}

const astCache = new Map<string, Ast>();
function parseCached(src: string): Ast {
  const hit = astCache.get(src);
  if (hit) return hit;
  const ast = parse(src);
  astCache.set(src, ast);
  return ast;
}

export function readPath(root: unknown, parts: string[]): unknown {
  let cur: unknown = root;
  for (const raw of parts) {
    if (cur == null) return undefined;
    const key = raw.trim();
    if (BLOCKED.has(key)) return undefined;
    if (Array.isArray(cur) && /^\d+$/.test(key)) cur = cur[Number(key)];
    else if (typeof cur === "object") cur = (cur as Record<string, unknown>)[key];
    else if (typeof cur === "string" && key === "length") cur = cur.length;
    else return undefined;
  }
  return cur;
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const pad = (n: number) => String(n).padStart(2, "0");
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const FUNCTIONS: Record<string, (args: unknown[]) => unknown> = {
  len: ([v]) => (Array.isArray(v) ? v.length : typeof v === "string" ? v.length : 0),
  count: ([list, field]) =>
    asArray(list).filter((it) =>
      field === undefined ? true : Boolean(readPath(it, String(field).split("."))),
    ).length,
  sum: ([list, field]) =>
    asArray(list).reduce<number>(
      (acc, it) => acc + num(field === undefined ? it : readPath(it, String(field).split("."))),
      0,
    ),
  avg: ([list, field]) => {
    const items = asArray(list);
    if (!items.length) return 0;
    return (FUNCTIONS.sum([list, field]) as number) / items.length;
  },
  min: (args) => Math.min(...args.map(num)),
  max: (args) => Math.max(...args.map(num)),
  round: ([v, digits]) => {
    const f = Math.pow(10, num(digits ?? 0));
    return Math.round(num(v) * f) / f;
  },
  floor: ([v]) => Math.floor(num(v)),
  ceil: ([v]) => Math.ceil(num(v)),
  abs: ([v]) => Math.abs(num(v)),
  pct: ([a, b]) => (num(b) === 0 ? 0 : Math.round((num(a) / num(b)) * 100)),
  fixed: ([v, digits]) => num(v).toFixed(num(digits ?? 1)),
  upper: ([v]) => String(v ?? "").toUpperCase(),
  lower: ([v]) => String(v ?? "").toLowerCase(),
  trim: ([v]) => String(v ?? "").trim(),
  join: ([list, sep]) => asArray(list).map(String).join(String(sep ?? ", ")),
  first: ([list]) => asArray(list)[0],
  last: ([list]) => asArray(list)[asArray(list).length - 1],
  has: ([list, v]) => asArray(list).includes(v as never),
  contains: ([hay, needle]) => String(hay ?? "").toLowerCase().includes(String(needle ?? "").toLowerCase()),
  today: () => todayISO(),
  now: () => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
  weekday: ([iso]) =>
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date(String(iso ?? todayISO()) + "T00:00:00").getDay()
    ] ?? "",
  addDays: ([iso, days]) => {
    const d = new Date(String(iso ?? todayISO()) + "T00:00:00");
    d.setDate(d.getDate() + num(days));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
  daysBetween: ([a, b]) => {
    const t1 = new Date(String(a) + "T00:00:00").getTime();
    const t2 = new Date(String(b ?? todayISO()) + "T00:00:00").getTime();
    if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 0;
    return Math.round((t1 - t2) / 86400000);
  },
  clamp: ([v, lo, hi]) => Math.min(Math.max(num(v), num(lo)), num(hi)),
  uid: () => Math.random().toString(36).slice(2, 10),
  num: ([v]) => num(v),
  str: ([v]) => String(v ?? ""),
  ifelse: ([c, a, b]) => (c ? a : b),
  plural: ([n, one, many]) => (num(n) === 1 ? String(one ?? "") : String(many ?? one ?? "")),
};

function evalAst(ast: Ast, scope: Scope): unknown {
  switch (ast.n) {
    case "lit":
      return ast.v;
    case "path":
      return readPath(scope, ast.parts);
    case "index": {
      const target = evalAst(ast.target, scope);
      const key = evalAst(ast.index, scope);
      return readPath(target, [String(key)]);
    }
    case "call": {
      const fn = FUNCTIONS[ast.name];
      if (!fn) return undefined;
      return fn(ast.args.map((a) => evalAst(a, scope)));
    }
    case "unary": {
      const v = evalAst(ast.arg, scope);
      return ast.op === "!" ? !v : -num(v);
    }
    case "cond":
      return evalAst(ast.c, scope) ? evalAst(ast.a, scope) : evalAst(ast.b, scope);
    case "bin": {
      const { op } = ast;
      if (op === "&&") return evalAst(ast.l, scope) && evalAst(ast.r, scope);
      if (op === "||") return evalAst(ast.l, scope) || evalAst(ast.r, scope);
      const l = evalAst(ast.l, scope);
      const r = evalAst(ast.r, scope);
      switch (op) {
        case "??":
          return l ?? r;
        case "==":
          return l === r || String(l) === String(r);
        case "!=":
          return !(l === r || String(l) === String(r));
        case "<":
          return num(l) < num(r);
        case ">":
          return num(l) > num(r);
        case "<=":
          return num(l) <= num(r);
        case ">=":
          return num(l) >= num(r);
        case "+":
          if (typeof l === "string" || typeof r === "string") return String(l ?? "") + String(r ?? "");
          return num(l) + num(r);
        case "-":
          return num(l) - num(r);
        case "*":
          return num(l) * num(r);
        case "/":
          return num(r) === 0 ? 0 : num(l) / num(r);
        case "%":
          return num(r) === 0 ? 0 : num(l) % num(r);
      }
      return undefined;
    }
  }
}

/** Evaluate a single expression. Returns `undefined` when the source is broken. */
export function evaluate(src: string, scope: Scope): unknown {
  try {
    return evalAst(parseCached(src), scope);
  } catch {
    return undefined;
  }
}

const TEMPLATE = /\{\{([^}]+)\}\}/g;
const WHOLE_TEMPLATE = /^\s*\{\{([^}]+)\}\}\s*$/;

/** Render a string, substituting every `{{ expr }}` with its value. */
export function template(src: string, scope: Scope): string {
  if (!src.includes("{{")) return src;
  return src.replace(TEMPLATE, (_, expr) => {
    const v = evaluate(expr, scope);
    if (v === undefined || v === null) return "";
    if (typeof v === "number") return String(Math.round(v * 1000) / 1000);
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  });
}

/**
 * Resolve a spec value. A string that is nothing but one `{{ expr }}` keeps the
 * expression's real type (number, boolean, array); anything else interpolates.
 */
export function resolve(value: unknown, scope: Scope): unknown {
  if (typeof value === "string") {
    const whole = value.match(WHOLE_TEMPLATE);
    if (whole) return evaluate(whole[1], scope);
    return template(value, scope);
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, scope));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED.has(k)) continue;
      out[k] = resolve(v, scope);
    }
    return out;
  }
  return value;
}

export function truthy(src: string, scope: Scope): boolean {
  return Boolean(resolve(src.includes("{{") ? src : `{{${src}}}`, scope));
}

/** `items[2].done` / `items[{{$index}}].done` -> ["items", "2", "done"] */
export function pathParts(path: string, scope: Scope): string[] {
  const resolved = template(path, scope);
  return resolved
    .replace(/\[(\w+)\]/g, ".$1")
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !BLOCKED.has(p));
}

/** Immutably write `value` at `path` inside `root`. */
export function writePath(root: Record<string, unknown>, parts: string[], value: unknown): Record<string, unknown> {
  if (!parts.length) return root;
  const [head, ...rest] = parts;
  const clone: Record<string, unknown> | unknown[] = Array.isArray(root) ? [...root] : { ...root };
  const key = Array.isArray(clone) ? Number(head) : head;
  if (!rest.length) {
    (clone as Record<string, unknown>)[key as string] = value;
  } else {
    const child = (clone as Record<string, unknown>)[key as string];
    const base =
      child && typeof child === "object"
        ? (child as Record<string, unknown>)
        : /^\d+$/.test(rest[0])
          ? ([] as unknown as Record<string, unknown>)
          : {};
    (clone as Record<string, unknown>)[key as string] = writePath(base, rest, value);
  }
  return clone as Record<string, unknown>;
}
