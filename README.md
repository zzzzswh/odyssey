# Odyssey

> Your life is an Odyssey.

An Obsidian plugin that turns your life events into a **silky calendar**, a **beautiful map**, and a **cinematic replay** — all powered by plain Markdown files you own.

---

## What it does

- **📅 Calendar view** — a clean month grid with single-day events, timed blocks, and multi-day journeys as proper spanning bars
- **🗺 Map view** — every entry with coordinates becomes a point on a MapLibre-powered map, with three basemaps (Positron, Voyager, Dark Matter)
- **🎬 Replay mode** — pick a date range, hit play, and watch your life unfold across the map with a camera that flies between stops and leaves a dotted trail
- **Two views, one story** — hover an entry in one view to highlight it in the other, click to focus, open side-by-side with one button

## See it in action

### 📅 Calendar — every event in its rightful place

<video src="https://github.com/user-attachments/assets/3153e407-7fdd-441b-8cb3-3aaa1eb3a6bd" controls autoplay loop muted playsinline width="100%"></video>

A clean month grid. Single-day entries become pills, multi-day journeys stretch as bars across weeks. Hover any day for a quick **+**, hover any entry to delete.

### 🗺 Map — every place you've been, on one canvas

<video src="https://github.com/user-attachments/assets/40d02527-e55a-454c-ad64-e06429563d68" controls autoplay loop muted playsinline width="100%"></video>

Three free basemaps, no API keys. Click any dot to peek at the entry, drop a pin to create one on the spot.

### 🎬 Replay — watch your year unfold

<video src="https://github.com/user-attachments/assets/5aa8b2b9-904d-4c4f-b725-673ab93c8cb8" controls autoplay loop muted playsinline width="100%"></video>

Pick a date range, hit play. The camera flies between your stops, dashed lines trace the past, the present pulses on the screen.
## Why Odyssey exists

Existing tools split your life across silos:

- **Calendars** know *when* but not *where*
- **Maps** know *where* but not *when*
- **Journals** know *what* but not *when* or *where*
- **Cloud note apps** know all three — and so do their servers

Odyssey keeps time and place together the way your memory does — and hands you back the controls.

### Your life is not training data

The other thing Odyssey is *not* is a cloud product.

Your honeymoon. Your kid's first steps. The café where you met them. The trip you took alone to figure things out. These aren't rows in someone's database — they're yours. Odyssey keeps it that way:

- 🔒 **Local-first** — every entry lives in your vault as a plain Markdown file. Nothing syncs anywhere unless *you* set it up.
- 🚫 **No accounts, no servers, no telemetry** — Odyssey doesn't know you exist.
- 🤖 **Nothing gets fed to an AI model** — not yours, not anyone's. Your memories aren't going to be summarized in someone's chatbot demo.
- 📂 **Plain Markdown, forever** — open any entry in any text editor, twenty years from now, and it still works. Even if Odyssey disappears tomorrow.

Your vault, your data, no lock-in. The way it should be.

## The entry format

**An entry is just a Markdown file.** That's it. Open it in any text editor twenty years from now and it will still work.

Every entry lives in an `Odyssey/` folder with simple frontmatter:

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

Notes go here. Plain Markdown. Yours forever.
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

## Roadmap

Things on my mind for upcoming versions:

- [ ] Settings page with theme customization
- [ ] Photo and video embeds, with thumbnails right on the map
- [ ] Year-in-review summary stats
- [ ] Import from Google Timeline / Apple Photos
- [ ] Mobile polish for Obsidian on iOS & Android

Have an idea? [Open an issue](https://github.com/zzzzswh/odyssey/issues) — I read every one.

## A note from the maker

I built Odyssey because somewhere along the way, *writing things down* turned into *paying attention*, and paying attention turned into loving the days I was living. The trips, sure, but also the small ones — a walk, a coffee, a Tuesday that ended up mattering.

Everyone has their own Odyssey period. **Record it. Live through it.** That's what this plugin is for.

If it helps you do the same, that's all I wanted.

## Credits

- [MapLibre GL JS](https://maplibre.org/) — open-source vector map rendering
- [CARTO](https://carto.com/) — beautiful free basemap styles (Positron, Voyager, Dark Matter)
- [OpenStreetMap](https://www.openstreetmap.org/) — contributors worldwide
- [Nominatim](https://nominatim.openstreetmap.org/) — geocoding

And to the Obsidian community — for proving every day that the best tools are the ones their users actually own.

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
