"use client";

import { useState } from "react";
import { useDashboard } from "@/lib/store";
import { isCustom, type Widget } from "@/lib/types";
import WidgetFrame from "./WidgetFrame";
import SpecWidget from "./SpecWidget";
import Clock from "./widgets/Clock";
import Weather from "./widgets/Weather";
import News from "./widgets/News";
import SearchBar from "./widgets/SearchBar";
import Links from "./widgets/Links";

function BuiltinBody({ widget, name }: { widget: Extract<Widget, { settings: Record<string, unknown> }>; name: string }) {
  switch (widget.kind) {
    case "clock":
      return <Clock name={name} />;
    case "weather":
      return <Weather />;
    case "news":
      return <News id={widget.id} settings={widget.settings} />;
    case "search":
      return <SearchBar id={widget.id} settings={widget.settings} />;
    case "links":
      return <Links id={widget.id} settings={widget.settings} />;
    default:
      return null;
  }
}

export default function Dashboard({ onEditWidget }: { onEditWidget: (id: string) => void }) {
  const { widgets, prefs, removeWidget, setSpan, setWidgetState, moveWidget, ready } = useDashboard();
  const [dragId, setDragId] = useState<string | null>(null);

  if (!ready) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {widgets.map((w, index) => (
        <WidgetFrame
          key={w.id}
          title={w.title}
          icon={w.icon}
          span={w.span ?? 1}
          dragging={dragId === w.id}
          onDragStart={() => setDragId(w.id)}
          onDragEnd={() => setDragId(null)}
          onDragOver={() => {
            if (dragId && dragId !== w.id) moveWidget(dragId, index);
          }}
          onRemove={() => removeWidget(w.id)}
          onSpan={(span) => setSpan(w.id, span)}
          onEdit={isCustom(w) ? () => onEditWidget(w.id) : undefined}
        >
          {isCustom(w) ? (
            <SpecWidget widget={w} onState={(next) => setWidgetState(w.id, next)} />
          ) : (
            <BuiltinBody widget={w} name={prefs.name} />
          )}
        </WidgetFrame>
      ))}
    </div>
  );
}
