# Nimbus — Live Weather, Air Quality & 7-Day Forecast

A complete, production-ready weather dashboard built with **vanilla HTML5, CSS3 and JavaScript**.
No framework, no build step, no dependencies, no API key, no login, no payments.

**Live data only** — every number on the page comes from the free, open
[Open-Meteo](https://open-meteo.com/) APIs at request time. Nothing is mocked.

---

## What's in the box

| File | Purpose |
|------|---------|
| `index.html` | Semantic page structure, all sections and accessible markup |
| `style.css` | Hand-written design system (tokens, dark/light themes, responsive layout) |
| `script.js` | API calls, rendering, state, storage, error handling — no libraries |
| `README.md` | This file |

Three files, ~93 KB total, zero requests to any third-party script or font host.

---

## Features

**Weather**
- Current conditions: temperature, condition, feels-like, today's high/low
- Next 24 hours: SVG temperature curve with gradient fill + scrollable hourly cards (icon, temp, rain %)
- 7-day forecast with per-day min–max range bars scaled across the whole week
- Conditions in detail: humidity, dew point (computed via the Magnus formula), wind speed with
  compass direction and a rotating arrow, wind gusts, pressure, visibility, cloud cover,
  UV index max, rain today, current precipitation
- Sun & UV card: sunrise, sunset, day length, and a live semicircular sun arc

**Real-time rain nowcast**
- 15-minute resolution for the next 2 hours, with a plain-language headline
  ("Rain likely in about 30 min", "Rain easing in about 15 min") and a bar chart

**Multi-source verification**
- A live strip under the current temperature shows what each independent provider reports
  and how far apart they are (e.g. `MET Norway 26° +0.4°`), so you can see the reading is real
  and consistent rather than trusting one feed

**Air quality**
- US AQI with category colour and plain-language health advice
- Colour-gradient AQI scale with a needle marker
- PM2.5, PM10, O₃, NO₂, SO₂ and CO readings

**App behaviour**
- Debounced city autocomplete (keyboard navigable) + "My location" via the Geolocation API
- °C ↔ °F toggle — converts every temperature, wind speed and distance instantly, no refetch
- Dark / light theme, remembered and defaulting to your OS preference
- Saved cities in `localStorage`, shown as removable chips
- Last viewed city restored on your next visit
- Shareable links: `?city=Kolkata&lat=22.563&lon=88.363` opens straight to that city
- Auto-refresh every 10 minutes, with a "just now / 5 min ago" timestamp
- Loading skeleton + spinner; friendly errors with a Retry button; the AQI service failing
  never breaks the rest of the page
- Fully responsive, keyboard accessible, respects `prefers-reduced-motion`

---

## The APIs

| Purpose | Provider | Endpoint | Key needed |
|---------|----------|----------|------------|
| City search | Open-Meteo | `https://geocoding-api.open-meteo.com/v1/search` | No |
| Forecast + 15-min nowcast | Open-Meteo | `https://api.open-meteo.com/v1/forecast` | No |
| Air quality | Open-Meteo | `https://air-quality-api.open-meteo.com/v1/air-quality` | No |
| Cross-check | MET Norway (Norwegian Meteorological Institute) | `https://api.met.no/weatherapi/locationforecast/2.0/compact` | No |
| Optional cross-check | Google Weather API | `https://weather.googleapis.com/v1/currentConditions:lookup` | **Yes** |

All calls happen directly from the visitor's browser — there is no backend of your own.
Please check each provider's terms if you expect heavy traffic.

**Why Open-Meteo as the primary source?** It is free, needs no key, and blends several
national agency models (ECMWF, NOAA GFS, DWD ICON) rather than a single forecast. MET Norway
then provides an independent second opinion from a national meteorological service, which is
what the cross-check strip compares against.

### Adding Google Weather (optional)

The app is complete without Google. If you want Google's own reading in the cross-check:

1. In [Google Cloud Console](https://console.cloud.google.com/) create (or pick) a project and
   **enable billing** — Maps Platform requires it.
2. Enable the **Weather API** in *APIs & Services → Library*.
3. Create an API key in *APIs & Services → Credentials*.
4. Restrict the key: under *Application restrictions* choose **Websites (HTTP referrers)** and add
   your site, e.g. `https://<your-username>.github.io/nimbus-weather/*` and `http://localhost:8000/*`.
   Under *API restrictions*, allow only the **Weather API**.
5. Open the site, click the gear icon in the header, paste the key, and press **Save**.

The key is stored only in that browser's `localStorage` and is sent only to Google. Because it
is used client-side, anyone who inspects the browser can read it — the referrer restriction above
is what keeps it safe, so never skip step 4. Google Weather is a paid API; check current pricing.

---

## Run it locally

Because the page fetches from remote APIs, open it through a local server rather than
double-clicking the file (some browsers block `fetch` on `file://`).

```bash
# Python (already installed on macOS / Linux)
python3 -m http.server 8000

# or Node
npx serve .
```

Then visit <http://localhost:8000>.

---

## Deploy on GitHub Pages (free, 2 minutes)

1. Create a new repository on GitHub, e.g. `nimbus-weather`.
2. Upload `index.html`, `style.css`, `script.js` and `README.md` to the **root** of the repo
   (drag-and-drop in the browser works, or use git):

   ```bash
   git init
   git add index.html style.css script.js README.md
   git commit -m "Nimbus weather app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/nimbus-weather.git
   git push -u origin main
   ```

3. In the repo: **Settings → Pages → Build and deployment**
   → Source: **Deploy from a branch** → Branch: **main** → Folder: **/ (root)** → **Save**.
4. Wait ~1 minute. Your site is live at:

   ```
   https://<your-username>.github.io/nimbus-weather/
   ```

No configuration file is needed — it is a plain static site.

---

## Deploy on Vercel (free)

**Option A — dashboard**

1. Push the files to GitHub as above.
2. Go to <https://vercel.com/new>, import the repository.
3. Framework preset: **Other**. Build command: *leave empty*. Output directory: *leave empty*.
4. **Deploy**. You get a URL like `https://nimbus-weather.vercel.app`.

**Option B — CLI**

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

Vercel serves static files from the project root with no extra config, so the site works
exactly as it does on GitHub Pages.

**Option C — connect GitHub to Vercel (auto-deploy)**
Import the repo once in Vercel; every `git push` to `main` then redeploys automatically.

---

## Customising

All colours live in one place — the `:root` block at the top of `style.css`:

```css
:root {
  --blue: #1d4ed8;   /* primary   */
  --sky: #38bdf8;    /* sky blue  */
  --neon: #00e5ff;   /* neon cyan */
  --green: #22c55e;  /* accent    */
}
```

Change those four values and the whole site — cards, glows, gradients, charts, AQI scale —
re-themes itself. Light-mode overrides sit in the `[data-theme="light"]` block just below.

Other easy tweaks:

- Default city: `DEFAULT_PLACE` in `script.js`
- Refresh interval: `REFRESH_MS` in `script.js` (default 10 minutes)
- Max saved cities: the `slice(0, 8)` call in `toggleSave()`

---

## Browser support

Chrome / Edge 111+, Firefox 113+, Safari 16.4+ (uses `color-mix()` with a graceful fallback
for older browsers). Requires JavaScript and an internet connection for live data.

---

## Privacy

No accounts, no cookies, no analytics, no tracking, no server of your own. City searches go
straight from your browser to Open-Meteo. Saved cities, theme and unit preference are stored
only in your browser's `localStorage` and never leave the device.

---

## Credits

Weather, forecast and air-quality data by [Open-Meteo](https://open-meteo.com/) (CC-BY 4.0).
Built as a single static site with vanilla HTML, CSS and JavaScript.
