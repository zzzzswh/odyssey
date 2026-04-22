import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { EntryStore } from "./data/EntryStore";
import { ViewSync } from "./data/ViewSync";
import { CalendarItemView, VIEW_TYPE_CALENDAR } from "./ui/CalendarItemView";
import { MapItemView, VIEW_TYPE_MAP } from "./ui/MapItemView";
import { NewEntryModal } from "./ui/NewEntryModal";

/**
 * Odyssey — your life is an Odyssey.
 *
 * Week 2 scope (current):
 *   - Map view (MapLibre GL JS, CartoDB Positron tiles)
 *   - Entries with lat/lng appear as markers
 *   - Click marker → popup with title/date/location + "Open note"
 *
 * Earlier (Week 1):
 *   - EntryStore, calendar, modal, hover-"+"
 *
 * Roadmap ahead:
 *   Week 3: auto-geocoding (Nominatim), calendar↔map linking
 *   Week 4: Replay mode (fly-to + cumulative trail)
 *   Week 5: visual polish
 */
export default class OdysseyPlugin extends Plugin {
  store!: EntryStore;
  sync!: ViewSync;

  onload() {
    // 1. Data layer
    this.store = new EntryStore(this.app);
    this.sync = new ViewSync();

    this.app.workspace.onLayoutReady(() => {
      this.store.loadAll();
    });

    // 2. Vault event hooks
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) this.store.handleFileChange(file);
      }),
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file instanceof TFile) this.store.handleFileChange(file);
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        this.store.handleFileDelete(file.path);
      }),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) this.store.handleFileRename(file, oldPath);
      }),
    );

    // 3. Views
    this.registerView(
      VIEW_TYPE_CALENDAR,
      (leaf) => new CalendarItemView(leaf, this.store, this.sync),
    );
    this.registerView(
      VIEW_TYPE_MAP,
      (leaf) => new MapItemView(leaf, this.store, this.sync),
    );

    // 4. Commands
    this.addCommand({
      id: "new-entry",
      name: "New entry",
      callback: () => new NewEntryModal(this.app).open(),
    });

    this.addCommand({
      id: "open-calendar",
      name: "Open calendar",
      callback: () => {
        void this.activateView(VIEW_TYPE_CALENDAR);
      },
    });

    this.addCommand({
      id: "open-map",
      name: "Open map",
      callback: () => {
        void this.activateView(VIEW_TYPE_MAP);
      },
    });

    // 5. Ribbon icons
    this.addRibbonIcon("calendar", "Odyssey calendar", () => {
      void this.activateView(VIEW_TYPE_CALENDAR);
    });
    this.addRibbonIcon("map", "Odyssey map", () => {
      void this.activateView(VIEW_TYPE_MAP);
    });
  }

  /**
   * Open (or reveal) a registered view in a tab.
   */
  async activateView(type: string) {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(type);

    let leaf: WorkspaceLeaf | null;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type, active: true });
    }
    workspace.revealLeaf(leaf);
  }
}
