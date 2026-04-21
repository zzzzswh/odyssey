import { Events } from "obsidian";

/**
 * Tiny cross-view event bus.
 *
 * Two independent signals:
 *   - `hover`: which entry path is being hovered right now (or null).
 *     Both views react to this by highlighting the corresponding pill/marker.
 *   - `focus`: a one-shot request to focus an entry (e.g. click pill → map
 *     flyTo, or click marker → calendar scroll to month). Emitted as an
 *     event rather than stored, because focus is an action not a state.
 *
 * The store is deliberately separate from EntryStore. EntryStore owns
 * "what entries exist"; this owns "what the user is attending to right now."
 */
export class ViewSync extends Events {
  private hoveredPath: string | null = null;

  getHovered(): string | null {
    return this.hoveredPath;
  }

  setHover(path: string | null) {
    if (this.hoveredPath === path) return;
    this.hoveredPath = path;
    this.trigger("hover", path);
  }

  /**
   * Request the other view to focus on this entry.
   * The emitter should also handle its own view's reaction (e.g. if calendar
   * clicks an entry, it opens the note AND emits focus → map flies to it).
   */
  requestFocus(path: string) {
    this.trigger("focus", path);
  }

  subscribeHover(cb: (path: string | null) => void): () => void {
    const ref = this.on("hover", cb);
    return () => this.offref(ref);
  }

  subscribeFocus(cb: (path: string) => void): () => void {
    const ref = this.on("focus", cb);
    return () => this.offref(ref);
  }
}
