# Odyssey

> Your life is an Odyssey.

An Obsidian plugin that turns your life events into a **silky calendar**, a **beautiful map**, and a **cinematic replay** — all powered by plain Markdown files you own.

<!-- Once you have screenshots in the repo, uncomment this:
![Calendar view](docs/calendar.png)
![Map view](docs/map.png)
![Replay mode](docs/replay.png)
-->

## What it does

- **📅 Calendar view** — a clean month grid with single-day events, timed blocks, and multi-day journeys as proper spanning bars
- **🗺 Map view** — every entry with coordinates becomes a point on a MapLibre-powered map, with three basemaps (Positron, Voyager, Dark Matter)
- **🎬 Replay mode** — pick a date range, hit play, and watch your life unfold across the map with a camera that flies between stops and leaves a dotted trail
- **Two views, one story** — hover an entry in one view to highlight it in the other, click to focus, open side-by-side with one button

## Why

Existing tools split your life across silos:

- **Calendars** know *when* but not *where*
- **Maps** know *where* but not *when*
- **Journals** know *what* but not *when* or *where*

Odyssey keeps time and place together the way your memory does, and hands you back control with plain Markdown files. Your vault, your data, no lock-in.

## The entry format

Every entry is a regular `.md` file in an `Odyssey/` folder with simple frontmatter:

```markdown
---
date: 2026-05-15
end_date: 2026-05-20           # optional — makes it a multi-day journey
start_time: "14:00"            # optional — for timed events
end_time: "17:00"              # optional
location: "Tokyo"              # optional — shown in tooltips
lat: 35.6762                   # optional — puts it on the map
lng: 139.6503                  # optional
---

# Japan trip

Notes go here, plain Markdown, yours forever.
```

Only `date` is required. Everything else is optional and Odyssey adapts the rendering — a single-day event becomes a pill on the calendar, a multi-day range becomes a bar, and coordinates unlock the map and replay.

## Quick start

1. Install via **Settings → Community plugins → Browse → search "Odyssey"**
2. Enable the plugin
3. Click the calendar or map icon in the left ribbon, or run `Odyssey: Open Calendar` / `Odyssey: Open Map` from the command palette
4. Click **+ New Entry** (or hover any day cell for a quick **+**)
5. Fill in at minimum a title and a date — everything else is optional

### Getting coordinates

- **Fastest**: right-click any spot in Google Maps — the first menu item is the `lat, lng` pair, click to copy and paste into the Coordinates field
- **By name**: fill the Location field and click the 🔍 Resolve button — Odyssey will look it up via OpenStreetMap's Nominatim service
- **By map click**: in the map view, click **📍 Drop pin**, then click anywhere on the map to create an entry pre-filled with those coordinates

## Features

### Calendar

- Monthly grid with week rows
- Single-day entries render as inline **pills**, multi-day ones as **spanning bars** that correctly wrap across weeks with proper rounded ends
- **Hover "+"** on any day cell for quick creation prefilled with that date
- **Hover ×** on any entry for quick delete (moves to system trash; recoverable)
- Click any entry to open its Markdown file
- Jumps to the right month automatically when you click an entry on the map

### Map

- **MapLibre GL JS** vector tiles — fast, smooth, zero-configuration
- Three basemaps (no API key needed): **Positron** (minimalist grey — default), **Voyager** (colored with streets and landmarks), **Dark Matter** (dark mode)
- **Custom dot markers** that lift on hover
- **Popups** with title, date range, location, and a one-click "Open note →"
- **Drop pin** mode — click to create an entry exactly where you point
- **Right-click** any marker to delete
- **Geolocate control** — see where you are right now
- **Fit all** zooms the view to every marker

### Replay

Pick a date range, hit play, and the map takes you on a journey:

- Camera **flies to each stop** in order
- Historic stops become **small dots**, **dashed line** connects them
- Current stop is the **live marker with a pulse**
- Title card shows the current entry's **date, title, and location**
- Three speeds (Slow / Normal / Fast)
- **Space** to pause, **Esc** to exit
- When it ends, you see "That was your journey" with the option to watch again

### View linking

- **Hover** an entry in either view to highlight it in the other
- **Click** to focus — the map flies there, the calendar jumps to that month
- **📑 Split** button opens both views side-by-side

## Design philosophy

- **Hidden complexity** — you only pick "single day or date range", the plugin handles everything else (frontmatter, renderer, view switching)
- **Your data is yours** — plain Markdown, readable when Odyssey is uninstalled
- **Visual first** — this plugin exists to make you *enjoy* looking back at your life, not just to store it

## Configuration

No settings page yet. Everything works from defaults. Future versions may add:
- Satellite imagery (requires a MapTiler API key)
- Custom accent colors
- Alternate calendar start-of-week

## Credits

- [MapLibre GL JS](https://maplibre.org/) — open-source vector map rendering
- [CARTO](https://carto.com/) — beautiful free basemap styles (Positron, Voyager, Dark Matter)
- [OpenStreetMap](https://www.openstreetmap.org/) — contributors worldwide
- [Nominatim](https://nominatim.openstreetmap.org/) — geocoding

## Development

```bash
git clone https://github.com/zzzzswh/odyssey.git
cd odyssey
npm install
npm run dev     # watch mode
npm run build   # production build
```

Then symlink or copy the project into `<your-vault>/.obsidian/plugins/odyssey/` and enable it in Obsidian's Community Plugins settings.

## License

MIT — see [LICENSE](LICENSE).
