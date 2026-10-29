/* ============================================================================
   Nimbus — script.js
   Vanilla JavaScript. No dependencies, no build step, no API key.

   Data sources (all free, all public):
     • Geocoding .......... https://geocoding-api.open-meteo.com
     • Forecast ........... https://api.open-meteo.com/v1/forecast
     • Air quality ........ https://air-quality-api.open-meteo.com/v1/air-quality

   Persistence: localStorage (theme, unit, saved cities, last location).
   No accounts, no payments, no server.
   ========================================================================== */

(function () {
  'use strict';

  /* ==========================================================================
     1. Constants & tiny helpers
     ========================================================================== */

  const API = {
    geo: 'https://geocoding-api.open-meteo.com/v1/search',
    forecast: 'https://api.open-meteo.com/v1/forecast',
    air: 'https://air-quality-api.open-meteo.com/v1/air-quality',
    /* Independent national met service — used to cross-check the primary source. */
    metno: 'https://api.met.no/weatherapi/locationforecast/2.0/compact',
    /* Optional: needs the visitor's own Google Maps Platform key. */
    google: 'https://weather.googleapis.com/v1/currentConditions:lookup'
  };

  const STORE = {
    theme: 'nimbus.theme',
    unit: 'nimbus.unit',
    saved: 'nimbus.saved',
    last: 'nimbus.last',
    googleKey: 'nimbus.googleKey'
  };

  const REFRESH_MS = 10 * 60 * 1000; // auto-refresh every 10 minutes

  const DEFAULT_PLACE = {
    name: 'Kolkata',
    admin1: 'West Bengal',
    country: 'India',
    country_code: 'IN',
    latitude: 22.5626,
    longitude: 88.363,
    timezone: 'Asia/Kolkata'
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function esc(value) {
    return String(value === null || value === undefined ? '' : value).replace(
      /[&<>"']/g,
      (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
    );
  }

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* storage may be blocked (private mode) — the app still works */
    }
  }

  function flagOf(code) {
    if (!code || String(code).length !== 2) return '📍';
    return String(code)
      .toUpperCase()
      .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
  }

  /* ==========================================================================
     2. Weather icons (inline SVG, inherit currentColor)
     ========================================================================== */

  const ICON_PATHS = {
    sun:
      '<circle cx="12" cy="12" r="4.3"/>' +
      '<path d="M12 2.4v2.3M12 19.3v2.3M2.4 12h2.3M19.3 12h2.3M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/>',
    moon: '<path d="M20.4 13.7A8.7 8.7 0 1 1 10.3 3.6a6.9 6.9 0 0 0 10.1 10.1Z"/>',
    cloud: '<path d="M7.3 19h9.9a3.9 3.9 0 0 0 .2-7.8 6 6 0 0 0-11.3-1.4A4.3 4.3 0 0 0 7.3 19Z"/>',
    partly:
      '<circle cx="8.2" cy="7.9" r="2.9"/>' +
      '<path d="M8.2 2.8v1.5M3.1 7.9H1.6M14.7 7.9h1.5M3.9 3.6l1.1 1.1"/>' +
      '<path d="M10.1 20.6h7.5a3.3 3.3 0 0 0 .2-6.6 5 5 0 0 0-9.4-1.1 3.6 3.6 0 0 0 1.7 7.7Z"/>',
    partlyNight:
      '<path d="M12.8 10.6A5.7 5.7 0 1 1 5.2 3a4.5 4.5 0 0 0 7.6 7.6Z"/>' +
      '<path d="M10.1 20.6h7.5a3.3 3.3 0 0 0 .2-6.6 5 5 0 0 0-9.4-1.1 3.6 3.6 0 0 0 1.7 7.7Z"/>',
    fog: '<path d="M6.4 9h11.2M4.2 13h15.6M6.4 17h11.2"/>',
    drizzle:
      '<path d="M7.3 16h9.9a3.9 3.9 0 0 0 .2-7.8 6 6 0 0 0-11.3-1.4A4.3 4.3 0 0 0 7.3 16Z"/>' +
      '<path d="M9.2 19v1.6M14.8 19v1.6"/>',
    rain:
      '<path d="M7.3 15.4h9.9a3.9 3.9 0 0 0 .2-7.8 6 6 0 0 0-11.3-1.4A4.3 4.3 0 0 0 7.3 15.4Z"/>' +
      '<path d="M8.6 18.4l-.9 2.2M12 18.4l-.9 2.2M15.4 18.4l-.9 2.2"/>',
    snow:
      '<path d="M7.3 15h9.9a3.9 3.9 0 0 0 .2-7.8 6 6 0 0 0-11.3-1.4A4.3 4.3 0 0 0 7.3 15Z"/>' +
      '<circle cx="8.8" cy="18.9" r="1"/><circle cx="12" cy="20.4" r="1"/><circle cx="15.2" cy="18.9" r="1"/>',
    thunder:
      '<path d="M7.3 14.6h9.9a3.9 3.9 0 0 0 .2-7.8 6 6 0 0 0-11.3-1.4A4.3 4.3 0 0 0 7.3 14.6Z"/>' +
      '<path d="M12.9 16.3l-2.6 3.4h3.2l-2.3 3.1"/>'
  };

  function svgIcon(name, size) {
    const body = ICON_PATHS[name] || ICON_PATHS.cloud;
    const s = size || 24;
    return (
      '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + body + '</svg>'
    );
  }

  /* ==========================================================================
     3. WMO weather codes → label + icon
     ========================================================================== */

  const WMO = {
    0: ['Clear sky', 'sun', 'moon'],
    1: ['Mainly clear', 'sun', 'moon'],
    2: ['Partly cloudy', 'partly', 'partlyNight'],
    3: ['Overcast', 'cloud', 'cloud'],
    45: ['Fog', 'fog', 'fog'],
    48: ['Depositing rime fog', 'fog', 'fog'],
    51: ['Light drizzle', 'drizzle', 'drizzle'],
    53: ['Moderate drizzle', 'drizzle', 'drizzle'],
    55: ['Dense drizzle', 'drizzle', 'drizzle'],
    56: ['Light freezing drizzle', 'drizzle', 'drizzle'],
    57: ['Dense freezing drizzle', 'drizzle', 'drizzle'],
    61: ['Light rain', 'rain', 'rain'],
    63: ['Moderate rain', 'rain', 'rain'],
    65: ['Heavy rain', 'rain', 'rain'],
    66: ['Light freezing rain', 'rain', 'rain'],
    67: ['Heavy freezing rain', 'rain', 'rain'],
    71: ['Light snow', 'snow', 'snow'],
    73: ['Moderate snow', 'snow', 'snow'],
    75: ['Heavy snow', 'snow', 'snow'],
    77: ['Snow grains', 'snow', 'snow'],
    80: ['Light rain showers', 'rain', 'rain'],
    81: ['Moderate rain showers', 'rain', 'rain'],
    82: ['Violent rain showers', 'thunder', 'thunder'],
    85: ['Light snow showers', 'snow', 'snow'],
    86: ['Heavy snow showers', 'snow', 'snow'],
    95: ['Thunderstorm', 'thunder', 'thunder'],
    96: ['Thunderstorm with hail', 'thunder', 'thunder'],
    99: ['Severe thunderstorm with hail', 'thunder', 'thunder']
  };

  function describeCode(code, isDay) {
    const entry = WMO[code] || ['Unsettled', 'cloud', 'cloud'];
    const night = isDay === 0 || isDay === false;
    return { label: entry[0], icon: night ? entry[2] : entry[1] };
  }

  /* ==========================================================================
     4. Air quality bands (US AQI)
     ========================================================================== */

  const AQI_BANDS = [
    { max: 50, label: 'Good', color: '#22c55e', advice: 'Air quality is satisfactory — a great day to be outside.' },
    { max: 100, label: 'Moderate', color: '#84cc16', advice: 'Acceptable for most people. Very sensitive groups may notice mild effects.' },
    { max: 150, label: 'Unhealthy for sensitive groups', color: '#f59e0b', advice: 'Children, older adults and asthmatics should limit long outdoor exertion.' },
    { max: 200, label: 'Unhealthy', color: '#ef4444', advice: 'Cut back on outdoor exercise and consider a mask when going out.' },
    { max: 300, label: 'Very unhealthy', color: '#a855f7', advice: 'Avoid outdoor exertion, keep windows closed and run a purifier if you have one.' },
    { max: Infinity, label: 'Hazardous', color: '#7f1d1d', advice: 'Stay indoors and avoid outdoor activity until the air clears.' }
  ];

  function aqiBand(value) {
    for (let i = 0; i < AQI_BANDS.length; i++) {
      if (value <= AQI_BANDS[i].max) return AQI_BANDS[i];
    }
    return AQI_BANDS[AQI_BANDS.length - 1];
  }

  function uvBand(value) {
    if (value < 3) return { label: 'Low', advice: 'No protection needed' };
    if (value < 6) return { label: 'Moderate', advice: 'Sunscreen advised' };
    if (value < 8) return { label: 'High', advice: 'Hat, shade, SPF 30+' };
    if (value < 11) return { label: 'Very high', advice: 'Avoid midday sun' };
    return { label: 'Extreme', advice: 'Stay out of direct sun' };
  }

  /* ==========================================================================
     5. App state
     ========================================================================== */

  const state = {
    unit: readStore(STORE.unit, 'c') === 'f' ? 'f' : 'c',
    saved: Array.isArray(readStore(STORE.saved, [])) ? readStore(STORE.saved, []) : [],
    place: null,
    forecast: null,
    air: null,
    airError: false,
    updatedAt: 0,
    busy: false,
    lastAction: null,
    googleKey: readStore(STORE.googleKey, '') || '',
    sources: { metNo: null, google: null, googleError: '' }
  };

  /* unit conversion helpers ------------------------------------------------- */
  const toF = (c) => (c * 9) / 5 + 32;
  const tempVal = (c) => (typeof c === 'number' && isFinite(c) ? (state.unit === 'f' ? toF(c) : c) : null);
  const t = (c) => {
    const v = tempVal(c);
    return v === null ? '–' : Math.round(v);
  };
  const speedVal = (kmh) => (typeof kmh === 'number' && isFinite(kmh) ? (state.unit === 'f' ? kmh * 0.621371 : kmh) : null);
  const spd = (kmh) => {
    const v = speedVal(kmh);
    return v === null ? '–' : Math.round(v);
  };
  const speedUnit = () => (state.unit === 'f' ? 'mph' : 'km/h');
  const dist = (metres) => {
    if (typeof metres !== 'number' || !isFinite(metres)) return '–';
    return state.unit === 'f'
      ? (metres / 1609.34).toFixed(1) + ' mi'
      : (metres / 1000).toFixed(1) + ' km';
  };
  const unitSymbol = () => (state.unit === 'f' ? '°F' : '°C');

  /* ==========================================================================
     6. Networking
     ========================================================================== */

  async function getJSON(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 14000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Too many requests right now. Wait a few seconds and try again.');
        }
        throw new Error('The weather service returned an error (HTTP ' + res.status + ').');
      }
      return await res.json();
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new Error('The request timed out. Check your connection and try again.');
      }
      /* `instanceof` can fail across realms, so also match on the error name. */
      if (err instanceof TypeError || (err && err.name === 'TypeError')) {
        throw new Error('Network problem — you may be offline. Reconnect and try again.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function searchPlaces(query) {
    const url =
      API.geo +
      '?name=' + encodeURIComponent(query) +
      '&count=8&language=en&format=json';
    const data = await getJSON(url, 10000);
    return Array.isArray(data.results) ? data.results : [];
  }

  function buildForecastUrl(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m'
      ].join(','),
      hourly: [
        'temperature_2m',
        'weather_code',
        'precipitation_probability',
        'precipitation',
        'visibility',
        'is_day'
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'uv_index_max',
        'precipitation_probability_max',
        'precipitation_sum',
        'wind_speed_10m_max'
      ].join(','),
      timezone: 'auto',
      forecast_days: '7',
      wind_speed_unit: 'kmh',
      /* 15-minute resolution for the short-range rain nowcast */
      minutely_15: ['precipitation', 'precipitation_probability', 'weather_code'].join(','),
      forecast_minutely_15: '8'
    });
    return API.forecast + '?' + params.toString();
  }

  function buildAirUrl(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide',
      timezone: 'auto'
    });
    return API.air + '?' + params.toString();
  }

  /* --- MET Norway (yr.no) — independent second opinion, no key ------------- */
  async function fetchMetNo(lat, lon) {
    const url =
      API.metno + '?lat=' + Number(lat).toFixed(4) + '&lon=' + Number(lon).toFixed(4);
    const data = await getJSON(url, 12000);
    const series = data && data.properties && data.properties.timeseries;
    if (!Array.isArray(series) || !series.length) {
      throw new Error('MET Norway returned no timeseries');
    }

    /* Pick the hourly step nearest to right now. */
    const now = Date.now();
    let best = series[0];
    let bestGap = Infinity;
    series.forEach(function (entry) {
      const at = Date.parse(entry.time);
      if (isNaN(at)) return;
      const gap = Math.abs(at - now);
      if (gap < bestGap) {
        bestGap = gap;
        best = entry;
      }
    });

    const det = (best.data && best.data.instant && best.data.instant.details) || {};
    const next1 = (best.data && best.data.next_1_hours) || {};
    return {
      tempC: typeof det.air_temperature === 'number' ? det.air_temperature : null,
      humidity: typeof det.relative_humidity === 'number' ? det.relative_humidity : null,
      pressure: typeof det.air_pressure_at_sea_level === 'number' ? det.air_pressure_at_sea_level : null,
      windMs: typeof det.wind_speed === 'number' ? det.wind_speed : null,
      symbol: (next1.summary && next1.summary.symbol_code) || '',
      issued: (data.properties.meta && data.properties.meta.updated_at) || '',
      time: best.time
    };
  }

  /* --- Google Weather API — only when the visitor supplies a key ----------- */
  function buildGoogleUrl(lat, lon, key) {
    return (
      API.google +
      '?key=' + encodeURIComponent(key) +
      '&location.latitude=' + Number(lat).toFixed(4) +
      '&location.longitude=' + Number(lon).toFixed(4)
    );
  }

  async function fetchGoogle(lat, lon, key) {
    const data = await getJSON(buildGoogleUrl(lat, lon, key), 12000);
    const tempObj = data.temperature || data.currentTemperature || {};
    const degrees =
      typeof tempObj.degrees === 'number'
        ? tempObj.degrees
        : typeof tempObj.value === 'number'
          ? tempObj.value
          : null;
    const condition =
      (data.weatherCondition &&
        data.weatherCondition.description &&
        data.weatherCondition.description.text) || '';
    return {
      tempC: degrees,
      humidity: typeof data.relativeHumidity === 'number' ? data.relativeHumidity : null,
      condition: condition,
      isDay: typeof data.isDaytime === 'boolean' ? data.isDaytime : null
    };
  }

  /* ==========================================================================
     7. Formatting
     ========================================================================== */

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /** "2026-10-28T14:00" → "2 PM" (uses the location's own local hour) */
  function hourLabel(iso) {
    const hh = parseInt(String(iso).slice(11, 13), 10);
    if (isNaN(hh)) return '';
    const suffix = hh >= 12 ? 'PM' : 'AM';
    return (hh % 12 || 12) + ' ' + suffix;
  }

  /** "2026-10-28T06:12" → "6:12 AM" */
  function clockLabel(iso) {
    const hh = parseInt(String(iso).slice(11, 13), 10);
    const mm = String(iso).slice(14, 16);
    if (isNaN(hh)) return '–';
    const suffix = hh >= 12 ? 'PM' : 'AM';
    return (hh % 12 || 12) + ':' + (mm || '00') + ' ' + suffix;
  }

  /** "2026-10-28" → { day: 'Wed', date: 'Oct 28' } */
  function dateParts(isoDate) {
    const parts = String(isoDate).split('-').map(Number);
    const d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    if (isNaN(d.getTime())) return { day: '', date: '' };
    return { day: WEEKDAYS[d.getDay()], date: MONTHS[d.getMonth()] + ' ' + d.getDate() };
  }

  function minutesOfDay(iso) {
    const hh = parseInt(String(iso).slice(11, 13), 10);
    const mm = parseInt(String(iso).slice(14, 16), 10);
    if (isNaN(hh)) return null;
    return hh * 60 + (isNaN(mm) ? 0 : mm);
  }

  function compass(deg) {
    if (typeof deg !== 'number' || !isFinite(deg)) return '–';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  /** Dew point via the Magnus formula. */
  function dewPoint(tempC, humidity) {
    if (typeof tempC !== 'number' || typeof humidity !== 'number' || humidity <= 0) return null;
    const a = 17.62;
    const b = 243.12;
    const gamma = Math.log(humidity / 100) + (a * tempC) / (b + tempC);
    return (b * gamma) / (a - gamma);
  }

  function agoLabel(ms) {
    if (!ms) return '';
    const secs = Math.round((Date.now() - ms) / 1000);
    if (secs < 45) return 'just now';
    if (secs < 90) return '1 min ago';
    const mins = Math.round(secs / 60);
    if (mins < 60) return mins + ' min ago';
    const hours = Math.round(mins / 60);
    return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  }

  /* ==========================================================================
     8. Status bar
     ========================================================================== */

  let statusTimer = null;

  function setStatus(message, kind) {
    const bar = $('statusBar');
    const text = $('statusText');
    const spin = $('statusSpinner');
    const retry = $('retryBtn');

    if (!message) {
      bar.hidden = true;
      return;
    }

    bar.hidden = false;
    bar.className = 'status' + (kind ? ' status--' + kind : '');
    text.textContent = message;
    spin.hidden = kind !== 'loading';
    retry.hidden = kind !== 'error';

    if (statusTimer) clearTimeout(statusTimer);
    if (kind === 'ok') {
      statusTimer = setTimeout(() => {
        bar.hidden = true;
      }, 2600);
    }
  }

  function setBusy(isBusy) {
    state.busy = isBusy;
    $('searchBtn').disabled = isBusy;
    $('geoBtn').disabled = isBusy;
    $('refreshBtn').classList.toggle('is-spinning', isBusy);
  }

  /* ==========================================================================
     9. Rendering — current conditions
     ========================================================================== */

  function renderCurrent() {
    const data = state.forecast;
    const place = state.place;
    if (!data || !place) return;

    const cur = data.current;
    const daily = data.daily || {};
    const info = describeCode(cur.weather_code, cur.is_day);

    $('placeName').textContent = place.name;
    $('placeSub').textContent = [place.admin1, place.country]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(', ');

    $('placeCoords').textContent =
      Number(place.latitude).toFixed(2) + '°, ' + Number(place.longitude).toFixed(2) + '° · ' +
      (place.timezone || data.timezone || '');

    $('currentIcon').innerHTML = svgIcon(info.icon, 96);
    $('currentTemp').textContent = t(cur.temperature_2m);
    $('currentUnitLabel').textContent = unitSymbol();
    $('currentCondition').textContent = info.label;
    $('feelsLike').textContent = t(cur.apparent_temperature) + '°';

    const hi = daily.temperature_2m_max ? daily.temperature_2m_max[0] : null;
    const lo = daily.temperature_2m_min ? daily.temperature_2m_min[0] : null;
    $('hiTemp').textContent = hi === null ? '–' : t(hi) + '°';
    $('loTemp').textContent = lo === null ? '–' : t(lo) + '°';

    $('updatedAgo').textContent = agoLabel(state.updatedAt);

    /* quick stats */
    $('qHumidity').textContent = Math.round(cur.relative_humidity_2m) + '%';
    $('qWind').textContent = spd(cur.wind_speed_10m) + ' ' + speedUnit();

    const idx = currentHourIndex();
    const rainNow =
      data.hourly && data.hourly.precipitation_probability
        ? data.hourly.precipitation_probability[idx]
        : null;
    $('qRain').textContent =
      typeof rainNow === 'number' ? Math.round(rainNow) + '%' : '–';

    const aqi = state.air && state.air.current ? state.air.current.us_aqi : null;
    $('qAqi').textContent =
      typeof aqi === 'number' ? Math.round(aqi) + ' · ' + aqiBand(aqi).label.split(' ')[0] : 'n/a';

    /* save (star) button state */
    const saved = isSaved(place);
    const btn = $('saveBtn');
    btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
    btn.setAttribute('aria-label', saved ? 'Remove this city from saved' : 'Save this city');

    /* dashboard visible */
    $('skeleton').hidden = true;
    $('dashboard').hidden = false;
  }

  /* ==========================================================================
     10. Rendering — air quality
     ========================================================================== */

  const POLLUTANTS = [
    { key: 'pm2_5', label: 'PM2.5', unit: 'µg/m³' },
    { key: 'pm10', label: 'PM10', unit: 'µg/m³' },
    { key: 'ozone', label: 'O₃', unit: 'µg/m³' },
    { key: 'nitrogen_dioxide', label: 'NO₂', unit: 'µg/m³' },
    { key: 'sulphur_dioxide', label: 'SO₂', unit: 'µg/m³' },
    { key: 'carbon_monoxide', label: 'CO', unit: 'µg/m³' }
  ];

  function renderAir() {
    const card = $('aqiCard');
    const cur = state.air && state.air.current ? state.air.current : null;
    const aqi = cur ? cur.us_aqi : null;

    if (typeof aqi !== 'number' || !isFinite(aqi)) {
      $('aqiValue').textContent = '–';
      $('aqiLabel').textContent = 'Air quality unavailable';
      $('aqiAdvice').textContent = state.airError
        ? 'The air quality service could not be reached. Everything else still works.'
        : 'No air quality reading for this location right now.';
      $('aqiBadge').textContent = 'offline';
      $('aqiBadge').style.color = '';
      $('aqiFill').style.width = '0%';
      $('aqiNeedle').style.left = '0%';
      $('pollutants').innerHTML = '';
      $('aqiCard').style.setProperty('--aqi', '#94a3b8');
      return;
    }

    const band = aqiBand(aqi);
    $('aqiValue').textContent = Math.round(aqi);
    $('aqiValue').style.color = band.color;
    $('aqiLabel').textContent = band.label;
    $('aqiAdvice').textContent = band.advice;
    $('aqiBadge').textContent = 'US AQI';
    $('aqiBadge').style.color = band.color;

    const pct = clamp((aqi / 300) * 100, 2, 100);
    $('aqiFill').style.width = pct + '%';
    $('aqiNeedle').style.left = pct + '%';

    $('pollutants').innerHTML = POLLUTANTS.map(function (p) {
      const v = cur[p.key];
      const shown = typeof v === 'number' && isFinite(v) ? (v < 10 ? v.toFixed(1) : Math.round(v)) : '–';
      return (
        '<li class="pollutant">' +
          '<span class="pollutant__name">' + p.label + '</span>' +
          '<span class="pollutant__value">' + shown + ' <span class="pollutant__unit">' + p.unit + '</span></span>' +
        '</li>'
      );
    }).join('');

    card.setAttribute('data-band', band.label);
  }

  /* ==========================================================================
     11. Rendering — sun arc & UV
     ========================================================================== */

  function renderSun() {
    const data = state.forecast;
    if (!data || !data.daily) return;
    const daily = data.daily;
    const sunrise = daily.sunrise ? daily.sunrise[0] : null;
    const sunset = daily.sunset ? daily.sunset[0] : null;

    $('sunriseTime').textContent = sunrise ? clockLabel(sunrise) : '–';
    $('sunsetTime').textContent = sunset ? clockLabel(sunset) : '–';

    const riseMin = sunrise ? minutesOfDay(sunrise) : null;
    const setMin = sunset ? minutesOfDay(sunset) : null;

    if (riseMin !== null && setMin !== null) {
      const span = Math.max(setMin - riseMin, 1);
      const hrs = Math.floor(span / 60);
      const mins = span % 60;
      $('daylightLen').textContent = hrs + 'h ' + (mins < 10 ? '0' + mins : mins) + 'm';

      const nowMin = minutesOfDay(data.current.time);
      const progress = nowMin === null ? 0 : clamp((nowMin - riseMin) / span, 0, 1);
      placeSun(progress);
    } else {
      $('daylightLen').textContent = '–';
      placeSun(0);
    }

    const uv = daily.uv_index_max ? daily.uv_index_max[0] : null;
    if (typeof uv === 'number' && isFinite(uv)) {
      const band = uvBand(uv);
      $('uvBadge').textContent = 'UV ' + Math.round(uv) + ' · ' + band.label;
      $('uvBadge').style.color = uv >= 8 ? '#f59e0b' : '';
    } else {
      $('uvBadge').textContent = 'UV –';
    }
  }

  function placeSun(progress) {
    const dot = $('sunDot');
    const path = $('sunPath');
    const theta = Math.PI - Math.PI * progress;
    const cx = 100 + 92 * Math.cos(theta);
    const cy = 100 - 92 * Math.sin(theta);
    if (dot) {
      dot.setAttribute('cx', cx.toFixed(1));
      dot.setAttribute('cy', cy.toFixed(1));
    }
    if (path) {
      const arc = Math.PI * 92;
      path.setAttribute('stroke-dasharray', (arc * progress).toFixed(1) + ' 1000');
    }
  }

  /* ==========================================================================
     12. Rendering — hourly
     ========================================================================== */

  function currentHourIndex() {
    const data = state.forecast;
    if (!data || !data.hourly || !data.hourly.time) return 0;
    const nowIso = String(data.current.time).slice(0, 13);
    const times = data.hourly.time;
    for (let i = 0; i < times.length; i++) {
      if (String(times[i]).slice(0, 13) >= nowIso) return i;
    }
    return 0;
  }

  function hourlySlice() {
    const data = state.forecast;
    if (!data || !data.hourly) return [];
    const h = data.hourly;
    const start = currentHourIndex();
    const out = [];
    for (let i = start; i < Math.min(start + 24, h.time.length); i++) {
      out.push({
        time: h.time[i],
        temp: h.temperature_2m[i],
        code: h.weather_code[i],
        rain: h.precipitation_probability ? h.precipitation_probability[i] : null,
        isDay: h.is_day ? h.is_day[i] : 1,
        index: i
      });
    }
    return out;
  }

  function renderHourly() {
    const hours = hourlySlice();
    if (!hours.length) return;

    /* ---- chart ---- */
    const W = 1000;
    const H = 100;
    const padY = 16;
    const temps = hours.map((h) => (typeof h.temp === 'number' ? h.temp : 0));
    const min = Math.min.apply(null, temps);
    const max = Math.max.apply(null, temps);
    const range = Math.max(max - min, 1);
    const xAt = (i) => (i / Math.max(hours.length - 1, 1)) * W;
    const yAt = (v) => H - padY - ((v - min) / range) * (H - padY * 2);

    let line = '';
    hours.forEach(function (h, i) {
      line += (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ' ' + yAt(h.temp).toFixed(1) + ' ';
    });

    const area = line + 'L' + W + ' ' + H + ' L0 ' + H + ' Z';
    const dots = hours.map(function (h, i) {
      return '<circle cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(h.temp).toFixed(1) +
        '" r="2.6" fill="#00e5ff" opacity="' + (i % 3 === 0 ? '.95' : '.45') + '" />';
    }).join('');

    $('hourlyChart').innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#00e5ff" stop-opacity=".34" />' +
            '<stop offset="1" stop-color="#1d4ed8" stop-opacity="0" />' +
          '</linearGradient>' +
        '</defs>' +
        '<path d="' + area + '" fill="url(#chartFill)" />' +
        '<path d="' + line + '" fill="none" stroke="#38bdf8" stroke-width="2.4" ' +
          'stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />' +
        dots +
      '</svg>';

    /* ---- strip ---- */
    $('hourlyStrip').innerHTML = hours.map(function (h, i) {
      const info = describeCode(h.code, h.isDay);
      const rain = typeof h.rain === 'number' ? Math.round(h.rain) : null;
      return (
        '<div class="hour' + (i === 0 ? ' hour--now' : '') + '">' +
          '<div class="hour__time">' + (i === 0 ? 'Now' : esc(hourLabel(h.time))) + '</div>' +
          '<div class="hour__icon">' + svgIcon(info.icon, 26) + '</div>' +
          '<div class="hour__temp">' + t(h.temp) + '°</div>' +
          '<div class="hour__rain' + (rain && rain > 0 ? '' : ' hour__rain--dry') + '">' +
            (rain === null ? '–' : rain + '%') +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  /* ==========================================================================
     13. Rendering — 7-day forecast
     ========================================================================== */

  function renderDaily() {
    const data = state.forecast;
    if (!data || !data.daily) return;
    const d = data.daily;
    const n = d.time.length;

    let weekMin = Infinity;
    let weekMax = -Infinity;
    for (let i = 0; i < n; i++) {
      if (typeof d.temperature_2m_min[i] === 'number') weekMin = Math.min(weekMin, d.temperature_2m_min[i]);
      if (typeof d.temperature_2m_max[i] === 'number') weekMax = Math.max(weekMax, d.temperature_2m_max[i]);
    }
    if (!isFinite(weekMin) || !isFinite(weekMax)) {
      weekMin = 0;
      weekMax = 1;
    }
    const span = Math.max(weekMax - weekMin, 1);

    let html = '';
    for (let i = 0; i < n; i++) {
      const info = describeCode(d.weather_code[i], 1);
      const parts = dateParts(d.time[i]);
      const name = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : parts.day;
      const lo = d.temperature_2m_min[i];
      const hi = d.temperature_2m_max[i];
      const leftPct = clamp(((lo - weekMin) / span) * 100, 0, 100);
      const widthPct = clamp(((hi - lo) / span) * 100, 4, 100);
      const rain = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
      const rainTxt =
        typeof rain === 'number' && rain >= 10 ? Math.round(rain) + '% chance of rain' : '';

      html +=
        '<li class="day">' +
          '<div>' +
            '<span class="day__name">' + esc(name) + '</span>' +
            '<span class="day__date">' + esc(parts.date) + '</span>' +
          '</div>' +
          '<div class="day__icon">' + svgIcon(info.icon, 24) + '</div>' +
          '<div class="day__bar" role="img" aria-label="' +
            esc('Low ' + t(lo) + ' degrees, high ' + t(hi) + ' degrees') + '">' +
            '<span style="left:' + leftPct.toFixed(1) + '%;width:' + widthPct.toFixed(1) + '%"></span>' +
          '</div>' +
          '<div class="day__temps">' +
            '<span class="day__hi">' + t(hi) + '°</span>' +
            '<span class="day__lo">' + t(lo) + '°</span>' +
          '</div>' +
          (rainTxt ? '<div class="day__rain">' + esc(rainTxt) + '</div>' : '') +
        '</li>';
    }

    $('dailyList').innerHTML = html;
  }

  /* ==========================================================================
     14. Rendering — detail grid
     ========================================================================== */

  function meter(pct) {
    return '<span class="detail__meter"><span style="width:' +
      clamp(pct, 0, 100).toFixed(1) + '%"></span></span>';
  }

  function renderDetails() {
    const data = state.forecast;
    if (!data) return;
    const cur = data.current;
    const daily = data.daily || {};
    const hours = data.hourly || {};
    const idx = currentHourIndex();

    const humidity = cur.relative_humidity_2m;
    const dp = dewPoint(cur.temperature_2m, humidity);
    const vis = hours.visibility ? hours.visibility[idx] : null;
    const uv = daily.uv_index_max ? daily.uv_index_max[0] : null;
    const uvInfo = typeof uv === 'number' ? uvBand(uv) : null;
    const precipToday = daily.precipitation_sum ? daily.precipitation_sum[0] : null;
    const windDir = cur.wind_direction_10m;

    const items = [
      {
        label: 'Humidity',
        value: Math.round(humidity) + '%',
        note: humidity > 70 ? 'Muggy' : humidity < 30 ? 'Dry air' : 'Comfortable',
        extra: meter(humidity)
      },
      {
        label: 'Dew point',
        value: dp === null ? '–' : t(dp) + '°',
        note: dp === null ? '' : dp >= 20 ? 'Sticky' : dp >= 13 ? 'Pleasant' : 'Crisp'
      },
      {
        label: 'Wind',
        value: spd(cur.wind_speed_10m) + ' ' + speedUnit(),
        note: 'from ' + compass(windDir) + ' (' + Math.round(windDir || 0) + '°)',
        arrow: windDir
      },
      {
        label: 'Wind gusts',
        value: spd(cur.wind_gusts_10m) + ' ' + speedUnit(),
        note: cur.wind_gusts_10m >= 40 ? 'Strong gusts' : 'Manageable'
      },
      {
        label: 'Pressure',
        value: Math.round(cur.pressure_msl) + ' hPa',
        note: cur.pressure_msl >= 1013 ? 'High — settled' : 'Low — unsettled'
      },
      {
        label: 'Visibility',
        value: dist(vis),
        note: vis === null ? '' : vis >= 10000 ? 'Clear view' : vis >= 4000 ? 'Moderate haze' : 'Poor visibility'
      },
      {
        label: 'Cloud cover',
        value: Math.round(cur.cloud_cover) + '%',
        note: cur.cloud_cover > 80 ? 'Overcast' : cur.cloud_cover > 35 ? 'Partly cloudy' : 'Mostly clear',
        extra: meter(cur.cloud_cover)
      },
      {
        label: 'UV index (max)',
        value: typeof uv === 'number' ? Math.round(uv) : '–',
        note: uvInfo ? uvInfo.label + ' · ' + uvInfo.advice : '',
        extra: meter(typeof uv === 'number' ? (uv / 11) * 100 : 0)
      },
      {
        label: 'Rain today',
        value: typeof precipToday === 'number' ? precipToday.toFixed(1) + ' mm' : '–',
        note: (function () {
          const p = daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : null;
          return typeof p === 'number' ? Math.round(p) + '% max chance' : '';
        })()
      },
      {
        label: 'Precipitation now',
        value: (typeof cur.precipitation === 'number' ? cur.precipitation.toFixed(1) : '0.0') + ' mm',
        note: cur.precipitation > 0 ? 'Falling right now' : 'Nothing falling'
      }
    ];

    $('detailsGrid').innerHTML = items.map(function (it) {
      return (
        '<li class="detail">' +
          '<span class="detail__label">' + esc(it.label) + '</span>' +
          '<span class="detail__value">' +
            esc(it.value) +
            (typeof it.arrow === 'number'
              ? '<span class="detail__arrow" style="transform:rotate(' + Math.round(it.arrow) + 'deg)">' +
                  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" ' +
                  'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                  '<path d="M12 20V5M6 11l6-6 6 6"/></svg></span>'
              : '') +
          '</span>' +
          (it.note ? '<span class="detail__note">' + esc(it.note) + '</span>' : '') +
          (it.extra || '') +
        '</li>'
      );
    }).join('');
  }

  /* ==========================================================================
     15. Rendering — saved city chips
     ========================================================================== */

  function placeKey(p) {
    return (p.name || '') + '|' + Number(p.latitude).toFixed(2) + ',' + Number(p.longitude).toFixed(2);
  }

  function isSaved(p) {
    if (!p) return false;
    const key = placeKey(p);
    return state.saved.some((s) => placeKey(s) === key);
  }

  function renderSaved() {
    const wrap = $('savedWrap');
    const chips = $('savedChips');
    if (!state.saved.length) {
      wrap.hidden = true;
      chips.innerHTML = '';
      return;
    }
    wrap.hidden = false;
    chips.innerHTML = state.saved.map(function (p, i) {
      return (
        '<span class="chip" data-index="' + i + '" role="button" tabindex="0">' +
          esc(p.name) +
          '<button class="chip__x" type="button" data-remove="' + i + '" ' +
            'aria-label="Remove ' + esc(p.name) + '">×</button>' +
        '</span>'
      );
    }).join('');
  }

  function toggleSave() {
    if (!state.place) return;
    const key = placeKey(state.place);
    const at = state.saved.findIndex((s) => placeKey(s) === key);
    if (at >= 0) {
      state.saved.splice(at, 1);
    } else {
      state.saved.unshift({
        name: state.place.name,
        admin1: state.place.admin1 || '',
        country: state.place.country || '',
        country_code: state.place.country_code || '',
        latitude: state.place.latitude,
        longitude: state.place.longitude,
        timezone: state.place.timezone || ''
      });
      state.saved = state.saved.slice(0, 8);
    }
    writeStore(STORE.saved, state.saved);
    renderSaved();
    renderCurrent();
  }

  /* ==========================================================================
     15b. Rendering — live source cross-check
     ========================================================================== */

  function renderSources() {
    const strip = $('sourcesStrip');
    if (!strip) return;

    const primary = state.forecast ? state.forecast.current.temperature_2m : null;
    const parts = [];

    function chip(name, value, note, cls) {
      return (
        '<span class="source source--' + cls + '">' +
          '<span class="source__dot" aria-hidden="true"></span>' +
          '<span class="source__name">' + esc(name) + '</span>' +
          '<span class="source__value">' + esc(value) + '</span>' +
          (note ? '<span class="source__delta">' + esc(note) + '</span>' : '') +
        '</span>'
      );
    }

    function agreement(reading) {
      if (typeof primary !== 'number' || typeof reading !== 'number') return '';
      const diff = reading - primary;
      if (Math.abs(diff) < 0.15) return 'agrees';
      return (diff > 0 ? '+' : '') + diff.toFixed(1) + '°';
    }

    function within(reading) {
      return typeof primary !== 'number' || typeof reading !== 'number'
        ? 'ok'
        : Math.abs(reading - primary) <= 1.5
          ? 'ok'
          : 'warn';
    }

    parts.push(
      typeof primary === 'number'
        ? chip('Open-Meteo', t(primary) + '°', 'primary', 'ok')
        : chip('Open-Meteo', 'no reading', '', 'off')
    );

    const met = state.sources.metNo;
    if (met && typeof met.tempC === 'number') {
      parts.push(chip('MET Norway', t(met.tempC) + '°', agreement(met.tempC), within(met.tempC)));
    } else {
      parts.push(chip('MET Norway', 'unreachable', '', 'off'));
    }

    const g = state.sources.google;
    if (!state.googleKey) {
      parts.push(chip('Google Weather', 'add key in settings', '', 'muted'));
    } else if (g && typeof g.tempC === 'number') {
      parts.push(chip('Google', t(g.tempC) + '°', agreement(g.tempC), within(g.tempC)));
    } else {
      parts.push(chip('Google', state.sources.googleError ? 'key rejected' : 'no reading', '', 'off'));
    }

    strip.innerHTML = parts.join('');
  }

  /* ==========================================================================
     15c. Rendering — 15-minute rain nowcast
     ========================================================================== */

  function renderNowcast() {
    const card = $('nowcastCard');
    if (!card) return;

    const m = state.forecast ? state.forecast.minutely_15 : null;
    if (!m || !Array.isArray(m.time) || !m.time.length) {
      card.hidden = true;
      return;
    }
    card.hidden = false;

    const precip = m.precipitation || [];
    const prob = m.precipitation_probability || [];
    const n = m.time.length;
    const maxP = Math.max.apply(null, precip.concat([0.15]));

    function wet(i) {
      const amount = typeof precip[i] === 'number' ? precip[i] : 0;
      const chance = typeof prob[i] === 'number' ? prob[i] : 0;
      return amount > 0.02 || chance >= 60;
    }

    let headline = '';
    let accent = false;

    if (wet(0)) {
      let stopAt = -1;
      for (let i = 1; i < n; i++) {
        if (!wet(i)) {
          stopAt = i;
          break;
        }
      }
      headline = stopAt === -1
        ? 'Rain continuing for at least the next 2 hours.'
        : 'Rain easing in about ' + stopAt * 15 + ' min.';
      accent = true;
    } else {
      let startAt = -1;
      for (let i = 0; i < n; i++) {
        if (wet(i)) {
          startAt = i;
          break;
        }
      }
      if (startAt === -1) {
        headline = 'No rain expected in the next 2 hours.';
      } else if (startAt === 1) {
        headline = 'Rain likely within 15 min.';
        accent = true;
      } else {
        headline = 'Rain likely in about ' + startAt * 15 + ' min.';
        accent = true;
      }
    }

    $('nowcastHeadline').innerHTML = accent
      ? '<span class="accent">' + esc(headline) + '</span>'
      : esc(headline);

    let bars = '';
    for (let i = 0; i < n; i++) {
      const amount = typeof precip[i] === 'number' ? precip[i] : 0;
      const height = amount <= 0.02 ? 6 : Math.max(12, (amount / maxP) * 100);
      const label = String(m.time[i]).slice(11, 16);
      bars +=
        '<div class="nbar">' +
          '<span class="nbar__fill' + (amount <= 0.02 ? ' nbar__fill--dry' : '') +
            '" style="height:' + height.toFixed(0) + '%"></span>' +
          '<span class="nbar__label">' + esc(label) + '</span>' +
        '</div>';
    }
    $('nowcastBars').innerHTML = bars;

    const totalMm = precip.reduce(function (sum, v) {
      return sum + (typeof v === 'number' ? v : 0);
    }, 0);
    const peakProb = prob.length ? Math.max.apply(null, prob) : null;

    $('nowcastMeta').textContent =
      'Total ' + totalMm.toFixed(1) + ' mm expected' +
      (peakProb !== null && isFinite(peakProb)
        ? ' · peak chance ' + Math.round(peakProb) + '%'
        : '') +
      ' · 15-minute resolution';
  }

  /* ==========================================================================
     16. Render everything
     ========================================================================== */

  function renderAll() {
    renderCurrent();
    renderSources();
    renderNowcast();
    renderAir();
    renderSun();
    renderHourly();
    renderDaily();
    renderDetails();
    renderSaved();
    updateUrl();
  }

  /* ==========================================================================
     17. Loading pipeline
     ========================================================================== */

  function showSkeleton() {
    $('skeleton').hidden = false;
    $('dashboard').hidden = true;
  }

  async function loadPlace(place, opts) {
    const options = opts || {};
    state.lastAction = () => loadPlace(place, options);

    if (!place || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') {
      setStatus('That location could not be read. Try searching again.', 'error');
      return;
    }

    state.place = place;
    setBusy(true);
    setStatus('Fetching live weather for ' + place.name + '…', 'loading');
    if (!state.forecast) showSkeleton();

    try {
      const forecast = await getJSON(buildForecastUrl(place.latitude, place.longitude));
      if (!forecast || !forecast.current || !forecast.daily) {
        throw new Error('Incomplete weather data came back. Please try another place.');
      }
      state.forecast = forecast;
      state.updatedAt = Date.now();
      state.airError = false;

      /* Secondary sources — each may fail on its own without breaking the page. */
      const airTask = getJSON(buildAirUrl(place.latitude, place.longitude), 12000)
        .then(function (air) {
          return air && air.current ? air : null;
        })
        .catch(function () {
          return null;
        });

      const metTask = fetchMetNo(place.latitude, place.longitude).catch(function () {
        return null;
      });

      const googleTask = state.googleKey
        ? fetchGoogle(place.latitude, place.longitude, state.googleKey).catch(function (e) {
            return { error: (e && e.message) || 'Google request failed' };
          })
        : Promise.resolve(null);

      const secondary = await Promise.all([airTask, metTask, googleTask]);

      state.air = secondary[0];
      state.airError = !state.air;
      state.sources.metNo = secondary[1];

      const googleResult = secondary[2];
      state.sources.google = googleResult && !googleResult.error ? googleResult : null;
      state.sources.googleError = googleResult && googleResult.error ? googleResult.error : '';

      if (state.googleKey) {
        setGoogleStatus(
          state.sources.google
            ? 'Connected — Google is confirming this reading.'
            : 'Google returned no reading: ' + (state.sources.googleError || 'unknown error'),
          state.sources.google ? 'ok' : 'bad'
        );
      }

      renderAll();
      writeStore(STORE.last, place);
      setStatus('Updated · ' + place.name, 'ok');
    } catch (err) {
      $('skeleton').hidden = true;
      setStatus(
        (err && err.message) || 'Something went wrong while loading the weather.',
        'error'
      );
      if (!state.forecast) $('dashboard').hidden = true;
    } finally {
      setBusy(false);
    }
  }

  async function loadByQuery(query) {
    const q = String(query || '').trim();
    if (!q) {
      setStatus('Type a city name first — for example “Pune” or “Osaka”.', 'error');
      $('searchInput').focus();
      return;
    }

    state.lastAction = () => loadByQuery(q);
    hideSuggestions();
    setBusy(true);
    setStatus('Searching for “' + q + '”…', 'loading');
    if (!state.forecast) showSkeleton();

    try {
      const results = await searchPlaces(q);
      if (!results.length) {
        $('skeleton').hidden = true;
        setStatus('No city matched “' + q + '”. Check the spelling and try again.', 'error');
        setBusy(false);
        return;
      }
      const best = results[0];
      const place = {
        name: best.name,
        admin1: best.admin1 || '',
        country: best.country || '',
        country_code: best.country_code || '',
        latitude: best.latitude,
        longitude: best.longitude,
        timezone: best.timezone || ''
      };
      await loadPlace(place);
    } catch (err) {
      $('skeleton').hidden = true;
      setStatus((err && err.message) || 'Search failed. Please try again.', 'error');
      setBusy(false);
    }
  }

  function loadMyLocation() {
    if (!navigator.geolocation) {
      setStatus('This browser does not support location sharing. Search for a city instead.', 'error');
      return;
    }

    state.lastAction = loadMyLocation;
    setStatus('Asking your browser for your location…', 'loading');
    setBusy(true);

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        loadPlace({
          name: 'My location',
          admin1: '',
          country: '',
          country_code: '',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timezone: ''
        });
      },
      function (err) {
        setBusy(false);
        const msg =
          err && err.code === 1
            ? 'Location permission was blocked. Search for your city instead.'
            : 'Could not get your location. Search for your city instead.';
        setStatus(msg, 'error');
      },
      { timeout: 12000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false }
    );
  }

  /* ==========================================================================
     18. Search suggestions
     ========================================================================== */

  let suggestTimer = null;
  let suggestItems = [];
  let suggestActive = -1;

  function hideSuggestions() {
    const box = $('suggestions');
    box.hidden = true;
    box.innerHTML = '';
    suggestItems = [];
    suggestActive = -1;
    $('searchInput').setAttribute('aria-expanded', 'false');
  }

  function renderSuggestions(results) {
    const box = $('suggestions');
    suggestItems = results;
    suggestActive = -1;

    if (!results.length) {
      hideSuggestions();
      return;
    }

    box.innerHTML = results.map(function (r, i) {
      const meta = [r.admin1, r.country].filter(Boolean).join(', ');
      return (
        '<li role="option" aria-selected="false" data-index="' + i + '">' +
          '<button class="suggestion" type="button" data-index="' + i + '">' +
            '<span class="suggestion__flag">' + flagOf(r.country_code) + '</span>' +
            '<span class="suggestion__body">' +
              '<span class="suggestion__name">' + esc(r.name) + '</span>' +
              '<span class="suggestion__meta">' + esc(meta) + '</span>' +
            '</span>' +
          '</button>' +
        '</li>'
      );
    }).join('');

    box.hidden = false;
    $('searchInput').setAttribute('aria-expanded', 'true');
  }

  function highlightSuggestion(dir) {
    const box = $('suggestions');
    const nodes = box.querySelectorAll('[role="option"]');
    if (!nodes.length) return;
    suggestActive = (suggestActive + dir + nodes.length) % nodes.length;
    for (let i = 0; i < nodes.length; i++) {
      const on = i === suggestActive;
      nodes[i].setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) {
        nodes[i].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function chooseSuggestion(index) {
    const r = suggestItems[index];
    if (!r) return;
    $('searchInput').value = r.name;
    hideSuggestions();
    loadPlace({
      name: r.name,
      admin1: r.admin1 || '',
      country: r.country || '',
      country_code: r.country_code || '',
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone || ''
    });
  }

  function queueSuggestions(value) {
    const q = String(value || '').trim();
    if (suggestTimer) clearTimeout(suggestTimer);
    if (q.length < 2) {
      hideSuggestions();
      return;
    }
    suggestTimer = setTimeout(async function () {
      try {
        const results = await searchPlaces(q);
        /* Ignore stale responses for text the user has already changed. */
        if ($('searchInput').value.trim() !== q) return;
        renderSuggestions(results.slice(0, 6));
      } catch (err) {
        hideSuggestions();
      }
    }, 280);
  }

  /* ==========================================================================
     19. URL sync (shareable links)
     ========================================================================== */

  function updateUrl() {
    if (!state.place || !window.history || !window.history.replaceState) return;
    try {
      const p = state.place;
      const params = new URLSearchParams();
      params.set('city', p.name);
      params.set('lat', Number(p.latitude).toFixed(3));
      params.set('lon', Number(p.longitude).toFixed(3));
      if (p.country) params.set('country', p.country);
      window.history.replaceState(null, '', '?' + params.toString());
    } catch (err) {
      /* file:// or sandboxed contexts may refuse — harmless */
    }
  }

  function placeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get('lat'));
    const lon = parseFloat(params.get('lon'));
    const city = params.get('city');
    if (city && isFinite(lat) && isFinite(lon)) {
      return {
        name: city,
        admin1: '',
        country: params.get('country') || '',
        country_code: '',
        latitude: lat,
        longitude: lon,
        timezone: ''
      };
    }
    return null;
  }

  /* ==========================================================================
     20. Theme & units
     ========================================================================== */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    $('themeToggle').setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    );
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#050b1a' : '#f2f9ff');
  }

  function initTheme() {
    const saved = readStore(STORE.theme, null);
    if (saved === 'dark' || saved === 'light') {
      applyTheme(saved);
      return;
    }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  function applyUnitUi() {
    $('unitLabel').textContent = unitSymbol();
    $('unitToggle').setAttribute(
      'aria-label',
      'Switch temperature unit to ' + (state.unit === 'c' ? 'Fahrenheit' : 'Celsius')
    );
  }

  function setGoogleStatus(message, kind) {
    const el = $('googleKeyStatus');
    if (!el) return;
    el.textContent = message;
    el.className = 'settings__hint' + (kind ? ' settings__hint--' + kind : '');
  }

  function initGoogle() {
    if (state.googleKey) {
      $('googleKeyInput').value = state.googleKey;
      setGoogleStatus('Key saved in this browser. Google will be used as a cross-check.');
    } else {
      setGoogleStatus('Not configured — the app works fully without it.');
    }
  }

  /* ==========================================================================
     21. Events
     ========================================================================== */

  function bindEvents() {
    /* search form */
    $('searchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (state.busy) return;
      loadByQuery($('searchInput').value);
    });

    const input = $('searchInput');

    input.addEventListener('input', function () {
      $('clearBtn').hidden = !input.value;
      queueSuggestions(input.value);
    });

    input.addEventListener('keydown', function (e) {
      const box = $('suggestions');
      if (box.hidden) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightSuggestion(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightSuggestion(-1);
      } else if (e.key === 'Enter' && suggestActive >= 0) {
        e.preventDefault();
        chooseSuggestion(suggestActive);
      } else if (e.key === 'Escape') {
        hideSuggestions();
      }
    });

    input.addEventListener('blur', function () {
      setTimeout(hideSuggestions, 160);
    });

    $('suggestions').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-index]');
      if (!btn) return;
      chooseSuggestion(parseInt(btn.getAttribute('data-index'), 10));
    });

    $('clearBtn').addEventListener('click', function () {
      input.value = '';
      $('clearBtn').hidden = true;
      hideSuggestions();
      input.focus();
    });

    /* geo + refresh */
    $('geoBtn').addEventListener('click', loadMyLocation);
    $('refreshBtn').addEventListener('click', function () {
      if (state.busy || !state.place) return;
      loadPlace(state.place, { silent: true });
    });

    /* retry */
    $('retryBtn').addEventListener('click', function () {
      if (typeof state.lastAction === 'function') state.lastAction();
    });

    /* save city */
    $('saveBtn').addEventListener('click', toggleSave);

    /* saved chips */
    $('savedChips').addEventListener('click', function (e) {
      const removeBtn = e.target.closest('[data-remove]');
      if (removeBtn) {
        e.stopPropagation();
        const i = parseInt(removeBtn.getAttribute('data-remove'), 10);
        state.saved.splice(i, 1);
        writeStore(STORE.saved, state.saved);
        renderSaved();
        renderCurrent();
        return;
      }
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const place = state.saved[parseInt(chip.getAttribute('data-index'), 10)];
      if (place) loadPlace(place);
    });

    $('savedChips').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const chip = e.target.closest('.chip');
      if (!chip || e.target.closest('[data-remove]')) return;
      e.preventDefault();
      const place = state.saved[parseInt(chip.getAttribute('data-index'), 10)];
      if (place) loadPlace(place);
    });

    /* settings panel + optional Google key */
    $('settingsBtn').addEventListener('click', function () {
      const panel = $('settingsPanel');
      const opening = panel.hidden;
      panel.hidden = !opening;
      $('settingsBtn').setAttribute('aria-expanded', opening ? 'true' : 'false');
      if (opening) $('googleKeyInput').focus();
    });

    $('googleKeySave').addEventListener('click', function () {
      const key = $('googleKeyInput').value.trim();
      if (!key) {
        setGoogleStatus('Paste a key first.', 'bad');
        return;
      }
      state.googleKey = key;
      writeStore(STORE.googleKey, key);
      setGoogleStatus('Key saved in this browser. Testing it against Google now…');
      if (state.place) loadPlace(state.place);
    });

    $('googleKeyClear').addEventListener('click', function () {
      state.googleKey = '';
      state.sources.google = null;
      state.sources.googleError = '';
      try {
        localStorage.removeItem(STORE.googleKey);
      } catch (e) {
        /* ignore */
      }
      $('googleKeyInput').value = '';
      setGoogleStatus('Not configured — the app works fully without it.');
      if (state.forecast) renderSources();
    });

    /* theme + unit */
    $('themeToggle').addEventListener('click', function () {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      writeStore(STORE.theme, next);
    });

    $('unitToggle').addEventListener('click', function () {
      state.unit = state.unit === 'c' ? 'f' : 'c';
      writeStore(STORE.unit, state.unit);
      applyUnitUi();
      if (state.forecast) renderAll();
    });

    /* connectivity */
    window.addEventListener('online', function () {
      setStatus('Back online — refreshing.', 'loading');
      if (state.place) loadPlace(state.place);
    });

    window.addEventListener('offline', function () {
      setStatus('You are offline. Showing the last data that loaded.', 'error');
    });
  }

  /* ==========================================================================
     22. Boot
     ========================================================================== */

  function boot() {
    initTheme();
    applyUnitUi();
    initGoogle();
    bindEvents();
    renderSaved();

    $('year').textContent = String(new Date().getFullYear());
    $('searchInput').value = '';

    /* keep "updated x min ago" honest */
    setInterval(function () {
      if (state.updatedAt) $('updatedAgo').textContent = agoLabel(state.updatedAt);
    }, 30000);

    /* auto refresh */
    setInterval(function () {
      if (state.place && !state.busy && navigator.onLine !== false) {
        loadPlace(state.place);
      }
    }, REFRESH_MS);

    /* deep link → last used city → default city */
    const fromUrl = placeFromUrl();
    const last = readStore(STORE.last, null);

    if (fromUrl) {
      loadPlace(fromUrl);
    } else if (last && typeof last.latitude === 'number') {
      loadPlace(last);
    } else {
      loadPlace(DEFAULT_PLACE);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
