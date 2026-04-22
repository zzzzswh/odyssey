import type { TFile } from "obsidian";

/**
 * An Entry is a single life event with one location and a time span.
 * Time span can be a single day, a single-day time block, or a multi-day range.
 *
 * The plugin auto-detects rendering mode:
 *   - date only                   → all-day card
 *   - date + start_time (same day) → time block
 *   - date + end_date (different)  → multi-day bar
 */
export interface Entry {
  /** Obsidian file reference — source of truth for the entry */
  file: TFile;

  /** ISO date string: "2024-05-15" */
  date: string;

  /** Optional start time: "14:00" */
  startTime?: string;

  /** Optional end date (ISO). If absent, entry is same-day. */
  endDate?: string;

  /** Optional end time: "17:00" */
  endTime?: string;

  /** Optional location as free text. Entries without location won't appear on the map. */
  location?: string;

  /** Optional latitude. Only entries with both lat AND lng appear on the map. */
  lat?: number;

  /** Optional longitude. Only entries with both lat AND lng appear on the map. */
  lng?: number;

  /** Display title — derived from filename or first H1 */
  title: string;
}

/**
 * The rendering form of an Entry — derived, not stored.
 */
export type EntryForm = "all-day" | "time-block" | "multi-day";

export function getEntryForm(entry: Entry): EntryForm {
  if (entry.endDate && entry.endDate !== entry.date) {
    return "multi-day";
  }
  if (entry.startTime) {
    return "time-block";
  }
  return "all-day";
}

/**
 * Raw frontmatter shape we parse from .md files.
 * All fields are optional here — validation happens when constructing an Entry.
 */
export interface EntryFrontmatter {
  date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  location?: string;
  lat?: number;
  lng?: number;
}
