import { NextResponse } from "next/server";

/** Open-Meteo needs no API key, so the dashboard works out of the box. */
const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear", icon: "☀️" },
  1: { label: "Mostly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Rime fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌦️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "❄️" },
  75: { label: "Heavy snow", icon: "❄️" },
  80: { label: "Showers", icon: "🌦️" },
  81: { label: "Showers", icon: "🌧️" },
  82: { label: "Violent showers", icon: "⛈️" },
  85: { label: "Snow showers", icon: "🌨️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm, hail", icon: "⛈️" },
  99: { label: "Thunderstorm, hail", icon: "⛈️" },
};

const describe = (code: number) => WEATHER_CODES[code] ?? { label: "—", icon: "🌡️" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const place = (params.get("place") ?? "Seoul").trim();
  const units = params.get("units") === "imperial" ? "imperial" : "metric";
  let lat = Number(params.get("lat"));
  let lon = Number(params.get("lon"));
  let name = place;
  let country = "";

  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`,
        { next: { revalidate: 86400 } },
      );
      const geoBody = (await geo.json()) as {
        results?: { latitude: number; longitude: number; name: string; country_code?: string; admin1?: string }[];
      };
      const hit = geoBody.results?.[0];
      if (!hit) return NextResponse.json({ error: `Could not find "${place}"` }, { status: 404 });
      lat = hit.latitude;
      lon = hit.longitude;
      name = hit.name;
      country = hit.country_code ?? hit.admin1 ?? "";
    }

    const tempUnit = units === "imperial" ? "fahrenheit" : "celsius";
    const windUnit = units === "imperial" ? "mph" : "kmh";
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&forecast_days=4&timezone=auto&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}`,
      { next: { revalidate: 900 } },
    );
    if (!res.ok) return NextResponse.json({ error: "Weather service unavailable" }, { status: 502 });

    const body = (await res.json()) as {
      current: {
        temperature_2m: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        weather_code: number;
        wind_speed_10m: number;
      };
      daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: (number | null)[];
      };
    };

    return NextResponse.json({
      place: country ? `${name}, ${country}` : name,
      units,
      current: {
        temp: Math.round(body.current.temperature_2m),
        feels: Math.round(body.current.apparent_temperature),
        humidity: body.current.relative_humidity_2m,
        wind: Math.round(body.current.wind_speed_10m),
        ...describe(body.current.weather_code),
      },
      daily: body.daily.time.slice(0, 4).map((day, i) => ({
        day,
        high: Math.round(body.daily.temperature_2m_max[i]),
        low: Math.round(body.daily.temperature_2m_min[i]),
        rain: body.daily.precipitation_probability_max[i] ?? 0,
        ...describe(body.daily.weather_code[i]),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the weather service" }, { status: 502 });
  }
}
