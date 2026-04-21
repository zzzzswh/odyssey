import * as React from "react";
import { useEffect, useRef, useMemo, useState } from "react";
import maplibregl, { Map as MLMap, Marker, Popup, LngLatBounds } from "maplibre-gl";
import { format, parseISO } from "date-fns";
import type { Entry } from "../data/Entry";
import { ReplayOverlay } from "./ReplayOverlay";

interface MapViewProps {
  entries: Entry[];
  hoveredPath: string | null;
  focusRequest: string | null;
  onEntryOpen: (entry: Entry) => void;
  onEntryHover: (path: string | null) => void;
  /** Opens the new-entry modal with no prefill (toolbar button). */
  onNewEntry: () => void;
  /** Opens the new-entry modal prefilled with coordinates from a map click. */
  onNewEntryAt: (lat: number, lng: number) => void;
  /** Right-click marker → confirm → trash. */
  onDeleteEntry: (entry: Entry) => void;
  onSwitchToCalendar: () => void;
  onSplitWithCalendar: () => void;
}

/**
 * Map view — MapLibre GL JS with CartoDB vector tiles.
 *
 * Basemaps offered (all free, no API key):
 *   - Positron      minimalist grayscale — default, makes markers pop
 *   - Voyager       colored with streets/landmarks — good for exploring
 *   - Dark Matter   dark mode — great with Obsidian dark themes
 *
 * Satellite imagery is deliberately excluded here: every worthwhile source
 * requires an API key (MapTiler, Mapbox, Esri). We'll add a settings page
 * in Week 5 that lets users paste their own key and unlock a "Satellite"
 * option — following Odyssey's "invisible complexity" philosophy: users
 * who don't provide a key never see the option at all.
 */

type BasemapId = "positron" | "voyager" | "dark";

const BASEMAPS: Record<BasemapId, { label: string; url: string }> = {
  positron: {
    label: "Positron",
    url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  },
  voyager: {
    label: "Voyager",
    url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  },
  dark: {
    label: "Dark Matter",
    url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },
};

const DEFAULT_BASEMAP: BasemapId = "positron";

