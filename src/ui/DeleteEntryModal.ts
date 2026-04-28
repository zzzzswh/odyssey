import { App, Modal, Notice, Setting } from "obsidian";
import type { Entry } from "../data/Entry";

/**
 * Asks the user to confirm before we send an entry to the system trash.
 * Kept minimal on purpose — the goal is a single beat of friction, not
 * a full dialog with options.
 */
export class DeleteEntryModal extends Modal {
  private entry: Entry;
  private onConfirm: () => Promise<void> | void;

  constructor(app: App, entry: Entry, onConfirm: () => Promise<void> | void) {
    super(app);
    this.entry = entry;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Delete entry?" });

    const p = contentEl.createEl("p");
    p.createEl("span", { text: "This will move " });
    p.createEl("b", { text: this.entry.title });
    p.createEl("span", {
      text: ` (${this.entry.date}) to the system trash. You can still recover it from there.`,
    });

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText("Delete")
          .setWarning()
          .onClick(() => {
            void this.confirmDelete();
          }),
      )
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
  }

  private async confirmDelete(): Promise<void> {
    try {
      await this.onConfirm();
      this.close();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      new Notice(`Failed to delete entry: ${message}`);
    }
  }
}
