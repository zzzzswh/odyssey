import * as React from "react";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import maplibregl, { Map as MLMap, LngLatBounds } from "maplibre-gl";
import type { App } from "obsidian";
import { format, parseISO } from "date-fns";
import type { Entry } from "../data/Entry";
import { ReplayOverlay } from "./ReplayOverlay";

interface MapViewProps {
  entries: Entry[];
  hoveredPath: string | null;
  focusRequest: string | null;
  /** Obsidian App handle — forwarded to ReplayOverlay so it can read note bodies. */
  app: App;
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

type GeoEntry = Entry & { lat: number; lng: number };

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
    label: "Dark matter",
    url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },
};

const DEFAULT_BASEMAP: BasemapId = "positron";

export function MapView({
  entries,
  hoveredPath,
  focusRequest,
  app,
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
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const didFitRef = useRef(false);
  const [basemap, setBasemap] = useState<BasemapId>(DEFAULT_BASEMAP);
  const [dropMode, setDropMode] = useState(false);
  const [replaying, setReplaying] = useState(false);

  // Latest callbacks in a ref so MapLibre event handlers always see the
  // current version without needing to re-bind on every render.
  const callbacksRef = useRef({
    onNewEntryAt,
    onDeleteEntry,
    onEntryHover,
    onEntryOpen,
  });
  callbacksRef.current = {
    onNewEntryAt,
    onDeleteEntry,
    onEntryHover,
    onEntryOpen,
  };

  const dropModeRef = useRef(dropMode);
  dropModeRef.current = dropMode;

  const geoEntries = useMemo(() => entries.filter(hasCoordinates), [entries]);

  const clearMarkers = useCallback(() => {
    for (const marker of markersRef.current.values()) marker.remove();
    markersRef.current.clear();
  }, []);

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
  }, [clearMarkers]);

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
  }, [basemap]);

  // Sync markers whenever geolocated entries change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyMarkers = () => {
      clearMarkers();
      for (const entry of geoEntries) {
        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          offset: 24,
          className: "odyssey-popup",
        }).setHTML(buildPopupHTML(entry));

        const markerEl = document.createElement("div");
        markerEl.className = "odyssey-marker";
        const dot = document.createElement("div");
        dot.className = "odyssey-marker__dot";
        markerEl.appendChild(dot);

        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([entry.lng, entry.lat])
          .setPopup(popup)
          .addTo(map);

        const el = marker.getElement();
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
              callbacksRef.current.onEntryOpen(entry);
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
  }, [geoEntries, clearMarkers]);

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
  }, [hoveredPath]);

  // Focus request from the other view: fly to the requested entry.
  useEffect(() => {
    if (!focusRequest) return;
    const map = mapRef.current;
    if (!map) return;
    const entry = geoEntries.find((e) => e.file.path === focusRequest);
    if (!entry) return;
    map.flyTo({
      center: [entry.lng, entry.lat],
      zoom: Math.max(map.getZoom(), 10),
      duration: 700,
    });
  }, [focusRequest, geoEntries]);

  return (
    <div className="odyssey-mapview">
      <div className="odyssey-mapview__toolbar">
        <div className="odyssey-mapview__title">
          {geoEntries.length === 0
            ? "No geolocated entries yet"
            : `${geoEntries.length} location${geoEntries.length === 1 ? "" : "s"}`}
        </div>
        <div style={{ flex: 1 }} />

        <button
          className={"odyssey-mapview__drop" + (dropMode ? " is-active" : "")}
          onClick={() => setDropMode((v) => !v)}
          title={
            dropMode
              ? "Cancel (Esc) — click the map to place, or click here to cancel"
              : "Drop a pin to create an entry at a clicked location"
          }
        >
          📍 {dropMode ? "Click map…" : "Drop pin"}
        </button>

        <select
          className="odyssey-mapview__basemap"
          value={basemap}
          onChange={(e) => {
            const nextBasemap = e.target.value;
            if (isBasemapId(nextBasemap)) setBasemap(nextBasemap);
          }}
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
          + New entry
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
          <em>latitude, longitude</em> into the coordinates field when creating
          a new one.
        </div>
      )}

      {replaying && mapRef.current && (
        <ReplayOverlay
          entries={entries}
          map={mapRef.current}
          app={app}
          onClose={() => setReplaying(false)}
        />
      )}
    </div>
  );
}

function hasCoordinates(entry: Entry): entry is GeoEntry {
  return typeof entry.lat === "number" && typeof entry.lng === "number";
}

function isBasemapId(value: string): value is BasemapId {
  return Object.prototype.hasOwnProperty.call(BASEMAPS, value);
}

function buildPopupHTML(entry: Entry): string {
  const dateLabel = escapeHTML(formatDateRange(entry));
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

function fitToEntries(map: MLMap, entries: GeoEntry[]) {
  if (entries.length === 0) return;

  if (entries.length === 1) {
    const e = entries[0];
    map.flyTo({ center: [e.lng, e.lat], zoom: 11, duration: 600 });
    return;
  }

  const bounds = new LngLatBounds();
  for (const e of entries) bounds.extend([e.lng, e.lat]);
  map.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 12 });
}
