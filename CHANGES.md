# Changes

## v1.0.3 — Manual "Step through" mode for Replay

Adds a user-driven mode to Replay alongside the existing auto-play. Born from
real-use feedback during demo recording: no matter how you tune the speed
presets, auto-play can't be the right pace for every transition — a
Beijing→Beijing hop wants to be fast while a Beijing→Vienna crossing wants to
breathe. Distance-adaptive pacing was considered and rejected (too clever,
too many edge cases). Manual advance cleanly solves the same problem: the
user owns the pacing, end of story.

### What's new

- **Mode picker on the Replay picker screen**: `▶ Play` (default, auto) or
  `👆 Step through` (manual). The Speed row dims when manual is selected —
  speed doesn't apply when there's no timer.
- **Manual-mode controls strip** replaces the auto-mode version while
  replaying: `◀ Prev` · progress bar · `n / N` · `Next ▶` · `×`.
- **Keyboard shortcuts in manual mode**: `Space` or `→` advance, `←` goes
  back, `Esc` exits. Auto mode keeps `Space` = pause/resume.
- **Camera flight is fixed at 2.5s in manual mode** (new `MANUAL_FLY_MS`
  constant). Independent of the Speed picker — the user owns pacing, we
  just make each transition feel smooth and deliberate.
- **Previous works correctly** — the trail and dots recompute from
  `stepIndex` on every change, so stepping backward un-accumulates the
  history visually.

### Why this matters beyond demo recording

Two genuinely different user experiences, neither a subset of the other:

- **Auto** = "play it back to me" — the ritual / contemplative mode,
  hands-off cinematic flyover.
- **Manual** = "let me walk through this" — focused review, pair-watching
  with someone else, narrated presentation.

### Files touched

- `src/ui/ReplayOverlay.tsx` — `mode` state, `MANUAL_FLY_MS`, `next()` /
  `prev()` handlers, mode-aware keyboard handler, picker mode row, controls
  strip branching
- `src/styles.css` — `.odyssey-replay__mode` row (mirrors speed row),
  `.odyssey-replay__speed.is-disabled` dimming, `.odyssey-replay__ctrl:disabled`

### Design choices worth flagging

- **No auto-mode-switch by timeline length.** Big timelines don't
  automatically flip to manual. Mode is about engagement preference, not
  data shape — 200 stops on 2× auto is a legitimate "overview" UX.
- **Prev animation is a real flyTo**, not a jump. Stepping backward feels
  like retracing, not teleporting.
- **Manual mode still runs through the `playing` phase.** We didn't add a
  new phase state — the auto-advance effect just no-ops when `mode` is
  manual. Simpler than a four-phase state machine, and the visual layers
  (trail, dots, current marker) are shared between modes without special
  cases.

---

## v1.0.2 — Replay pacing overhaul + body excerpts

### Behavior changes

**New Cinematic speed.** The speed picker is now Cinematic / Slow / Normal /
Fast (was Slow / Normal / Fast). Cinematic is 0.33× and intended for
reflective first-time use and demo recording.

**Retuned base pacing.** All speeds feel more deliberate; previous "Slow"
is roughly comparable to the new "Normal".

| Speed         | Dwell  | Fly    | Per-stop | 15-stop demo |
|---------------|-------:|-------:|---------:|-------------:|
| Cinematic     | 6.0 s  | 9.1 s  | 15.1 s   | 3 min 45 s   |
| Slow          | 4.0 s  | 6.0 s  | 10.0 s   | 2 min 30 s   |
| Normal        | 2.0 s  | 3.0 s  |  5.0 s   | 1 min 15 s   |
| Fast          | 1.0 s  | 1.5 s  |  2.5 s   |    ~38 s     |

- `DWELL_MS`: 500 → 2000. The dwell is where you read the title card.
- `FLY_MS_BASE`: 1800 → 3000. Camera has more weight, especially cross-continent.

**Title card now shows body excerpts.** Every stop includes the
first-paragraph excerpt of the note body (~220 chars, clipped to 4 lines).
Strips frontmatter + leading H1 + leading list markers. Loaded lazily via
`app.vault.cachedRead` when the picker opens — the picker UI doesn't block.

### Files touched

- `src/data/replay.ts` — `ReplaySpeed`, `SPEED_LABELS`
- `src/ui/ReplayOverlay.tsx` — constants, `extractExcerpt()`, lazy loader, `app` prop
- `src/ui/MapView.tsx`, `src/ui/MapItemView.ts` — thread `app` through
- `src/styles.css` — wider title card, slower fade, new `.odyssey-replay__excerpt`

---

## v1.0.1 — Obsidian review-bot fixes

Addressed all "Required" issues from the review bot plus both "Optional"
suggestions on the original v1.0.0 submission.

- Browser network request path → Obsidian requestUrl (User-Agent actually gets sent; no CORS)
- Removed runtime `<style>` injection — MapLibre CSS is now bundled into
  `styles.css` at build time via a new esbuild step
- Dropped `async` from every method that had no `await` inside
- All floating promises marked with `void`
- Sentence-case on every piece of UI text
- `eslint-disable-next-line` directives now carry rationale comments
- `map.getSource(id) as X | undefined` → generic `map.getSource<X>(id)`
- `vault.trash` → `fileManager.trashFile` (respects user's delete preference)
- Dropped unused `Popup` import

See the v1.0.1 section of this file's git history (or the original review
bot feedback) for the full list.
