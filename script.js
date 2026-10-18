// Weather app using Open-Meteo (free, no API key needed)
// Docs: https://open-meteo.com/en/docs

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_CITY = "London";

// WMO weather code -> [description, icon, theme]
const WEATHER_CODES = {
  0: ["Clear sky", "☀️", "clear"],
  1: ["Mostly clear", "🌤️", "clear"],
  2: ["Partly cloudy", "⛅", "cloudy"],
  3: ["Overcast", "☁️", "cloudy"],
  45: ["Fog", "🌫️", "fog"],
  48: ["Freezing fog", "🌫️", "fog"],
  51: ["Light drizzle", "🌦️", "rain"],
  53: ["Drizzle", "🌦️", "rain"],
  55: ["Heavy drizzle", "🌧️", "rain"],
  56: ["Freezing drizzle", "🌧️", "rain"],
  57: ["Freezing drizzle", "🌧️", "rain"],
  61: ["Light rain", "🌦️", "rain"],
  63: ["Rain", "🌧️", "rain"],
  65: ["Heavy rain", "🌧️", "rain"],
  66: ["Freezing rain", "🌧️", "rain"],
  67: ["Freezing rain", "🌧️", "rain"],
  71: ["Light snow", "🌨️", "snow"],
  73: ["Snow", "❄️", "snow"],
  75: ["Heavy snow", "❄️", "snow"],
  77: ["Snow grains", "❄️", "snow"],
  80: ["Light showers", "🌦️", "rain"],
  81: ["Showers", "🌧️", "rain"],
  82: ["Heavy showers", "🌧️", "rain"],
  85: ["Snow showers", "🌨️", "snow"],
  86: ["Heavy snow showers", "🌨️", "snow"],
  95: ["Thunderstorm", "⛈️", "storm"],
  96: ["Thunderstorm with hail", "⛈️", "storm"],
  99: ["Thunderstorm with hail", "⛈️", "storm"],
};

const $ = (id) => document.getElementById(id);
const els = {
  form: $("search-form"),
  input: $("city-input"),
  locate: $("locate-btn"),
  status: $("status"),
  current: $("current"),
  forecast: $("forecast"),
  list: $("forecast-list"),
  name: $("place-name"),
  region: $("place-region"),
  temp: $("temp"),
  icon: $("icon"),
  condition: $("condition"),
  feels: $("feels"),
  humidity: $("humidity"),
  wind: $("wind"),
  unitButtons: document.querySelectorAll(".units button"),
};

let unit = "celsius"; // or "fahrenheit"
let place = null;     // { name, region, latitude, longitude }

/* ---------- Helpers ---------- */

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function describe(code, isDay) {
  const [label, icon, theme] = WEATHER_CODES[code] || ["Unknown", "🌡️", "cloudy"];
  const night = !isDay;
  return {
    label,
    icon: night && code <= 1 ? "🌙" : icon,
    theme: theme === "clear" ? (night ? "clear-night" : "clear-day") : theme,
  };
}

function savePlace() {
  try { localStorage.setItem("weather-place", JSON.stringify(place)); } catch (e) { /* storage unavailable */ }
}

function loadSavedPlace() {
  try { return JSON.parse(localStorage.getItem("weather-place")); } catch (e) { return null; }
}

/* ---------- Data ---------- */

async function findCity(query) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("City search failed. Try again.");
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`No city found for "${query}". Check the spelling and try again.`);
  }
  const r = data.results[0];
  return {
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

async function fetchWeather({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    temperature_unit: unit,
    wind_speed_unit: unit === "fahrenheit" ? "mph" : "kmh",
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error("Could not load the forecast. Try again.");
  return res.json();
}

/* ---------- Rendering ---------- */

function renderCurrent(data) {
  const c = data.current;
  const { label, icon, theme } = describe(c.weather_code, c.is_day);
  const speedUnit = unit === "fahrenheit" ? "mph" : "km/h";

  document.body.dataset.theme = theme;
  els.name.textContent = place.name;
  els.region.textContent = place.region;
  els.temp.textContent = `${Math.round(c.temperature_2m)}°`;
  els.icon.textContent = icon;
  els.condition.textContent = label;
  els.feels.textContent = `${Math.round(c.apparent_temperature)}°`;
  els.humidity.textContent = `${c.relative_humidity_2m}%`;
  els.wind.textContent = `${Math.round(c.wind_speed_10m)} ${speedUnit}`;
  els.current.hidden = false;
}

function renderForecast(data) {
  const d = data.daily;
  const weekLow = Math.min(...d.temperature_2m_min);
  const weekHigh = Math.max(...d.temperature_2m_max);
  const span = weekHigh - weekLow || 1;

  els.list.innerHTML = "";
  d.time.forEach((date, i) => {
    const lo = d.temperature_2m_min[i];
    const hi = d.temperature_2m_max[i];
    const left = ((lo - weekLow) / span) * 100;
    const width = Math.max(((hi - lo) / span) * 100, 6);
    const day = i === 0
      ? "Today"
      : new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });

    const li = document.createElement("li");
    li.innerHTML = `
      <span class="day">${day}</span>
      <span aria-hidden="true">${describe(d.weather_code[i], true).icon}</span>
      <span class="lo">${Math.round(lo)}°</span>
      <span class="range"><span style="left:${left}%;width:${width}%"></span></span>
      <span class="hi">${Math.round(hi)}°</span>`;
    els.list.appendChild(li);
  });
  els.forecast.hidden = false;
}

/* ---------- Flow ---------- */

async function showWeather() {
  setStatus("Loading weather…");
  try {
    const data = await fetchWeather(place);
    renderCurrent(data);
    renderForecast(data);
    setStatus("");
    savePlace();
  } catch (err) {
    setStatus(err.message || "Something went wrong. Check your connection.", true);
  }
}

async function searchCity(query) {
  setStatus("Searching…");
  try {
    place = await findCity(query);
    await showWeather();
  } catch (err) {
    setStatus(err.message || "Something went wrong. Check your connection.", true);
  }
}

function useMyLocation() {
  if (!navigator.geolocation) {
    setStatus("Your browser doesn't support location. Search for a city instead.", true);
    return;
  }
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      place = {
        name: "Your location",
        region: `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      showWeather();
    },
    () => setStatus("Location access was blocked. Allow it in your browser or search for a city.", true)
  );
}

/* ---------- Events ---------- */

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = els.input.value.trim();
  if (query) searchCity(query);
});

els.locate.addEventListener("click", useMyLocation);

els.unitButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.unit === unit) return;
    unit = btn.dataset.unit;
    els.unitButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    if (place) showWeather();
  });
});

/* ---------- Start ---------- */

const saved = loadSavedPlace();
if (saved) {
  place = saved;
  showWeather();
} else {
  searchCity(DEFAULT_CITY);
}