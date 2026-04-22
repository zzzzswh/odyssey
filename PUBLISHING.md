# Publishing Odyssey to the Obsidian community store

This is a step-by-step checklist to go from "code on my machine" to "plugin
that anyone can install from Obsidian's Browse plugins screen". Follow in order.

**Estimated time: 30–60 minutes.** The plugin is ready; you just need to:

1. Personalize the metadata
2. Push to GitHub
3. Cut a release
4. Open one pull request to Obsidian's registry
5. Wait for a reviewer

---

## Before you start

You need:

- [ ] A GitHub account
- [ ] `git` installed locally
- [ ] Node.js 18+
- [ ] Admin access on your own GitHub (no enterprise restrictions)

Optional but strongly recommended:

- [ ] A few screenshots of Odyssey running — calendar, map, and a replay still

---

## Step 1 — Personalize the metadata

Open these files and do a **global find/replace** for the placeholders:

### `manifest.json`

Replace:
- `YOUR_NAME_HERE` → your display name (e.g., "Jane Doe" or your handle)
- `YOUR_GITHUB_USERNAME` → your GitHub username

### `LICENSE`

Replace `YOUR_NAME_HERE` with your name.

### `README.md`

Replace every `YOUR_GITHUB_USERNAME` with your GitHub username.

### Think about the plugin `id`

The current `id` is `"odyssey"`. Obsidian requires this to be globally unique
across all community plugins.

**Before proceeding**, go to
https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json
and **search for `"id": "odyssey"`** (case-sensitive). If there's already a
plugin using this id, you need to pick something else. Common safe
alternatives:

- `odyssey-md`
- `life-odyssey`
- `odyssey-life-log`
- Your own twist

**If you change the id**, update it in **three** places:
- `manifest.json` → `id`
- `package.json` → `name`
- The eventual PR to obsidian-releases (see Step 5)

The plugin will still be *called* "Odyssey" visually — `name` and `id` are
different things.

---

## Step 2 — Create the GitHub repo

```bash
cd /path/to/your/odyssey-folder
git init
git add .
git commit -m "Initial release: Odyssey v1.0.0"
git branch -M main
```

Then on GitHub.com:

1. Create a new **public** repository named `odyssey` (or whatever matches your
   plugin id — they don't have to match but it's cleaner if they do)
2. **Don't** initialize it with a README/LICENSE/.gitignore (you already have
   those)
3. Copy the URL it gives you, then:

```bash
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/odyssey.git
git push -u origin main
```

---

## Step 3 — Cut your first release via Git tag

The workflow in `.github/workflows/release.yml` triggers automatically when
you push a version tag. The tag must match the `version` in `manifest.json`
**exactly** — no `v` prefix.

```bash
git tag 1.0.0
git push origin 1.0.0
```

Within ~2 minutes:

1. Go to your repo's **Actions** tab → watch the workflow run
2. If it succeeds, go to **Releases** → you'll see a **draft** release called
   `1.0.0` with three files attached: `main.js`, `manifest.json`, `styles.css`
3. Click the draft → **Edit** → write a brief release note, then click
   **Publish release**

Why draft first? So you can review the attached files and the release
notes before users can see it. Once published, it's what the Obsidian client
downloads when someone installs your plugin.

**Sanity check** — open the published release page and confirm all three
files (`main.js`, `manifest.json`, `styles.css`) are listed as assets. If
`styles.css` is missing, the community-plugins review will reject.

---

## Step 4 — Test it by installing from your own release

Before submitting to Obsidian's registry, prove to yourself it installs
cleanly **from a fresh vault**:

1. Create a new empty Obsidian vault (File → New vault)
2. Settings → Community plugins → turn off Restricted mode
3. Manually create the folder `<new-vault>/.obsidian/plugins/odyssey/`
4. Download `main.js`, `manifest.json`, `styles.css` from your GitHub release
5. Drop them in the folder
6. Restart Obsidian, enable the plugin
7. Create a few entries, open the map, try replay

If any of this fails, **do not submit yet**. Fix, bump to `1.0.1`, re-tag,
re-release.

---

## Step 5 — Submit to the Obsidian community plugins registry

This is the one PR you have to make.

1. Go to https://github.com/obsidianmd/obsidian-releases
2. Click **Fork** (top-right)
3. In your fork, open `community-plugins.json`
4. Click **Edit** (pencil icon)
5. Scroll to the **very bottom** of the file
6. Add a comma after the last entry's `}`, then add your entry:

