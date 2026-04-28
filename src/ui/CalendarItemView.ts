import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import * as React from "react";
import { CalendarView } from "./CalendarView";
import type { EntryStore } from "../data/EntryStore";
import type { ViewSync } from "../data/ViewSync";
import type { Entry } from "../data/Entry";
import { NewEntryModal } from "./NewEntryModal";
import { DeleteEntryModal } from "./DeleteEntryModal";
import { VIEW_TYPE_MAP } from "./MapItemView";

export const VIEW_TYPE_CALENDAR = "odyssey-calendar";

/**
 * Obsidian ItemView that hosts the React calendar.
 *
 * We subscribe to EntryStore for data changes and re-render by passing new props.
 * React handles its own reconciliation — we just call root.render() on each change.
 */
export class CalendarItemView extends ItemView {
  private root: Root | null = null;
  private store: EntryStore;
  private sync: ViewSync;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeHover: (() => void) | null = null;
  private unsubscribeFocus: (() => void) | null = null;
  private hoveredPath: string | null = null;
  private focusRequest: string | null = null;

  constructor(leaf: WorkspaceLeaf, store: EntryStore, sync: ViewSync) {
    super(leaf);
    this.store = store;
    this.sync = sync;
  }

  getViewType(): string {
    return VIEW_TYPE_CALENDAR;
  }

  getDisplayText(): string {
    return "Odyssey calendar";
  }

  getIcon(): string {
    return "calendar";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("odyssey-calendar-host");

    const mount = container.createDiv();
    this.root = createRoot(mount);

    this.unsubscribe = this.store.subscribe(() => this.render());
    this.unsubscribeHover = this.sync.subscribeHover((path) => {
      this.hoveredPath = path;
      this.render();
    });
    this.unsubscribeFocus = this.sync.subscribeFocus((path) => {
      this.focusRequest = path;
      this.render();
      // clear the one-shot focus after the render so it doesn't re-trigger
      // on unrelated re-renders
      this.focusRequest = null;
    });
    this.render();
    await Promise.resolve();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribeHover?.();
    this.unsubscribeFocus?.();
    this.root?.unmount();
    this.root = null;
    await Promise.resolve();
  }

  private render() {
    if (!this.root) return;
    const entries = this.store.getAll();
    this.root.render(
      React.createElement(CalendarView, {
        entries,
        hoveredPath: this.hoveredPath,
        focusRequest: this.focusRequest,
        onEntryClick: (e: Entry) => {
          void this.openEntry(e);
          this.sync.requestFocus(e.file.path);
        },
        onEntryHover: (path: string | null) => this.sync.setHover(path),
        onNewEntry: (defaultDate?: string) =>
          new NewEntryModal(this.app, defaultDate).open(),
        onDeleteEntry: (e: Entry) => this.deleteEntry(e),
        onSwitchToMap: () => {
          void this.switchTo(VIEW_TYPE_MAP);
        },
        onSplitWithMap: () => {
          void this.splitWith(VIEW_TYPE_MAP);
        },
      }),
    );
  }

  private async openEntry(entry: Entry) {
    const file = entry.file;
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
    }
  }

  private deleteEntry(entry: Entry) {
    const file = entry.file;
    if (!(file instanceof TFile)) return;
    new DeleteEntryModal(this.app, entry, async () => {
      // Route through fileManager.trashFile so we respect the user's chosen
      // deletion style (system trash, vault-local .trash, or permanent delete).
      await this.app.fileManager.trashFile(file);
    }).open();
  }

  /**
   * Switch this leaf to another view type, so Calendar/Map toggle in place
   * instead of opening a second tab.
   */
  private async switchTo(type: string) {
    await this.leaf.setViewState({ type, active: true });
  }

  /**
   * Ensure the other view type is open alongside this one (split right).
   * If it's already open anywhere, just reveal it. Otherwise split this leaf.
   */
  private async splitWith(type: string) {
    const existing = this.app.workspace.getLeavesOfType(type);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const newLeaf = this.app.workspace.getLeaf("split", "vertical");
    await newLeaf.setViewState({ type, active: true });
  }
}