export function MapView({
  entries,
  hoveredPath,
  focusRequest,
  onEntryOpen,
  onEntryHover,
  onNewEntry,
  onNewEntryAt,
  onDeleteEntry,
  onSwitchToCalendar,
  onSplitWithCalendar,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map()); // entry.file.path → marker
  const didFitRef = useRef(false); // fit bounds only on first render with entries
  const [basemap, setBasemap] = useState<BasemapId>(DEFAULT_BASEMAP);
  const [dropMode, setDropMode] = useState(false);
  const [replaying, setReplaying] = useState(false);

  // Latest callbacks in a ref so MapLibre event handlers always see the
  // current version without needing to re-bind on every render.
  const callbacksRef = useRef({ onNewEntryAt, onDeleteEntry, onEntryHover });
  callbacksRef.current = { onNewEntryAt, onDeleteEntry, onEntryHover };

  const dropModeRef = useRef(dropMode);
  dropModeRef.current = dropMode;

  // Filter to just the geolocated ones.
  const geoEntries = useMemo(
    () =>
      entries.filter(
        (e) => typeof e.lat === "number" && typeof e.lng === "number",
      ),
    [entries],
  );

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS[DEFAULT_BASEMAP].url,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    // Geolocate control — a standard puck-and-circle button. Clicking it asks
    // the browser for the user's current location, flies there, and drops a
    // live indicator. We deliberately do NOT enable trackUserLocation, because
    // Odyssey is a life-log, not a navigation app — constant GPS updates would
    // be wrong in spirit and create Obsidian permission friction.
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        showAccuracyCircle: true,
        showUserLocation: true,
      }),
    );

    // Click: when in drop mode, create a new entry at the clicked point.
    map.on("click", (ev) => {
      if (!dropModeRef.current) return;
      const { lng, lat } = ev.lngLat;
      callbacksRef.current.onNewEntryAt(lat, lng);
      // Exit drop mode after one placement — creating should feel deliberate,
      // not sticky. If the user wants to place another, they re-enter the mode.
      setDropMode(false);
    });

    mapRef.current = map;

    // Keep MapLibre in sync when Obsidian hands us a 0-height container or
    // resizes the leaf.
    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle a CSS class on the map container to get the crosshair cursor and
  // subtle visual cue when drop mode is active.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.classList.toggle("is-drop-mode", dropMode);
  }, [dropMode]);

  // ESC to exit drop mode.
  useEffect(() => {
    if (!dropMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dropMode]);

  // Change basemap when the user picks one.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(BASEMAPS[basemap].url);
    // Markers are DOM-overlaid, not part of the style, so they survive the
    // style swap automatically. No action needed here.
  }, [basemap]);

  // Sync markers whenever geoEntries change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Wait for map style to finish loading before adding markers.
    // If we add markers too early, the popup anchor math can glitch.
    const applyMarkers = () => {
      clearMarkers();
      for (const entry of geoEntries) {
        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          offset: 24,
          className: "odyssey-popup",
        }).setHTML(buildPopupHTML(entry));

        // Build a custom marker element (dot + ring) — replaces MapLibre's
        // default SVG pin. We pass it via the `element` option and also keep
        // a data attribute for the hover-highlight effect.
        const markerEl = document.createElement("div");
        markerEl.className = "odyssey-marker";
        const dot = document.createElement("div");
        dot.className = "odyssey-marker__dot";
        markerEl.appendChild(dot);

        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([entry.lng!, entry.lat!])
          .setPopup(popup)
          .addTo(map);

        const el = marker.getElement();
        // Expose the path as a data attribute so our hover-highlight effect
        // can toggle a class on the right marker without maintaining a
        // separate DOM index.
        el.setAttribute("data-odyssey-path", entry.file.path);

        // Right-click → confirm delete.
        el.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          callbacksRef.current.onDeleteEntry(entry);
        });

        // Hover → broadcast to the other view for highlight linking.
        el.addEventListener("mouseenter", () => {
          callbacksRef.current.onEntryHover(entry.file.path);
        });
        el.addEventListener("mouseleave", () => {
          callbacksRef.current.onEntryHover(null);
        });

        // Hook up the "Open note" button inside the popup on every open.
        popup.on("open", () => {
          const node = popup.getElement();
          const btn = node?.querySelector<HTMLButtonElement>(
            ".odyssey-popup__open",
          );
          if (btn) {
            btn.onclick = (ev) => {
              ev.preventDefault();
              onEntryOpen(entry);
            };
          }
        });

        markersRef.current.set(entry.file.path, marker);
      }

      // On first load only, fit to entries.
      if (!didFitRef.current && geoEntries.length > 0) {
        fitToEntries(map, geoEntries);
        didFitRef.current = true;
      }
    };

    if (map.isStyleLoaded()) applyMarkers();
    else map.once("load", applyMarkers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoEntries]);

  // Hover highlight: when another view tells us which entry is hovered,
  // toggle an is-hovered class on the corresponding marker's DOM node.
  useEffect(() => {
    for (const [path, marker] of markersRef.current) {
      const el = marker.getElement();
      if (path === hoveredPath) {
        el.classList.add("is-hovered");
      } else {
        el.classList.remove("is-hovered");
      }
    }
  }, [hoveredPath, geoEntries]);

  // Focus request from the other view: fly to the requested entry.
  useEffect(() => {
    if (!focusRequest) return;
    const map = mapRef.current;
    if (!map) return;
    const entry = geoEntries.find((e) => e.file.path === focusRequest);
    if (!entry) return; // the requested entry has no coords; nothing to do
    map.flyTo({
      center: [entry.lng!, entry.lat!],
      zoom: Math.max(map.getZoom(), 10),
      duration: 700,
    });
  }, [focusRequest, geoEntries]);

  function clearMarkers() {
    for (const m of markersRef.current.values()) m.remove();
    markersRef.current.clear();
  }

  return (
    <div className="odyssey-mapview">
      <div className="odyssey-mapview__toolbar">
        <div className="odyssey-mapview__title">
          {geoEntries.length === 0
            ? "No geolocated entries yet"
            : `${geoEntries.length} location${geoEntries.length === 1 ? "" : "s"}`}
        </div>
        <div style={{ flex: 1 }} />

        {/* Drop pin toggle */}
        <button
          className={
            "odyssey-mapview__drop" + (dropMode ? " is-active" : "")
          }
          onClick={() => setDropMode((v) => !v)}
          title={
            dropMode
              ? "Cancel (ESC) — click the map to place, or click here to cancel"
              : "Drop a pin to create an entry at a clicked location"
          }
        >
          📍 {dropMode ? "Click map…" : "Drop pin"}
        </button>

        {/* Basemap picker */}
        <select
          className="odyssey-mapview__basemap"
          value={basemap}
          onChange={(e) => setBasemap(e.target.value as BasemapId)}
          title="Basemap style"
        >
          {Object.entries(BASEMAPS).map(([id, b]) => (
            <option key={id} value={id}>
              {b.label}
            </option>
          ))}
        </select>

        {geoEntries.length > 0 && (
          <button
            className="odyssey-mapview__replay"
            onClick={() => setReplaying(true)}
            title="Replay your journey across the map"
          >
            ▶ Replay
          </button>
        )}
        {geoEntries.length > 0 && (
          <button
            className="odyssey-mapview__fit"
            onClick={() => {
              const map = mapRef.current;
              if (map) fitToEntries(map, geoEntries);
            }}
          >
            Fit all
          </button>
        )}
        <button
          className="odyssey-view-split"
          onClick={onSplitWithCalendar}
          title="Open the calendar alongside this view"
        >
          📑 Split
        </button>
        <button
          className="odyssey-view-switch"
          onClick={onSwitchToCalendar}
          title="Switch to calendar view"
        >
          📅 Calendar
        </button>
        <button className="odyssey-mapview__new" onClick={onNewEntry}>
          + New Entry
        </button>
      </div>

      <div className="odyssey-mapview__canvas" ref={containerRef}>
        {dropMode && (
          <div className="odyssey-mapview__drop-hint">
            Click the map to drop a pin here. Press <kbd>Esc</kbd> to cancel.
          </div>
        )}
      </div>

      {entries.length > 0 && geoEntries.length === 0 && (
        <div className="odyssey-mapview__hint">
          You have {entries.length} entr{entries.length === 1 ? "y" : "ies"},
          but none have coordinates yet. Add <code>lat</code> and{" "}
          <code>lng</code> to an entry's frontmatter, or paste{" "}
          <em>latitude, longitude</em> into the Coordinates field when creating
          a new one.
        </div>
      )}

      {replaying && mapRef.current && (
        <ReplayOverlay
          entries={entries}
          map={mapRef.current}
          onClose={() => setReplaying(false)}
        />
      )}
    </div>
  );
}

