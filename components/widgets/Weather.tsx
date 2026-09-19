"use client";

import { useState } from "react";
import { useDashboard, useFetch } from "@/lib/store";

type WeatherData = {
  place: string;
  units: "metric" | "imperial";
  current: { temp: number; feels: number; humidity: number; wind: number; label: string; icon: string };
  daily: { day: string; high: number; low: number; rain: number; label: string; icon: string }[];
};

export default function Weather() {
  const { prefs, setPrefs } = useDashboard();
  const [draft, setDraft] = useState(prefs.place);
  const [editing, setEditing] = useState(false);
  const { data, error, loading } = useFetch<WeatherData>(
    `/api/weather?place=${encodeURIComponent(prefs.place)}&units=${prefs.units}`,
  );
  const deg = prefs.units === "imperial" ? "°F" : "°C";

  return (
    <div className="flex flex-col gap-3">
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) setPrefs({ place: draft.trim() });
            setEditing(false);
          }}
        >
          <input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="City" autoFocus />
          <button className="btn btn-primary" type="submit">
            Go
          </button>
        </form>
      ) : null}

      {loading && !data ? <div className="h-24 animate-pulse rounded-xl bg-[var(--surface-strong)]" /> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      {data ? (
        <>
          <div className="flex items-center gap-3">
            <span className="text-4xl leading-none">{data.current.icon}</span>
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                {data.current.temp}
                {deg}
              </div>
              <div className="text-xs muted">
                {data.current.label} · feels {data.current.feels}
                {deg}
              </div>
            </div>
          </div>

          <div className="flex gap-3 text-[11px] muted">
            <span>💧 {data.current.humidity}%</span>
            <span>🌬️ {data.current.wind} {prefs.units === "imperial" ? "mph" : "km/h"}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {data.daily.slice(1).map((d) => (
              <div key={d.day} className="rounded-lg border p-2 text-center" style={{ borderColor: "var(--border)" }}>
                <div className="text-[11px] muted">
                  {new Date(`${d.day}T00:00:00`).toLocaleDateString([], { weekday: "short" })}
                </div>
                <div className="text-lg leading-tight">{d.icon}</div>
                <div className="text-[11px] tabular-nums">
                  {d.high}° <span className="muted">{d.low}°</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] muted">
            <button className="hover:underline" onClick={() => setEditing((v) => !v)}>
              📍 {data.place}
            </button>
            <button
              className="hover:underline"
              onClick={() => setPrefs({ units: prefs.units === "metric" ? "imperial" : "metric" })}
            >
              {prefs.units === "metric" ? "→ °F" : "→ °C"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
