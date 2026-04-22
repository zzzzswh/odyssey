import * as React from "react";
import { useEffect, useRef, useState, useMemo } from "react";
import type { Map as MLMap } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import type { App } from "obsidian";
import { format, parseISO } from "date-fns";
import type { Entry } from "../data/Entry";
import {
  buildTimeline,
  defaultRangeFromEntries,
  SPEED_LABELS,
  type ReplaySpeed,
  type ReplayStop,
} from "../data/replay";

interface ReplayOverlayProps {
  /** All entries (Replay filters internally). */
  entries: Entry[];
  /** The actual MapLibre map instance to drive. */
  map: MLMap;
  /** App handle — used to lazily read entry bodies for the title card excerpt. */
  app: App;
  /** Close the overlay and return to normal map view. */
  onClose: () => void;
}

type Phase = "picking" | "playing" | "paused" | "done";

// Per-stop pause after landing. Tuned for "read the title card, take it in,
// then leave" — at Cinematic (0.33×) this is ~6s, at Normal (1×) ~2s.
const DWELL_MS = 2000;
// Base camera flight duration. Tuned so that at Cinematic it reads as a
// deliberate cross-world glide (~9s), at Normal it's a brisk ~3s.
const FLY_MS_BASE = 3000;
// Flight duration in manual mode. Fixed — no speed multiplier applies here
// because in manual mode the user owns the pacing; we just need the camera
// move itself to feel smooth and deliberate, not blink or drag.
const MANUAL_FLY_MS = 2500;
const TRAIL_SOURCE_ID = "odyssey-replay-trail";
const TRAIL_LAYER_ID = "odyssey-replay-trail-layer";
const DOTS_SOURCE_ID = "odyssey-replay-dots";
const DOTS_LAYER_ID = "odyssey-replay-dots-layer";

/**
 * Extract a human-readable first-paragraph excerpt from a note's raw content.
 * Strips YAML frontmatter, the leading H1, list-item markers, and clips to
 * ~220 chars with a trailing ellipsis. Returns an empty string if the body
 * has no prose (e.g. a note that is only frontmatter + an H1).
 */
function extractExcerpt(content: string): string {
  // 1. Strip the frontmatter block, if present.
  const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\s*\r?\n/);
  let body = fmMatch ? content.slice(fmMatch[0].length) : content;

  // 2. Skip any leading whitespace and a single leading H1 line.
  body = body.replace(/^\s+/, "");
  body = body.replace(/^#\s+[^\n]*\r?\n+/, "");
  body = body.replace(/^\s+/, "");

  // 3. Take the first paragraph (up to a blank line).
  const firstPara = body.split(/\r?\n\s*\r?\n/)[0].trim();
  if (!firstPara) return "";

  // 4. Strip a leading list-item marker if the paragraph starts with one.
  const cleaned = firstPara.replace(/^(?:[-*]|\d+\.)\s+/, "").trim();

  // 5. Clip length. Cut at the last whitespace to avoid mid-word breaks.
  const MAX = 220;
  if (cleaned.length <= MAX) return cleaned;
  const clipped = cleaned.slice(0, MAX).replace(/\s+\S*$/, "");
  return clipped + "…";
}

/**
 * The full-screen replay overlay.
 *
 * States:
 *   - picking: user sees date range inputs + stop count + "Start" button
 *   - playing: camera is flying, dots accumulate, title card fades between stops
 *   - paused:  same visuals as playing, but timer stopped
 *   - done:    after the last stop, show "Replay complete" + Replay again / Close
 *
 * Cinematography choices (from product Q&A):
 *   - Q1=A: full-screen takeover; toolbar is hidden behind the overlay
 *   - Q2=C: flyTo each stop, 0.5s dwell, then fly to next
 *   - Q3=C+D: historic stops become small dots connected by dashed line;
 *     current stop renders as the full MapLibre Marker (painted on top)
 *   - Q4=A: default range = earliest entry → latest entry
 */