function buildPopupHTML(entry: Entry): string {
  const dateLabel = formatDateRange(entry);
  const location = entry.location
    ? `<div class="odyssey-popup__loc">${escapeHTML(entry.location)}</div>`
    : "";
  return `
    <div class="odyssey-popup__body">
      <div class="odyssey-popup__title">${escapeHTML(entry.title)}</div>
      <div class="odyssey-popup__date">${dateLabel}</div>
      ${location}
      <button class="odyssey-popup__open" type="button">Open note →</button>
    </div>
  `;
}

function formatDateRange(entry: Entry): string {
  try {
    const start = format(parseISO(entry.date), "MMM d, yyyy");
    if (entry.endDate && entry.endDate !== entry.date) {
      const end = format(parseISO(entry.endDate), "MMM d, yyyy");
      return `${start} → ${end}`;
    }
    return start;
  } catch {
    return entry.date;
  }
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fitToEntries(map: MLMap, entries: Entry[]) {
  if (entries.length === 0) return;

  if (entries.length === 1) {
    const e = entries[0];
    map.flyTo({ center: [e.lng!, e.lat!], zoom: 11, duration: 600 });
    return;
  }

  const bounds = new LngLatBounds();
  for (const e of entries) bounds.extend([e.lng!, e.lat!]);
  map.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 12 });
}
