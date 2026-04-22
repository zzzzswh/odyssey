import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import * as React from "react";
import { MapView } from "./MapView";
import type { EntryStore } from "../data/EntryStore";
import type { ViewSync } from "../data/ViewSync";
import type { Entry } from "../data/Entry";
import { NewEntryModal } from "./NewEntryModal";
import { DeleteEntryModal } from "./DeleteEntryModal";
import { VIEW_TYPE_CALENDAR } from "./CalendarItemView";

export const VIEW_TYPE_MAP = "odyssey-map";

export class MapItemView extends ItemView {
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
    return VIEW_TYPE_MAP;
  }

  getDisplayText(): string {
    return "Odyssey map";
  }

  getIcon(): string {
    return "map";
  }

  onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("odyssey-map-host");

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
      this.focusRequest = null;
    });
    this.render();
    return Promise.resolve();
  }

  onClose() {
    this.unsubscribe?.();
    this.unsubscribeHover?.();
    this.unsubscribeFocus?.();
    this.root?.unmount();
    this.root = null;
    return Promise.resolve();
  }

  private render() {
    if (!this.root) return;
    const entries = this.store.getAll();
    this.root.render(
      React.createElement(MapView, {
        entries,
        hoveredPath: this.hoveredPath,
        focusRequest: this.focusRequest,
        app: this.app,
        onEntryOpen: (e: Entry) => {
          void this.openEntry(e);
          this.sync.requestFocus(e.file.path);
        },
        onEntryHover: (path: string | null) => this.sync.setHover(path),
        onNewEntry: () => new NewEntryModal(this.app).open(),
        onNewEntryAt: (lat: number, lng: number) =>
          new NewEntryModal(this.app, undefined, { lat, lng }).open(),
        onDeleteEntry: (e: Entry) => this.deleteEntry(e),
        onSwitchToCalendar: () => {
          void this.switchTo(VIEW_TYPE_CALENDAR);
        },
        onSplitWithCalendar: () => {
          void this.splitWith(VIEW_TYPE_CALENDAR);
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

  private async switchTo(type: string) {
    await this.leaf.setViewState({ type, active: true });
  }

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
