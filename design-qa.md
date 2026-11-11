# Practice controls design QA

## Evidence

- Source visual truth: `C:/Users/user/AppData/Local/Temp/codex-clipboard-cc76ede9-4a8b-452e-89c5-2ebb92009979.png` (action-palette issue state, 773 × 530 px at 120 dpi), `codex-clipboard-2e080d62-7b40-4352-89cf-145b806350b6.png` (LeetCode clock-density reference, 268 × 193 px at 120 dpi), `codex-clipboard-b4d531e7-75ec-4c35-99c3-e06f72f2e1a3.png` (compact board-name target, 167 × 65 px at 120 dpi), and `codex-clipboard-f0c0690b-a26c-4cdc-be20-502c9e0d7597.png` (oversized rename issue state) in the same temp directory.
- Browser-rendered implementation: `C:/Users/user/.codex/visualizations/2026/11/11/01a1cc4a-f458-7670-af4e-53c8156ac46c/practice-palette-implementation.png` (749 × 667 px), `practice-timer-implementation.png` (749 × 667 px), and `board-title-edit-implementation.png` (1200 × 800 px) in the same evidence directory.
- Comparison evidence: `C:/Users/user/.codex/visualizations/2026/11/11/01a1cc4a-f458-7670-af4e-53c8156ac46c/practice-palette-comparison.png`, `practice-palette-focused-comparison.png`, `practice-timer-comparison.png`, and `board-title-comparison.png`.
- Browser viewport: 750 × 667 CSS px, device pixel ratio 1.25. Browser screenshots were normalized by the capture surface to approximately CSS-pixel dimensions. The source issue capture and implementation have different outer viewports, so the focused component regions were compared without upscaling either image.
- Additional title viewport: 1200 × 795 CSS px at device pixel ratio 1.0. The focused comparison uses a 190 × 65 crop beside the native 167 × 65 reference without scaling.
- State: practice board, action palette open with its first result selected; clock popover open in timer mode with the 25-minute preset selected; board-name input focused with its value selected.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: the implementation uses the product's existing UI font and shadcn hierarchy. Primary labels and muted descriptions remain readable in the selected state.
- Spacing and layout rhythm: the action palette is intentionally narrower and denser than the issue capture. The redundant keyboard-help footer is removed. The clock trigger is 38 × 32 CSS px and the open panel is 288 px wide. Board rename now stays inside a 176 × 52 CSS px header block with a 28 px-high input, so it no longer expands across the top bar.
- Colors and tokens: the previous near-black selected row was replaced by the shadcn accent/background and foreground token pair. Both the primary and secondary text retain contrast.
- Image quality and assets: no raster product imagery is involved. Existing Lucide icons remain sharp at the rendered sizes and are consistent with the current application icon set.
- Copy and content: action labels and descriptions are intact; the unwanted `↑↓ move / PgUp PgDn jump / Enter open` helper copy is absent.

## Interaction verification

- Typing `open` automatically selected `Open previous`, the first filtered result.
- PageDown moved selection to `Open board`; PageUp moved it back to `Open previous`.
- The stopwatch/timer mode switch, timer presets, and compact start/reset controls rendered correctly.
- Moving from the open clock to a distant board tool closed the popover and returned the trigger to `aria-expanded="false"`; the implementation uses a 48 px (about 3 rem) safety halo around the trigger and panel.
- Board rename exposes no save/cancel buttons. Enter saved `Calculus practice`; clicking the Actions control saved `Algebra practice` before opening the palette. Escape remains available to cancel.
- The current run produced no console errors. Two earlier development-overlay errors were from the stale hot-reload process and did not recur after the preview server was restarted.

## Comparison history

- Earlier P1: the selected action used a near-black fill, reducing secondary-text readability and visually overpowering the rest of the palette. Fixed with the shadcn accent tokens; post-fix evidence is in `practice-palette-focused-comparison.png`.
- Earlier P2: the keyboard-help footer consumed space without helping the normal workflow. Removed; post-fix evidence shows the list ending without the footer.
- Earlier P2: the clock required an explicit second toggle to close and occupied more top-bar attention than necessary. Replaced with a 38 × 32 trigger and distance-based dismissal; post-fix evidence is in `practice-timer-comparison.png` and the interaction check above.
- Earlier P1: board rename expanded into a large high-contrast field with detached confirmation buttons, overpowering the header and shifting adjacent controls. Replaced with a compact shadcn input in the existing title footprint; confirmation is now Enter or click-away. Post-fix evidence is in `board-title-comparison.png`.

## Implementation checklist

- [x] Use existing shadcn/ui primitives for the palette and clock popover.
- [x] Keep selected action text readable.
- [x] Remove the keyboard-help footer.
- [x] Preserve first-result selection and PageUp/PageDown navigation.
- [x] Auto-close the clock beyond the safe pointer distance.
- [x] Keep board rename compact and confirm through Enter or click-away without confirmation buttons.
- [x] Verify tests, type checking, lint, production build, browser rendering, interactions, and console.

## Follow-up polish

- None required for this pass.

final result: passed