export function ReplayOverlay({ entries, map, app, onClose }: ReplayOverlayProps) {
  const [phase, setPhase] = useState<Phase>("picking");
  const [range, setRange] = useState(() => defaultRangeFromEntries(entries));
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  // Playback mode. "auto" runs the timer-driven fly-through. "manual" puts
  // the user in charge — they click Next to advance, and the title card
  // stays pinned until they do. Manual is the right pick for narrated
  // demos and for deliberate personal review.
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [stepIndex, setStepIndex] = useState(-1); // -1 = before first
  // path → first-paragraph excerpt. Populated async once a timeline exists.
  const [excerpts, setExcerpts] = useState<Map<string, string>>(new Map());

  const timeline = useMemo(
    () => buildTimeline(entries, range.start, range.end),
    [entries, range.start, range.end],
  );

  // Lazy-load body excerpts for the entries in the current timeline. We
  // deliberately don't block the picker UI — excerpts arrive when they arrive,
  // and TitleCard gracefully renders without one if the read hasn't landed.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = new Map<string, string>();
      for (const stop of timeline) {
        try {
          const text = await app.vault.cachedRead(stop.entry.file);
          const ex = extractExcerpt(text);
          if (ex) result.set(stop.entry.file.path, ex);
        } catch {
          // Ignore — missing or unreadable notes simply won't have excerpts.
        }
        if (cancelled) return;
      }
      if (!cancelled) setExcerpts(result);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [timeline, app]);

  const timeoutRef = useRef<number | null>(null);
  const originalCenterRef = useRef<{ lng: number; lat: number; zoom: number } | null>(
    null,
  );
  const currentMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Phase changes mean we need to manage several side-effects in sync:
  // starting/stopping timers, adding/removing map layers, resetting markers.
  // useEffect on `phase` + `stepIndex` is the single source of truth for all.

  // ── Sources and layers lifecycle ────────────────────────────────────────
  // Add trail + dots layers when first entering playing phase.
  // Remove them when overlay unmounts.
  useEffect(() => {
    const ensureLayers = () => {
      if (!map.getSource(TRAIL_SOURCE_ID)) {
        map.addSource(TRAIL_SOURCE_ID, {
          type: "geojson",
          data: emptyLine(),
        });
        map.addLayer({
          id: TRAIL_LAYER_ID,
          type: "line",
          source: TRAIL_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#5b5bd6",
            "line-width": 2.5,
            "line-dasharray": [1.5, 2.5],
            "line-opacity": 0.75,
          },
        });
      }
      if (!map.getSource(DOTS_SOURCE_ID)) {
        map.addSource(DOTS_SOURCE_ID, {
          type: "geojson",
          data: emptyFC(),
        });
        map.addLayer({
          id: DOTS_LAYER_ID,
          type: "circle",
          source: DOTS_SOURCE_ID,
          paint: {
            "circle-radius": 5,
            "circle-color": "#5b5bd6",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.9,
          },
        });
      }
    };

    if (map.isStyleLoaded()) ensureLayers();
    else map.once("load", ensureLayers);

    return () => {
      // Cleanup on unmount — remove everything we added.
      for (const id of [TRAIL_LAYER_ID, DOTS_LAYER_ID]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of [TRAIL_SOURCE_ID, DOTS_SOURCE_ID]) {
        if (map.getSource(id)) map.removeSource(id);
      }
      if (currentMarkerRef.current) {
        currentMarkerRef.current.remove();
        currentMarkerRef.current = null;
      }
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [map]);

  // ── Update trail + dots whenever step changes ──────────────────────────
  useEffect(() => {
    if (phase === "picking") return;

    const trailSrc = map.getSource<maplibregl.GeoJSONSource>(TRAIL_SOURCE_ID);
    const dotsSrc = map.getSource<maplibregl.GeoJSONSource>(DOTS_SOURCE_ID);

    // Historic stops = everything before the current one.
    // Current stop is drawn as a Marker, not a circle, so it pops.
    const historicEnd = Math.max(0, stepIndex);
    const historic = timeline.slice(0, historicEnd);

    if (trailSrc) {
      // Include the current point in the line so it connects visually.
      const line = timeline.slice(0, stepIndex + 1);
      trailSrc.setData({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: line.map((s) => [s.lng, s.lat]),
        },
        properties: {},
      });
    }

    if (dotsSrc) {
      dotsSrc.setData({
        type: "FeatureCollection",
        features: historic.map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lng, s.lat] },
          properties: { path: s.entry.file.path },
        })),
      });
    }

    // Move the "current" marker — or create it on first step.
    const current = timeline[stepIndex];
    if (current) {
      if (!currentMarkerRef.current) {
        // Custom marker element matching the map view's design.
        const el = document.createElement("div");
        el.className = "odyssey-marker odyssey-replay-current";
        const dot = document.createElement("div");
        dot.className = "odyssey-marker__dot";
        el.appendChild(dot);
        currentMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([current.lng, current.lat])
          .addTo(map);
      } else {
        currentMarkerRef.current.setLngLat([current.lng, current.lat]);
      }
    }
  }, [stepIndex, phase, timeline, map]);

  // ── Playback tick ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    // Manual mode is user-driven — the timer doesn't run. Next/Prev
    // handlers move stepIndex instead, and the user decides when we're done
    // by clicking Next past the last stop.
    if (mode === "manual") return;

    if (stepIndex >= timeline.length - 1) {
      // We're on the last stop; dwell, then declare done.
      timeoutRef.current = window.setTimeout(
        () => setPhase("done"),
        DWELL_MS / speed,
      );
      return () => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      };
    }

    const next = timeline[stepIndex + 1];
    if (!next) return;

    // Dwell on current, then flyTo next, which counts as the advance.
    timeoutRef.current = window.setTimeout(() => {
      map.flyTo({
        center: [next.lng, next.lat],
        zoom: Math.max(map.getZoom(), 8),
        duration: FLY_MS_BASE / speed,
        essential: true,
      });
      setStepIndex((i) => i + 1);
    }, DWELL_MS / speed);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [phase, stepIndex, timeline, speed, map, mode]);

  // ── Controls ───────────────────────────────────────────────────────────
  const start = () => {
    if (timeline.length === 0) return;
    originalCenterRef.current = {
      lng: map.getCenter().lng,
      lat: map.getCenter().lat,
      zoom: map.getZoom(),
    };
    // Jump camera to the first stop (no animation for the initial landing;
    // we want playback to start *from* that place, not mid-flight).
    const first = timeline[0];
    map.jumpTo({ center: [first.lng, first.lat], zoom: 8 });
    setStepIndex(0);
    setPhase("playing");
  };

  const pause = () => setPhase("paused");
  const resume = () => setPhase("playing");

  // Manual-mode advance. Fires on Next button and on Space/→ keypress.
  // When we step past the last stop, we declare done so the user gets the
  // same end-of-journey moment auto-mode provides.
  const next = () => {
    if (phase !== "playing" || mode !== "manual") return;
    if (stepIndex >= timeline.length - 1) {
      setPhase("done");
      return;
    }
    const nextStop = timeline[stepIndex + 1];
    if (!nextStop) return;
    map.flyTo({
      center: [nextStop.lng, nextStop.lat],
      zoom: Math.max(map.getZoom(), 8),
      duration: MANUAL_FLY_MS,
      essential: true,
    });
    setStepIndex((i) => i + 1);
  };

  // Manual-mode rewind. The trail + dots layers recompute from stepIndex on
  // every change, so the visual state "un-accumulates" correctly.
  const prev = () => {
    if (phase !== "playing" || mode !== "manual") return;
    if (stepIndex <= 0) return;
    const prevStop = timeline[stepIndex - 1];
    if (!prevStop) return;
    map.flyTo({
      center: [prevStop.lng, prevStop.lat],
      zoom: Math.max(map.getZoom(), 8),
      duration: MANUAL_FLY_MS,
      essential: true,
    });
    setStepIndex((i) => i - 1);
  };

  const close = () => {
    // Restore the camera to where the user was before starting.
    const orig = originalCenterRef.current;
    if (orig) {
      map.flyTo({
        center: [orig.lng, orig.lat],
        zoom: orig.zoom,
        duration: 500,
      });
    }
    onClose();
  };

  const replayAgain = () => {
    setStepIndex(-1);
    // Clear trail and dots so we don't see last run's residue during the jumpTo.
    const trailSrc = map.getSource<maplibregl.GeoJSONSource>(TRAIL_SOURCE_ID);
    const dotsSrc = map.getSource<maplibregl.GeoJSONSource>(DOTS_SOURCE_ID);
    trailSrc?.setData(emptyLine());
    dotsSrc?.setData(emptyFC());
    start();
  };

  // Keyboard shortcuts while the overlay is mounted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Only eat Esc when we're in a phase where closing makes sense
        // (picking/done) or we're mid-replay (user wants to bail).
        e.preventDefault();
        close();
      } else if (mode === "manual" && phase === "playing") {
        // Manual-mode navigation. Space and Right advance; Left rewinds.
        if (e.key === " " || e.key === "ArrowRight") {
          e.preventDefault();
          next();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          prev();
        }
      } else if (
        e.key === " " &&
        (phase === "playing" || phase === "paused")
      ) {
        // Auto-mode: Space toggles pause/resume.
        e.preventDefault();
        if (phase === "playing") pause();
        else resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close/pause/resume/next/prev are stable closures defined in this component scope; including them would re-bind the listener on every state change for no behavioral benefit.
  }, [phase, mode, stepIndex]);

  const currentStop = stepIndex >= 0 ? timeline[stepIndex] : null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="odyssey-replay">
      {phase === "picking" && (
        <div className="odyssey-replay__picker">
          <h2 className="odyssey-replay__h1">Replay your journey</h2>
          <p className="odyssey-replay__sub">
            Watch your entries unfold across the map, in the order you lived them.
          </p>

          <div className="odyssey-replay__range">
            <label>
              <span>From</span>
              <input
                type="date"
                value={range.start}
                onChange={(e) =>
                  setRange((r) => ({ ...r, start: e.target.value }))
                }
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={range.end}
                onChange={(e) =>
                  setRange((r) => ({ ...r, end: e.target.value }))
                }
              />
            </label>
          </div>

          <div
            className={
              "odyssey-replay__speed" +
              (mode === "manual" ? " is-disabled" : "")
            }
            aria-disabled={mode === "manual"}
          >
            <span>Speed</span>
            {([0.33, 0.5, 1, 2] as ReplaySpeed[]).map((val) => (
              <button
                key={val}
                type="button"
                className={
                  "odyssey-replay__speed-btn" +
                  (speed === val ? " is-active" : "")
                }
                onClick={() => setSpeed(val)}
                disabled={mode === "manual"}
              >
                {SPEED_LABELS[val]}
              </button>
            ))}
          </div>

          <div className="odyssey-replay__mode">
            <span>Mode</span>
            <button
              type="button"
              className={
                "odyssey-replay__mode-btn" +
                (mode === "auto" ? " is-active" : "")
              }
              onClick={() => setMode("auto")}
              title="Let the replay play itself"
            >
              ▶ Play
            </button>
            <button
              type="button"
              className={
                "odyssey-replay__mode-btn" +
                (mode === "manual" ? " is-active" : "")
              }
              onClick={() => setMode("manual")}
              title="Click Next to advance — best for narration and focused review"
            >
              👆 Step through
            </button>
          </div>

          <div className="odyssey-replay__stats">
            {timeline.length === 0 ? (
              <span className="is-empty">
                No geolocated entries in this range.
              </span>
            ) : (
              <span>
                <b>{timeline.length}</b> stop{timeline.length === 1 ? "" : "s"}{" "}
                · {format(parseISO(range.start), "MMM d, yyyy")} →{" "}
                {format(parseISO(range.end), "MMM d, yyyy")}
              </span>
            )}
          </div>

          <div className="odyssey-replay__actions">
            <button
              className="odyssey-replay__start"
              onClick={start}
              disabled={timeline.length === 0}
            >
              ▶ Start
            </button>
            <button className="odyssey-replay__cancel" onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(phase === "playing" || phase === "paused") && (
        <>
          <TitleCard
            stop={currentStop}
            excerpt={
              currentStop
                ? excerpts.get(currentStop.entry.file.path) ?? ""
                : ""
            }
          />
          <div className="odyssey-replay__controls">
            {mode === "manual" ? (
              <>
                <button
                  className="odyssey-replay__ctrl"
                  onClick={prev}
                  disabled={stepIndex <= 0}
                  title="Previous (←)"
                >
                  ◀
                </button>
                <div className="odyssey-replay__progress">
                  <div
                    className="odyssey-replay__progress-bar"
                    style={{
                      width:
                        timeline.length > 0
                          ? `${((stepIndex + 1) / timeline.length) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
                <span className="odyssey-replay__count">
                  {stepIndex + 1} / {timeline.length}
                </span>
                <button
                  className="odyssey-replay__ctrl"
                  onClick={next}
                  title={
                    stepIndex >= timeline.length - 1
                      ? "Finish (Space or →)"
                      : "Next (Space or →)"
                  }
                >
                  ▶
                </button>
                <button
                  className="odyssey-replay__ctrl"
                  onClick={close}
                  title="Exit (Esc)"
                >
                  ×
                </button>
              </>
            ) : (
              <>
                {phase === "playing" ? (
                  <button
                    className="odyssey-replay__ctrl"
                    onClick={pause}
                    title="Pause (Space)"
                  >
                    ⏸
                  </button>
                ) : (
                  <button
                    className="odyssey-replay__ctrl"
                    onClick={resume}
                    title="Resume (Space)"
                  >
                    ▶
                  </button>
                )}
                <div className="odyssey-replay__progress">
                  <div
                    className="odyssey-replay__progress-bar"
                    style={{
                      width:
                        timeline.length > 0
                          ? `${((stepIndex + 1) / timeline.length) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
                <span className="odyssey-replay__count">
                  {stepIndex + 1} / {timeline.length}
                </span>
                <button
                  className="odyssey-replay__ctrl"
                  onClick={close}
                  title="Exit (Esc)"
                >
                  ×
                </button>
              </>
            )}
          </div>
        </>
      )}

      {phase === "done" && (
        <div className="odyssey-replay__done">
          <div className="odyssey-replay__done-inner">
            <h2 className="odyssey-replay__h1">That was your journey.</h2>
            <p className="odyssey-replay__sub">
              {timeline.length} stop{timeline.length === 1 ? "" : "s"}{" "}
              between {format(parseISO(range.start), "MMM d, yyyy")} and{" "}
              {format(parseISO(range.end), "MMM d, yyyy")}.
            </p>
            <div className="odyssey-replay__actions">
              <button
                className="odyssey-replay__start"
                onClick={replayAgain}
              >
                ↻ Watch again
              </button>
              <button className="odyssey-replay__cancel" onClick={close}>
                Back to map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function TitleCard({
  stop,
  excerpt,
}: {
  stop: ReplayStop | null;
  excerpt: string;
}) {
  if (!stop) return null;
  // Keyed by path so React swaps the whole node and CSS animation re-runs,
  // producing a crossfade on every step.
  return (
    <div className="odyssey-replay__title-card" key={stop.entry.file.path}>
      <div className="odyssey-replay__date">
        {formatStopDate(stop.entry.date, stop.entry.endDate)}
      </div>
      <div className="odyssey-replay__title">{stop.entry.title}</div>
      {stop.entry.location && (
        <div className="odyssey-replay__loc">{stop.entry.location}</div>
      )}
      {excerpt && <div className="odyssey-replay__excerpt">{excerpt}</div>}
    </div>
  );
}

function formatStopDate(startIso: string, endIso?: string): string {
  try {
    const start = format(parseISO(startIso), "MMMM d, yyyy");
    if (endIso && endIso !== startIso) {
      const end = format(parseISO(endIso), "MMM d, yyyy");
      return `${start} → ${end}`;
    }
    return start;
  } catch {
    return startIso;
  }
}

function emptyFC(): GeoJSON.FeatureCollection<GeoJSON.Geometry> {
  return { type: "FeatureCollection", features: [] };
}

function emptyLine(): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: [] },
    properties: {},
  };
}

// Keyboard shortcuts — wired at the app level via a global listener.
// We attach in MapView's host so Escape / Space respond even when the
// overlay doesn't have focus.
export const REPLAY_KEY_HANDLERS = {
  SPACE_TOGGLES_PLAY: " ",
  ESC_EXITS: "Escape",
} as const;
