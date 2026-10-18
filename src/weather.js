// Real weather + day/night for the active campus, via Open-Meteo — free,
// keyless, no account needed. Refreshes periodically so the Yard's sky
// actually matches what's happening outside.
let LAT = 34.2422394;
let LON = -92.0206016;
const REFRESH_MS = 15 * 60 * 1000;

export function setWeatherLocation(lat, lon) {
  LAT = lat;
  LON = lon;
}

const WEATHER_CODES = {
  0: { label: "Clear", icon: "☀️", category: "clear" },
  1: { label: "Mostly clear", icon: "🌤️", category: "clear" },
  2: { label: "Partly cloudy", icon: "⛅", category: "cloudy" },
  3: { label: "Overcast", icon: "☁️", category: "cloudy" },
  45: { label: "Foggy", icon: "🌫️", category: "fog" },
  48: { label: "Foggy", icon: "🌫️", category: "fog" },
  51: { label: "Light drizzle", icon: "🌦️", category: "rain" },
  53: { label: "Drizzle", icon: "🌦️", category: "rain" },
  55: { label: "Heavy drizzle", icon: "🌧️", category: "rain" },
  61: { label: "Light rain", icon: "🌦️", category: "rain" },
  63: { label: "Rain", icon: "🌧️", category: "rain" },
  65: { label: "Heavy rain", icon: "🌧️", category: "rain" },
  71: { label: "Light snow", icon: "🌨️", category: "snow" },
  73: { label: "Snow", icon: "🌨️", category: "snow" },
  75: { label: "Heavy snow", icon: "❄️", category: "snow" },
  80: { label: "Rain showers", icon: "🌦️", category: "rain" },
  81: { label: "Rain showers", icon: "🌧️", category: "rain" },
  82: { label: "Heavy showers", icon: "🌧️", category: "rain" },
  95: { label: "Thunderstorm", icon: "⛈️", category: "storm" },
  96: { label: "Thunderstorm", icon: "⛈️", category: "storm" },
  99: { label: "Severe storm", icon: "⛈️", category: "storm" },
};

let current = null;
const listeners = new Set();

export function onWeatherChange(fn) {
  listeners.add(fn);
  if (current) fn(current);
  return () => listeners.delete(fn);
}

export function getWeather() {
  return current;
}

export async function refreshWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day,wind_speed_10m&temperature_unit=fahrenheit&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("weather fetch failed: " + res.status);
    const data = await res.json();
    const code = data.current.weather_code;
    const meta = WEATHER_CODES[code] || { label: "Unknown", icon: "🌡️", category: "clear" };
    current = {
      tempF: Math.round(data.current.temperature_2m),
      windKmh: Math.round(data.current.wind_speed_10m),
      isDay: data.current.is_day === 1,
      code,
      ...meta,
    };
  } catch (err) {
    console.warn("[The Yard] weather fetch failed, using clear-day fallback:", err.message);
    current = { tempF: null, windKmh: null, isDay: true, code: 0, label: "Clear", icon: "☀️", category: "clear" };
  }
  listeners.forEach((fn) => fn(current));
  return current;
}

export function startWeatherLoop() {
  refreshWeather();
  setInterval(refreshWeather, REFRESH_MS);
}
