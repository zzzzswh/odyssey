import * as React from "react";
import { useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  differenceInCalendarDays,
  isBefore,
  isAfter,
} from "date-fns";
import type { Entry } from "../data/Entry";

interface CalendarViewProps {
  entries: Entry[];
  /** Currently hovered entry path (from another view) — we highlight ours. */
  hoveredPath: string | null;
  /** One-shot focus request (from another view) — we scroll/jump to it. */
  focusRequest: string | null;
  onEntryClick: (entry: Entry) => void;
  /** Hover signal for cross-view sync. Called with null on mouse leave. */
  onEntryHover: (path: string | null) => void;
  /** Opens the new-entry modal, optionally prefilled with a date. */
  onNewEntry: (defaultDate?: string) => void;
  /** Called when the user clicks the × on a pill/bar. */
  onDeleteEntry: (entry: Entry) => void;
  /** Switches this tab to the map view in place. */
  onSwitchToMap: () => void;
  /** Open the map view alongside this one in a split. */
  onSplitWithMap: () => void;
}

/**
 * Month-grid calendar — Week 1 (enhanced).
 *
 * Rendering rules:
 *   - Single-day entries (date only, or date + time) show as pills inside their cell.
 *   - Multi-day entries (date + end_date differ) show as BARS that span their range,
 *     split across week boundaries with proper start/end rounding per segment.
 *   - Each day cell shows a tiny "+" button on hover for quick creation.
 */
