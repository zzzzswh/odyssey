import type { Entry } from "./Entry";
import { parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";

/**
 * Replay — the soul of Odyssey.
 *
 * Not a data viz. A ritual. The user picks a range, hits play, and watches
 * their life unfold across the map as the camera follows, dots accumulate,
 * and dashed lines trace the journey between them.
 *
 * This module owns the pure logic:
 *   - filter entries into a replay timeline
 *   - advance playback state machine (idle / playing / paused / done)
 *   - emit "now at step i" so MapView can animate camera + trail
 *
 * MapView owns the actual flyTo, the DOM overlay, the timer.
 * That separation lets the state machine stay testable without a map.
 */

export type ReplaySpeed = 0.5 | 1 | 2;

export const SPEED_LABELS: Record<ReplaySpeed, string> = {
  0.5: "Slow",
  1: "Normal",
  2: "Fast",
};

/**
 * One logical stop in the replay timeline. A geo-entry projected to just
 * the bits Replay needs, in chronological order.
 */
export interface ReplayStop {
  entry: Entry;
  lat: number;
  lng: number;
  date: string;
}

/**
 * Filter the full entry list down to stops that:
 *   - have both lat and lng
 *   - fall in the requested inclusive date range
 * Sort by start date ascending, ties broken by title for determinism.
 */
export function buildTimeline(
  entries: Entry[],
  startDate: string,
  endDate: string,
): ReplayStop[] {
  let start: Date;
  let end: Date;
  try {
    start = startOfDay(parseISO(startDate));
    end = endOfDay(parseISO(endDate));
  } catch {
    return [];
  }

  const stops: ReplayStop[] = [];
  for (const e of entries) {
    if (typeof e.lat !== "number" || typeof e.lng !== "number") continue;
    let entryDate: Date;
    try {
      entryDate = parseISO(e.date);
    } catch {
      continue;
    }
    if (!isWithinInterval(entryDate, { start, end })) continue;
    stops.push({ entry: e, lat: e.lat, lng: e.lng, date: e.date });
  }

  stops.sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    return c !== 0 ? c : a.entry.title.localeCompare(b.entry.title);
  });

  return stops;
}

/**
 * Suggest a default date range for the replay picker:
 * earliest entry date → latest entry date. If no entries, returns today/today.
 */
export function defaultRangeFromEntries(entries: Entry[]): {
  start: string;
  end: string;
} {
  const dated = entries
    .map((e) => e.date)
    .filter(Boolean)
    .sort();
  if (dated.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return { start: today, end: today };
  }
  return { start: dated[0], end: dated[dated.length - 1] };
}
