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

| Purpose | Endpoint | Key needed |
|---------|----------|------------|
| City search | `https://geocoding-api.open-meteo.com/v1/search` | No |
| Forecast | `https://api.open-meteo.com/v1/forecast` | No |
| Air quality | `https://air-quality-api.open-meteo.com/v1/air-quality` | No |

All three are free for non-commercial use and need no sign-up. Please check Open-Meteo's
terms if you expect heavy traffic.

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