```json
  {
    "id": "odyssey",
    "name": "Odyssey",
    "author": "YOUR_NAME_HERE",
    "description": "Visualize your life events on a silky calendar and a beautiful map. Replay your journey.",
    "repo": "YOUR_GITHUB_USERNAME/odyssey"
  }
]
```

Notes:
- **`id`** must match your `manifest.json` id exactly
- **`repo`** is `username/repo-name`, not a full URL
- **No trailing comma** after this last entry
- The closing `]` of the top-level array stays at the very end

7. Commit message: `Add Odyssey plugin`
8. Click **Create pull request** → you'll see a checklist template. **Switch
   the editor to Preview mode** and fill every checkbox. Key items:
   - [ ] I have tested the plugin on Windows / macOS / Linux (check whichever
     you tested)
   - [ ] My GitHub release contains `main.js`, `manifest.json`, and `styles.css`
   - [ ] My release tag matches `manifest.json` version, no `v` prefix
   - [ ] I have a README
   - [ ] I have a LICENSE (MIT for us)
   - [ ] I have read and agree to the developer policies

9. Submit the PR.

---

## Step 6 — The review

An Obsidian team member (usually [Liam](https://github.com/liamcain)) will
review. Expect **1–4 weeks** depending on queue. They'll either merge it or
leave comments asking for changes.

Common first-submission feedback you might see (we've already handled most):

- "Don't modify `app.vault.adapter` directly" — ✅ we use TFile/TFolder
- "Use the correct CSS variable names" — ✅ we use `--background-primary` etc.
  (though our design system has its own `--ody-*` tokens on top)
- "Don't use `innerHTML`" — ⚠️ we use it **only** for popups we control; if
  they push back we'll switch to `createEl` chains
- "Don't use `console.log` in production" — ⚠️ we have two: `"Odyssey: loading"`
  and `"Odyssey: unloading"`; these are mild, but if they ask, remove them
- "Desktop only? mobile compat?" — ✅ `isDesktopOnly: false`. MapLibre does
  work on mobile; if reviewers surface mobile-specific bugs we'll fix them

If they ask for changes, you:
1. Fix locally, `git push` to your repo's `main`
2. Bump version in `manifest.json` and `versions.json` to `1.0.1`
3. `git tag 1.0.1 && git push origin 1.0.1`
4. Publish the release on GitHub
5. Comment on the PR: "Fixed in 1.0.1, please re-review"

You do **not** need to update the community-plugins.json entry unless
something structural changed (you renamed the repo, changed your username).

---

## Step 7 — After merge 🎉

Once the PR merges:

- Your plugin appears in **Settings → Community plugins → Browse** within
  an hour
- Users can install and update automatically
- You get download stats via https://obsidianstats.com

To ship updates:

1. Make your changes
2. Bump `manifest.json` → `version` and update `versions.json`
3. `git tag <new-version> && git push origin <new-version>`
4. Publish the GitHub release (auto-drafted by Actions)
5. Obsidian picks it up within an hour

**Users don't need any action** — Obsidian auto-updates.

---

## Things to consider (optional)

- **Screenshots**: add PNGs to `docs/` folder and reference them in README.
  The Obsidian plugin page doesn't render images from README yet (they're
  rendered as text links), but the GitHub page will look much more
  professional.
- **Funding link**: if you want donations, add `fundingUrl` to `manifest.json`:
  `"fundingUrl": "https://github.com/sponsors/YOUR_GITHUB_USERNAME"`
- **CHANGELOG.md**: worth maintaining from v1.0.0 onward so users can see
  what changed between updates
- **Issues**: make sure **Issues** are enabled on your repo — users will
  file bugs there

---

## Red flags that will delay your review

- Release tag has a `v` prefix (use `1.0.0` not `v1.0.0`)
- Release missing one of the three files (main.js, manifest.json, styles.css)
- `manifest.json` id doesn't match the PR entry id
- `manifest.json` at root of repo doesn't match the one in the release
- No LICENSE file
- README still has placeholder text (YOUR_NAME_HERE etc.)
- You push a tag but never publish the draft release (reviewers can't
  install drafts)

---

## Support

If you get stuck on any step:

- Official submission docs: https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Obsidian forum (friendly): https://forum.obsidian.md/c/developers-api/14
- Discord #plugin-dev channel: https://obsidian.md/community

Good luck. When it's live, come back and tell me the plugin ID so I know
you made it 🚀
