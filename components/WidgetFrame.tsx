"use client";

import { useState, type ReactNode } from "react";

export default function WidgetFrame({
  title,
  icon,
  span,
  children,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onRemove,
  onSpan,
  onEdit,
}: {
  title: string;
  icon: string;
  span: number;
  children: ReactNode;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onRemove: () => void;
  onSpan: (span: number) => void;
  onEdit?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const spanClass = span >= 3 ? "md:col-span-2 xl:col-span-3" : span === 2 ? "md:col-span-2" : "";

  return (
    <section
      className={`card rise group relative flex flex-col p-4 ${spanClass} ${dragging ? "opacity-40" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
    >
      <header className="mb-3 flex items-center gap-2">
        <span
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab select-none text-base active:cursor-grabbing"
          title="Drag to reorder"
        >
          {icon}
        </span>
        <h3 className="flex-1 truncate text-sm font-semibold tracking-tight">{title}</h3>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {onEdit ? (
            <button className="btn btn-ghost px-1.5 py-0.5 text-[11px]" onClick={onEdit} title="Ask Pip to change this">
              ✎
            </button>
          ) : null}
          <button
            className="btn btn-ghost px-1.5 py-0.5 text-[11px]"
            onClick={() => onSpan(span >= 3 ? 1 : span + 1)}
            title="Resize"
          >
            {span >= 3 ? "⤡" : "⤢"}
          </button>
          {confirming ? (
            <>
              <button className="btn btn-danger px-1.5 py-0.5 text-[11px]" onClick={onRemove}>
                Delete
              </button>
              <button className="btn btn-ghost px-1.5 py-0.5 text-[11px]" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <button className="btn btn-ghost px-1.5 py-0.5 text-[11px]" onClick={() => setConfirming(true)} title="Remove">
              ✕
            </button>
          )}
        </div>
      </header>

      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
