import type { Action, Node } from "./types";
import { evaluate, pathParts, readPath, resolve, template, writePath } from "./expr";

export type Scope = Record<string, unknown>;

/** Widget state is the root, so spec paths are written as `state.foo.bar`. */
function stateParts(path: string, scope: Scope): string[] {
  const parts = pathParts(path, scope);
  return parts[0] === "state" ? parts.slice(1) : parts;
}

export function playSound(name: "ding" | "click") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = name === "ding" ? 880 : 440;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (name === "ding" ? 0.6 : 0.12));
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
    osc.onended = () => ctx.close();
  } catch {
    // audio is a nicety, never a failure
  }
}

export function applyActions(
  state: Record<string, unknown>,
  action: Action | Action[] | undefined,
  scope: Scope,
): Record<string, unknown> {
  if (!action) return state;
  const list = Array.isArray(action) ? action : [action];
  let next = state;
  for (const act of list) {
    // Later actions in a batch see the earlier ones (e.g. push then clear the draft).
    const localScope = { ...scope, state: next };
    switch (act.a) {
      case "set":
        next = writePath(next, stateParts(act.path, localScope), resolve(act.value, localScope));
        break;
      case "toggle": {
        const parts = stateParts(act.path, localScope);
        next = writePath(next, parts, !readPath(next, parts));
        break;
      }
      case "inc": {
        const parts = stateParts(act.path, localScope);
        const by = Number(resolve(act.by ?? 1, localScope)) || 0;
        next = writePath(next, parts, Number(readPath(next, parts) ?? 0) + by);
        break;
      }
      case "push": {
        const parts = stateParts(act.path, localScope);
        const current = readPath(next, parts);
        const arr = Array.isArray(current) ? current : [];
        const value = resolve(act.value, localScope);
        const isBlank =
          value == null ||
          (typeof value === "string" && !value.trim()) ||
          (typeof value === "object" && "text" in (value as Record<string, unknown>) && !String((value as Record<string, unknown>).text ?? "").trim());
        if (isBlank) break;
        next = writePath(next, parts, [...arr, value]);
        break;
      }
      case "removeAt": {
        const parts = stateParts(act.path, localScope);
        const current = readPath(next, parts);
        if (!Array.isArray(current)) break;
        const idx = Number(resolve(act.index ?? "{{$index}}", localScope));
        if (!Number.isInteger(idx)) break;
        next = writePath(next, parts, current.filter((_, i) => i !== idx));
        break;
      }
      case "clear": {
        const parts = stateParts(act.path, localScope);
        const current = readPath(next, parts);
        next = writePath(next, parts, Array.isArray(current) ? [] : "");
        break;
      }
      case "sound":
        playSound(act.name ?? "ding");
        break;
    }
  }
  return next;
}

/** Scope vars a `repeat` adds for its children. */
export function repeatScope(scope: Scope, alias: string, item: unknown, index: number, total: number): Scope {
  return {
    ...scope,
    [alias]: item,
    [`${alias}Index`]: index,
    $index: index,
    $first: index === 0,
    $last: index === total - 1,
  };
}

export function nodeText(value: string, scope: Scope): string {
  return String(resolve(value, scope) ?? "");
}

export function nodeNumber(value: string | undefined, scope: Scope, fallback = 0): number {
  if (value === undefined) return fallback;
  const v = resolve(value, scope);
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

export function nodeCondition(cond: string, scope: Scope): boolean {
  const expr = cond.includes("{{") ? cond : `{{${cond}}}`;
  return Boolean(resolve(expr, scope));
}

export function bindValue(bind: string, scope: Scope): unknown {
  return evaluate(template(bind, scope), scope);
}

/** Write a two-way bound input value back into widget state. */
export function setBind(
  state: Record<string, unknown>,
  bind: string,
  value: unknown,
  scope: Scope,
): Record<string, unknown> {
  return writePath(state, stateParts(bind, { ...scope, state }), value);
}

export function countNodes(nodes: Node[]): number {
  let n = 0;
  const walk = (list: Node[]) => {
    for (const node of list) {
      n++;
      if ("children" in node && Array.isArray(node.children)) walk(node.children as Node[]);
      if (node.t === "if" && node.else) walk(node.else);
    }
  };
  walk(nodes);
  return n;
}
