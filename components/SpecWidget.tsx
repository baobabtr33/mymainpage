"use client";

import { Fragment, useEffect, useRef } from "react";
import type { Action, CustomWidget, Node } from "@/lib/types";
import { applyActions, bindValue, nodeCondition, nodeNumber, nodeText, repeatScope, setBind, type Scope } from "@/lib/runtime";
import { resolve } from "@/lib/expr";

type Ctx = {
  state: Record<string, unknown>;
  run: (action: Action | Action[] | undefined, scope: Scope) => void;
  write: (bind: string, value: unknown, scope: Scope) => void;
};

const sizeClass: Record<string, string> = {
  xs: "text-[11px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-xl font-semibold",
};

const toneClass: Record<string, string> = {
  neutral: "",
  accent: "text-[var(--accent)] border-[color-mix(in_srgb,var(--accent)_45%,transparent)]",
  good: "text-emerald-300",
  warn: "text-amber-300",
  bad: "text-rose-300",
};

function mmss(total: number) {
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function TimerNode({ node, scope, ctx }: { node: Extract<Node, { t: "timer" }>; scope: Scope; ctx: Ctx }) {
  const value = nodeNumber(node.bind.includes("{{") ? node.bind : `{{${node.bind}}}`, scope);
  const running = nodeCondition(node.running, scope);
  const dir = node.direction ?? "down";
  const latest = useRef({ value, scope, ctx });
  useEffect(() => {
    latest.current = { value, scope, ctx };
  });

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      const { value: v, scope: s, ctx } = latest.current;
      const next = dir === "down" ? v - 1 : v + 1;
      if (dir === "down" && next <= 0) {
        ctx.write(node.bind, 0, s);
        ctx.run(node.onDone, s);
        return;
      }
      ctx.write(node.bind, next, s);
    }, 1000);
    return () => window.clearInterval(t);
  }, [running, dir, node.bind, node.onDone]);

  return (
    <div className="py-1 text-center font-mono text-4xl tabular-nums tracking-tight">
      {mmss(value)}
    </div>
  );
}