export function CalendarView({
  entries,
  hoveredPath,
  focusRequest,
  onEntryClick,
  onEntryHover,
  onNewEntry,
  onDeleteEntry,
  onSwitchToMap,
  onSplitWithMap,
}: CalendarViewProps) {
  const [cursor, setCursor] = useState(() => new Date());

  // Respond to focus requests from the map: scroll our cursor to that month.
  React.useEffect(() => {
    if (!focusRequest) return;
    const target = entries.find((e) => e.file.path === focusRequest);
    if (!target) return;
    try {
      const d = parseISO(target.date);
      // Only jump if the target isn't already visible in the current month grid.
      if (
        d.getFullYear() !== cursor.getFullYear() ||
        d.getMonth() !== cursor.getMonth()
      ) {
        setCursor(d);
      }
    } catch {
      /* ignore */
    }
  }, [focusRequest, entries, cursor]);

  const weeks = useMemo(() => buildWeeks(cursor, entries), [cursor, entries]);
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="odyssey-calendar">
      <div className="odyssey-calendar__toolbar">
        <button
          className="odyssey-calendar__nav"
          onClick={() => setCursor(subMonths(cursor, 1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="odyssey-calendar__title">
          {format(cursor, "MMMM yyyy")}
        </div>
        <button
          className="odyssey-calendar__nav"
          onClick={() => setCursor(addMonths(cursor, 1))}
          aria-label="Next month"
        >
          ›
        </button>
        <button
          className="odyssey-calendar__today"
          onClick={() => setCursor(new Date())}
        >
          Today
        </button>
        <div style={{ flex: 1 }} />
        <button
          className="odyssey-view-split"
          onClick={onSplitWithMap}
          title="Open the map alongside this view"
        >
          📑 Split
        </button>
        <button
          className="odyssey-view-switch"
          onClick={onSwitchToMap}
          title="Switch to map view"
        >
          🗺 Map
        </button>
        <button
          className="odyssey-calendar__new"
          onClick={() => onNewEntry()}
        >
          + New entry
        </button>
      </div>

      <div className="odyssey-calendar__weekdays">
        {weekdayLabels.map((w) => (
          <div key={w} className="odyssey-calendar__weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="odyssey-calendar__weeks">
        {weeks.map((w, i) => (
          <WeekRow
            key={i}
            week={w}
            monthCursor={cursor}
            hoveredPath={hoveredPath}
            onEntryClick={onEntryClick}
            onEntryHover={onEntryHover}
            onNewEntry={onNewEntry}
            onDeleteEntry={onDeleteEntry}
          />
        ))}
      </div>

      {entries.length === 0 && (
        <div className="odyssey-calendar__empty">
          No entries yet. Click <b>+ New entry</b> to add your first one.
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Week computation                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

interface BarSegment {
  entry: Entry;
  /** Column index within the week, 0-6 inclusive. */
  startCol: number;
  endCol: number;
  /** True if the entry actually starts in this week (left end rounded). */
  isStart: boolean;
  /** True if the entry actually ends in this week (right end rounded). */
  isEnd: boolean;
  /** Assigned lane index, 0-based. */
  lane: number;
}

interface WeekData {
  days: Date[];
  /** Single-day entries, keyed by YYYY-MM-DD. */
  singleDayByDate: Map<string, Entry[]>;
  /** Multi-day bar segments that occupy this week. */
  bars: BarSegment[];
  /** Total number of lanes needed — drives reserved space in each cell. */
  laneCount: number;
}

function buildWeeks(cursor: Date, entries: Entry[]): WeekData[] {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  // Partition entries once.
  const singleDay: Entry[] = [];
  const multiDay: Entry[] = [];
  for (const e of entries) {
    if (e.endDate && e.endDate !== e.date) multiDay.push(e);
    else singleDay.push(e);
  }

  const weeks: WeekData[] = [];
  let weekStart = gridStart;
  while (!isAfter(weekStart, gridEnd)) {
    const weekEnd = addDays(weekStart, 6);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));

    // Single-day bucket (only keep those falling in this week)
    const singleDayByDate = new Map<string, Entry[]>();
    for (const e of singleDay) {
      const d = parseISO(e.date);
      if (isBefore(d, weekStart) || isAfter(d, weekEnd)) continue;
      if (!singleDayByDate.has(e.date)) singleDayByDate.set(e.date, []);
      singleDayByDate.get(e.date)!.push(e);
    }

    // Multi-day segments overlapping this week
    const raw: Omit<BarSegment, "lane">[] = [];
    for (const e of multiDay) {
      const s = parseISO(e.date);
      const t = parseISO(e.endDate!);
      if (isAfter(s, weekEnd) || isBefore(t, weekStart)) continue;

      const startCol = Math.max(0, differenceInCalendarDays(s, weekStart));
      const endCol = Math.min(6, differenceInCalendarDays(t, weekStart));
      const isStart = !isBefore(s, weekStart);
      const isEnd = !isAfter(t, weekEnd);
      raw.push({ entry: e, startCol, endCol, isStart, isEnd });
    }

    // Sort: earlier start first; ties broken by longer duration (longer bars
    // get lower lanes, which looks more natural).
    raw.sort((a, b) => {
      if (a.startCol !== b.startCol) return a.startCol - b.startCol;
      return b.endCol - b.startCol - (a.endCol - a.startCol);
    });

    // Greedy lane assignment.
    const laneEnds: number[] = []; // laneEnds[i] = last occupied col for lane i
    const bars: BarSegment[] = raw.map((seg) => {
      let lane = laneEnds.findIndex((end) => end < seg.startCol);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(seg.endCol);
      } else {
        laneEnds[lane] = seg.endCol;
      }
      return { ...seg, lane };
    });

    weeks.push({
      days,
      singleDayByDate,
      bars,
      laneCount: laneEnds.length,
    });

    weekStart = addDays(weekStart, 7);
  }

  return weeks;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  WeekRow                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface WeekRowProps {
  week: WeekData;
  monthCursor: Date;
  hoveredPath: string | null;
  onEntryClick: (entry: Entry) => void;
  onEntryHover: (path: string | null) => void;
  onNewEntry: (defaultDate?: string) => void;
  onDeleteEntry: (entry: Entry) => void;
}

const BAR_HEIGHT = 18; // px
const BAR_GAP = 2; // px
const DAYNUM_ROW = 22; // px — space reserved for the day number row at top

function WeekRow({
  week,
  monthCursor,
  hoveredPath,
  onEntryClick,
  onEntryHover,
  onNewEntry,
  onDeleteEntry,
}: WeekRowProps) {
  const barsAreaHeight =
    week.laneCount === 0
      ? 0
      : week.laneCount * BAR_HEIGHT + (week.laneCount - 1) * BAR_GAP;

  return (
    <div
      className="odyssey-week"
      style={{ ["--bars-height" as string]: `${barsAreaHeight}px` }}
    >
      {/* Layer 1: day cells */}
      <div className="odyssey-week__cells">
        {week.days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEntries = week.singleDayByDate.get(key) ?? [];
          const inMonth = isSameMonth(day, monthCursor);
          const today = isSameDay(day, new Date());
          return (
            <DayCell
              key={key}
              day={day}
              dateKey={key}
              entries={dayEntries}
              inMonth={inMonth}
              today={today}
              hoveredPath={hoveredPath}
              onEntryClick={onEntryClick}
              onEntryHover={onEntryHover}
              onNewEntry={onNewEntry}
              onDeleteEntry={onDeleteEntry}
            />
          );
        })}
      </div>

      {/* Layer 2: multi-day bars overlay, aligned to the same 7-column grid.
          Uses CSS grid — grid-column spans horizontally, grid-row picks the lane. */}
      {week.bars.length > 0 && (
        <div
          className="odyssey-week__bars"
          style={{
            top: `${DAYNUM_ROW}px`,
            height: `${barsAreaHeight}px`,
            gridAutoRows: `${BAR_HEIGHT}px`,
          }}
        >
          {week.bars.map((seg) => {
            const isHovered = hoveredPath === seg.entry.file.path;
            return (
              <div
                key={seg.entry.file.path + ":" + seg.startCol}
                className={
                  "odyssey-bar" +
                  (seg.isStart ? " is-start" : "") +
                  (seg.isEnd ? " is-end" : "") +
                  (isHovered ? " is-hovered" : "")
                }
                style={{
                  gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                  gridRow: `${seg.lane + 1}`,
                }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onEntryClick(seg.entry);
                }}
                onMouseEnter={() => onEntryHover(seg.entry.file.path)}
                onMouseLeave={() => onEntryHover(null)}
                title={`${seg.entry.title}${seg.entry.location ? " · " + seg.entry.location : ""}`}
                role="button"
                tabIndex={0}
              >
                <span className="odyssey-bar__label">
                  {seg.isStart ? seg.entry.title : `↳ ${seg.entry.title}`}
                </span>
                {/* Delete button shows on the *end* segment so it doesn't get cut off.
                    If the bar only occupies a start segment (rare), we show it there. */}
                {seg.isEnd && (
                  <DeleteButton
                    entry={seg.entry}
                    onDelete={onDeleteEntry}
                    variant="bar"
                  />
                )}
                {!seg.isEnd && seg.isStart && (
                  <DeleteButton
                    entry={seg.entry}
                    onDelete={onDeleteEntry}
                    variant="bar"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  DayCell                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface DayCellProps {
  day: Date;
  dateKey: string;
  entries: Entry[];
  inMonth: boolean;
  today: boolean;
  hoveredPath: string | null;
  onEntryClick: (entry: Entry) => void;
  onEntryHover: (path: string | null) => void;
  onNewEntry: (defaultDate?: string) => void;
  onDeleteEntry: (entry: Entry) => void;
}

function DayCell({
  day,
  dateKey,
  entries,
  inMonth,
  today,
  hoveredPath,
  onEntryClick,
  onEntryHover,
  onNewEntry,
  onDeleteEntry,
}: DayCellProps) {
  return (
    <div
      className={
        "odyssey-cell" +
        (inMonth ? "" : " is-out") +
        (today ? " is-today" : "")
      }
    >
      <div className="odyssey-cell__header">
        <span className="odyssey-cell__daynum">{format(day, "d")}</span>
        <button
          className="odyssey-cell__add"
          onClick={(ev) => {
            ev.stopPropagation();
            onNewEntry(dateKey);
          }}
          aria-label={`New entry on ${dateKey}`}
          tabIndex={-1}
        >
          +
        </button>
      </div>

      {/* Reserved space under the header for multi-day bars from the overlay */}
      <div
        className="odyssey-cell__bars-spacer"
        style={{ height: "var(--bars-height)" }}
      />

      <div className="odyssey-cell__entries">
        {entries.map((entry) => (
          <EntryPill
            key={entry.file.path}
            entry={entry}
            isHovered={hoveredPath === entry.file.path}
            onClick={() => onEntryClick(entry)}
            onHover={onEntryHover}
            onDelete={onDeleteEntry}
          />
        ))}
      </div>
    </div>
  );
}

function EntryPill({
  entry,
  isHovered,
  onClick,
  onHover,
  onDelete,
}: {
  entry: Entry;
  isHovered: boolean;
  onClick: () => void;
  onHover: (path: string | null) => void;
  onDelete: (entry: Entry) => void;
}) {
  const prefix = entry.startTime ? entry.startTime + " " : "";
  return (
    <div
      className={
        "odyssey-pill" +
        (entry.startTime ? " is-timed" : " is-allday") +
        (isHovered ? " is-hovered" : "")
      }
      onClick={onClick}
      onMouseEnter={() => onHover(entry.file.path)}
      onMouseLeave={() => onHover(null)}
      title={entryTooltip(entry)}
      role="button"
      tabIndex={0}
    >
      <span className="odyssey-pill__prefix">{prefix}</span>
      <span className="odyssey-pill__title">{entry.title}</span>
      <DeleteButton entry={entry} onDelete={onDelete} variant="pill" />
    </div>
  );
}

/**
 * Hover-reveal × button. Shared by pills and multi-day bars.
 * Stops propagation so clicking × doesn't also open the note.
 */
function DeleteButton({
  entry,
  onDelete,
  variant,
}: {
  entry: Entry;
  onDelete: (entry: Entry) => void;
  variant: "pill" | "bar";
}) {
  return (
    <button
      type="button"
      className={`odyssey-delete is-${variant}`}
      onClick={(ev) => {
        ev.stopPropagation();
        onDelete(entry);
      }}
      aria-label={`Delete ${entry.title}`}
      tabIndex={-1}
    >
      ×
    </button>
  );
}

function entryTooltip(entry: Entry): string {
  return entry.location ? `${entry.title} · ${entry.location}` : entry.title;
}
