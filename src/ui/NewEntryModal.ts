import { App, Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import { format } from "date-fns";
import { geocode, GeocodeError } from "../data/geocode";

const ODYSSEY_FOLDER = "Odyssey";

/**
 * The simplest possible Entry creation form.
 * Week 1 target: native Obsidian Modal, no custom styling.
 * Week 5 will replace this with a polished React form.
 */
export class NewEntryModal extends Modal {
  private date: string;
  private title: string = "";
  private location: string = "";
  private coords: string = ""; // e.g. "35.67, 139.69"
  private endDate: string = "";
  private startTime: string = "";
  private endTime: string = "";

  // Refs for live DOM updates from resolveLocation().
  private coordsInputEl: HTMLInputElement | null = null;
  private locationInputEl: HTMLInputElement | null = null;
  private feedbackEl: HTMLElement | null = null;
  private resolving = false;

  /**
   * @param defaultDate     ISO date (YYYY-MM-DD). If omitted, defaults to today.
   *                        Used by the hover-"+" buttons to prefill the clicked day.
   * @param defaultCoords   Optional lat/lng pair. Used by map drop-pin creation.
   */
  constructor(
    app: App,
    defaultDate?: string,
    defaultCoords?: { lat: number; lng: number },
  ) {
    super(app);
    this.date = defaultDate ?? format(new Date(), "yyyy-MM-dd");
    if (defaultCoords) {
      // Truncate to 6 decimals (~10 cm precision, plenty for life-logging).
      this.coords = `${defaultCoords.lat.toFixed(6)}, ${defaultCoords.lng.toFixed(6)}`;
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New Odyssey entry" });

    new Setting(contentEl)
      .setName("Title")
      .setDesc("What happened?")
      .addText((t) =>
        t.setPlaceholder("Coffee with Alex").onChange((v) => (this.title = v)),
      );

    new Setting(contentEl)
      .setName("Date")
      .setDesc("Required. YYYY-MM-DD")
      .addText((t) =>
        t.setValue(this.date).onChange((v) => (this.date = v.trim())),
      );

    contentEl.createEl("h4", { text: "Optional" });

    let locationInput: HTMLInputElement | null = null;
    let coordsInput: HTMLInputElement | null = null;

    new Setting(contentEl)
      .setName("Location")
      .setDesc("Free text. Leave empty if it doesn't apply.")
      .addText((t) => {
        t.setPlaceholder("Tokyo").onChange((v) => (this.location = v.trim()));
        locationInput = t.inputEl;
      });

    const coordsSetting = new Setting(contentEl)
      .setName("Coordinates")
      .setDesc(
        "Paste from Google Maps, or click Resolve to look up the location.",
      )
      .addExtraButton((b) =>
        b
          .setIcon("search")
          .setTooltip("Resolve location to coordinates (via OpenStreetMap)")
          .onClick(() => {
            void this.resolveLocation();
          }),
      )
      .addText((t) => {
        t.setPlaceholder("35.67, 139.69")
          .setValue(this.coords)
          .onChange((v) => (this.coords = v.trim()));
        coordsInput = t.inputEl;
      });

    this.coordsInputEl = coordsInput;
    this.locationInputEl = locationInput;

    // Feedback line under the coordinates setting — updated by resolveLocation().
    this.feedbackEl = coordsSetting.settingEl.createDiv({
      cls: "odyssey-modal__feedback",
    });

    new Setting(contentEl).setName("Start time").addText((t) =>
      t.setPlaceholder("14:00").onChange((v) => (this.startTime = v.trim())),
    );

    new Setting(contentEl)
      .setName("End date")
      .setDesc("Fill this to make a multi-day entry")
      .addText((t) =>
        t.setPlaceholder("YYYY-MM-DD").onChange((v) => (this.endDate = v.trim())),
      );

    new Setting(contentEl).setName("End time").addText((t) =>
      t.setPlaceholder("17:00").onChange((v) => (this.endTime = v.trim())),
    );

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText("Create")
          .setCta()
          .onClick(() => {
            void this.submit();
          }),
      )
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
  }

  private async submit() {
    if (!this.date || !this.title) {
      new Notice("Title and date are required");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.date)) {
      new Notice("Date must be in YYYY-MM-DD format");
      return;
    }
    if (this.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(this.endDate)) {
      new Notice("End date must be in YYYY-MM-DD format");
      return;
    }

    // Parse coordinates if provided
    let lat: number | undefined;
    let lng: number | undefined;
    if (this.coords) {
      const parts = this.coords.split(",").map((p) => p.trim());
      if (parts.length !== 2) {
        new Notice("Coordinates must be: latitude, longitude");
        return;
      }
      const pLat = parseFloat(parts[0]);
      const pLng = parseFloat(parts[1]);
      if (
        !Number.isFinite(pLat) ||
        !Number.isFinite(pLng) ||
        pLat < -90 ||
        pLat > 90 ||
        pLng < -180 ||
        pLng > 180
      ) {
        new Notice(
          "Invalid coordinates. Latitude must be -90..90, longitude -180..180",
        );
        return;
      }
      lat = pLat;
      lng = pLng;
    }

    try {
      await this.createEntryFile(lat, lng);
      this.close();
    } catch (e) {
      new Notice(`Failed to create entry: ${(e as Error).message}`);
    }
  }

  private async createEntryFile(lat?: number, lng?: number) {
    // Ensure folder exists
    const folder = this.app.vault.getAbstractFileByPath(ODYSSEY_FOLDER);
    if (!folder) {
      await this.app.vault.createFolder(ODYSSEY_FOLDER);
    }

    const slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40);
    const filename = `${this.date}-${slug || "entry"}.md`;
    const path = normalizePath(`${ODYSSEY_FOLDER}/${filename}`);

    // Avoid overwriting
    let finalPath = path;
    let counter = 2;
    while (this.app.vault.getAbstractFileByPath(finalPath)) {
      finalPath = normalizePath(
        `${ODYSSEY_FOLDER}/${this.date}-${slug || "entry"}-${counter}.md`,
      );
      counter++;
    }

    const fmLines: string[] = ["---", `date: ${this.date}`];
    if (this.startTime) fmLines.push(`start_time: "${this.startTime}"`);
    if (this.endDate) fmLines.push(`end_date: ${this.endDate}`);
    if (this.endTime) fmLines.push(`end_time: "${this.endTime}"`);
    if (this.location) fmLines.push(`location: ${JSON.stringify(this.location)}`);
    if (lat !== undefined) fmLines.push(`lat: ${lat}`);
    if (lng !== undefined) fmLines.push(`lng: ${lng}`);
    fmLines.push("---", "", `# ${this.title}`, "");

    const content = fmLines.join("\n");
    const file = await this.app.vault.create(finalPath, content);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
    }
  }

  /**
   * Look up the current Location value via Nominatim and write the best match
   * into the Coordinates field. Keeps the user in control by showing the
   * resolved address inline instead of silently committing.
   */
  private async resolveLocation() {
    if (this.resolving) return;

    // Read the latest Location value directly from the DOM in case the user's
    // change event hasn't fired yet (they may click Resolve immediately after
    // typing).
    const query = this.locationInputEl?.value.trim() ?? this.location;
    if (!query) {
      new Notice("Enter a location first");
      return;
    }

    this.resolving = true;
    this.setFeedback("Resolving…", "pending");

    const hadCoords = !!this.coords;

    try {
      const result = await geocode(query);
      const newCoords = `${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}`;
      this.coords = newCoords;
      if (this.coordsInputEl) {
        this.coordsInputEl.value = newCoords;
      }
      const prefix = hadCoords ? "✓ Replaced. Found: " : "✓ Found: ";
      this.setFeedback(prefix + result.displayName, "ok");
    } catch (e) {
      if (e instanceof GeocodeError) {
        this.setFeedback("× " + e.message, "error");
      } else {
        this.setFeedback(
          "× Unexpected error: " + (e as Error).message,
          "error",
        );
      }
    } finally {
      this.resolving = false;
    }
  }

  private setFeedback(text: string, kind: "pending" | "ok" | "error") {
    if (!this.feedbackEl) return;
    this.feedbackEl.setText(text);
    this.feedbackEl.className = `odyssey-modal__feedback is-${kind}`;
  }

  onClose() {
    this.contentEl.empty();
  }
}
