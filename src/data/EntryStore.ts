import { App, TFile, TFolder, Events } from "obsidian";
import type { Entry, EntryFrontmatter } from "./Entry";

const ODYSSEY_FOLDER = "Odyssey";

/**
 * EntryStore is the reactive data layer for Odyssey.
 *
 * Responsibilities:
 *   1. Scan the Odyssey/ folder and parse all .md files into Entry objects.
 *   2. Listen to vault events (create/modify/delete/rename) and update incrementally.
 *   3. Emit "change" events so views can re-render.
 *
 * It uses Obsidian's built-in metadata cache — we do NOT parse frontmatter manually.
 * This is important because the cache is already kept in sync by Obsidian itself.
 */
export class EntryStore extends Events {
  private app: App;
  private entries: Map<string, Entry> = new Map(); // key: file path

  constructor(app: App) {
    super();
    this.app = app;
  }

  /**
   * Full scan — call once at plugin load.
   */
  async loadAll(): Promise<void> {
    this.entries.clear();
    const folder = this.app.vault.getAbstractFileByPath(ODYSSEY_FOLDER);
    if (!(folder instanceof TFolder)) {
      // Folder doesn't exist yet. That's fine — we'll create it on first entry.
      this.trigger("change");
      return;
    }
    this.walkFolder(folder);
    this.trigger("change");
  }

  private walkFolder(folder: TFolder): void {
    for (const child of folder.children) {
      if (child instanceof TFolder) {
        this.walkFolder(child);
      } else if (child instanceof TFile && child.extension === "md") {
        const entry = this.parseFile(child);
        if (entry) this.entries.set(child.path, entry);
      }
    }
  }

  /**
   * Parse a single file into an Entry using Obsidian's metadata cache.
   * Returns null if the file lacks the required `date` field.
   * Location is optional — entries without it appear on the calendar but not the map.
   */
  private parseFile(file: TFile): Entry | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = (cache?.frontmatter ?? {}) as EntryFrontmatter;

    if (!fm.date) {
      return null; // not a valid Odyssey entry
    }

    const title = this.deriveTitle(file, cache?.headings);

    return {
      file,
      date: fm.date,
      startTime: fm.start_time,
      endDate: fm.end_date,
      endTime: fm.end_time,
      location: fm.location,
      lat: typeof fm.lat === "number" ? fm.lat : undefined,
      lng: typeof fm.lng === "number" ? fm.lng : undefined,
      title,
    };
  }

  private deriveTitle(
    file: TFile,
    headings?: { heading: string; level: number }[],
  ): string {
    // Prefer first H1 if present
    const h1 = headings?.find((h) => h.level === 1);
    if (h1) return h1.heading;

    // Fall back to filename minus the leading date prefix (YYYY-MM-DD-)
    const basename = file.basename;
    const match = basename.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
    if (match) return match[1].replace(/-/g, " ");
    return basename;
  }

  /**
   * Handle a single file changing. Called from main.ts via vault event hooks.
   */
  handleFileChange(file: TFile): void {
    if (!file.path.startsWith(ODYSSEY_FOLDER + "/")) return;
    if (file.extension !== "md") return;

    const entry = this.parseFile(file);
    if (entry) {
      this.entries.set(file.path, entry);
    } else {
      this.entries.delete(file.path);
    }
    this.trigger("change");
  }

  handleFileDelete(path: string): void {
    if (this.entries.delete(path)) {
      this.trigger("change");
    }
  }

  handleFileRename(file: TFile, oldPath: string): void {
    this.entries.delete(oldPath);
    this.handleFileChange(file);
  }

  /**
   * Get all entries as an array, sorted by date ascending.
   */
  getAll(): Entry[] {
    return Array.from(this.entries.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  /**
   * Subscribe to data changes. Returns an unsubscribe function.
   */
  subscribe(callback: () => void): () => void {
    const ref = this.on("change", callback);
    return () => this.offref(ref);
  }
}