function RenderNode({ node, scope, ctx }: { node: Node; scope: Scope; ctx: Ctx }) {
  switch (node.t) {
    case "stack":
      return (
        <div className="flex flex-col" style={{ gap: `${(node.gap ?? 2) * 0.25}rem` }}>
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} scope={scope} ctx={ctx} />
          ))}
        </div>
      );

    case "row":
      return (
        <div
          className={[
            "flex items-center",
            node.wrap ? "flex-wrap" : "",
            node.align === "between" ? "justify-between" : node.align === "center" ? "justify-center" : "",
          ].join(" ")}
          style={{ gap: `${(node.gap ?? 2) * 0.25}rem` }}
        >
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} scope={scope} ctx={ctx} />
          ))}
        </div>
      );

    case "grid":
      return (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${Math.min(Math.max(node.cols ?? 2, 1), 7)}, minmax(0, 1fr))`,
            gap: `${(node.gap ?? 2) * 0.25}rem`,
          }}
        >
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} scope={scope} ctx={ctx} />
          ))}
        </div>
      );

    case "text": {
      const struck = node.strikeWhen ? nodeCondition(node.strikeWhen, scope) : false;
      return (
        <span
          className={[
            sizeClass[node.size ?? "md"],
            node.muted ? "muted" : "",
            node.grow ? "flex-1 min-w-0 truncate" : "",
            struck ? "line-through opacity-50" : "",
          ].join(" ")}
        >
          {nodeText(node.value, scope)}
        </span>
      );
    }

    case "heading":
      return <h4 className="text-sm font-semibold tracking-tight">{nodeText(node.value, scope)}</h4>;

    case "stat":
      return (
        <div>
          <div className="text-[11px] uppercase tracking-wide muted">{nodeText(node.label, scope)}</div>
          <div className="text-2xl font-semibold tabular-nums">{nodeText(node.value, scope)}</div>
          {node.hint ? <div className="text-[11px] muted">{nodeText(node.hint, scope)}</div> : null}
        </div>
      );

    case "badge":
      return <span className={`chip ${toneClass[node.tone ?? "neutral"]}`}>{nodeText(node.value, scope)}</span>;

    case "progress": {
      const value = nodeNumber(node.value, scope);
      const max = nodeNumber(node.max, scope, 100) || 1;
      const pct = Math.max(0, Math.min(100, (value / max) * 100));
      return (
        <div className="w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-strong)]">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${pct}%`, background: "var(--accent)" }}
            />
          </div>
          {node.label ? <div className="mt-1 text-[11px] muted">{nodeText(node.label, scope)}</div> : null}
        </div>
      );
    }

    case "button":
      return (
        <button
          type="button"
          className={[
            "btn",
            node.variant === "primary" ? "btn-primary" : node.variant === "danger" ? "btn-danger" : "btn-ghost",
            node.grow ? "flex-1" : "",
          ].join(" ")}
          onClick={() => ctx.run(node.on, scope)}
        >
          {nodeText(node.label, scope)}
        </button>
      );

    case "input": {
      const value = bindValue(node.bind, scope);
      return (
        <input
          className={`field ${node.grow ? "flex-1 min-w-0" : ""}`}
          type={node.inputType ?? "text"}
          placeholder={node.placeholder ? nodeText(node.placeholder, scope) : undefined}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) =>
            ctx.write(node.bind, node.inputType === "number" ? e.target.value.replace(/[^\d.-]/g, "") : e.target.value, scope)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && node.onSubmit) {
              e.preventDefault();
              ctx.run(node.onSubmit, scope);
            }
          }}
        />
      );
    }

    case "textarea": {
      const value = bindValue(node.bind, scope);
      return (
        <textarea
          className="field scroll-thin resize-none"
          rows={node.rows ?? 4}
          placeholder={node.placeholder ? nodeText(node.placeholder, scope) : undefined}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => ctx.write(node.bind, e.target.value, scope)}
        />
      );
    }

    case "checkbox": {
      const checked = Boolean(bindValue(node.bind, scope));
      return (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={checked}
            onChange={(e) => ctx.write(node.bind, e.target.checked, scope)}
          />
          {node.label ? <span>{nodeText(node.label, scope)}</span> : null}
        </label>
      );
    }

    case "select": {
      const value = bindValue(node.bind, scope);
      return (
        <select
          className="field"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => ctx.write(node.bind, e.target.value, scope)}
        >
          {node.options.map((o) => {
            const label = nodeText(o, scope);
            return (
              <option key={o} value={label} className="bg-[var(--bg-2)]">
                {label}
              </option>
            );
          })}
        </select>
      );
    }

    case "repeat": {
      const listExpr = node.each.includes("{{") ? node.each : `{{${node.each}}}`;
      const raw = resolve(listExpr, scope);
      const list = Array.isArray(raw) ? raw : [];
      if (!list.length) {
        return node.empty ? <p className="py-2 text-xs muted">{nodeText(node.empty, scope)}</p> : null;
      }
      const alias = node.as ?? "item";
      return (
        <div className="flex flex-col gap-1.5">
          {list.map((item, i) => {
            const child = repeatScope(scope, alias, item, i, list.length);
            const key =
              item && typeof item === "object" && "id" in (item as Record<string, unknown>)
                ? String((item as Record<string, unknown>).id)
                : i;
            return (
              <Fragment key={key}>
                {node.children.map((c, j) => (
                  <RenderNode key={j} node={c} scope={child} ctx={ctx} />
                ))}
              </Fragment>
            );
          })}
        </div>
      );
    }

    case "if": {
      const branch = nodeCondition(node.cond, scope) ? node.children : (node.else ?? []);
      return (
        <>
          {branch.map((c, i) => (
            <RenderNode key={i} node={c} scope={scope} ctx={ctx} />
          ))}
        </>
      );
    }

    case "divider":
      return <hr className="my-1 border-0 border-t" style={{ borderColor: "var(--border)" }} />;

    case "timer":
      return <TimerNode node={node} scope={scope} ctx={ctx} />;

    case "link":
      return (
        <a
          className="text-sm text-[var(--accent)] hover:underline"
          href={nodeText(node.href, scope)}
          target="_blank"
          rel="noreferrer noopener"
        >
          {nodeText(node.label, scope)}
        </a>
      );
  }
}

export default function SpecWidget({
  widget,
  onState,
}: {
  widget: CustomWidget;
  onState: (next: Record<string, unknown>) => void;
}) {
  const state = widget.state ?? {};
  const ctx: Ctx = {
    state,
    run: (action, scope) => {
      if (!action) return;
      onState(applyActions(state, action, { ...scope, state }));
    },
    write: (bind, value, scope) => onState(setBind(state, bind, value, { ...scope, state })),
  };

  return (
    <div className="flex flex-col gap-2.5">
      {widget.body.map((node, i) => (
        <RenderNode key={i} node={node} scope={{ state }} ctx={ctx} />
      ))}
    </div>
  );
}
