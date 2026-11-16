# Task workspace design QA

## Evidence

- Source visual truth: `C:/Users/user/AppData/Local/Temp/codex-clipboard-4c132040-5f05-49a0-a260-fba2a43e3e21.png` (1,917 × 846 px). The source is a hand-drawn structural reference over the desktop whiteboard: a centered tasks panel, numbered answers, and a submit action.
- Browser-rendered implementation: `C:/Users/user/.codex/visualizations/2026/11/15/01a1e1a2-7b08-7ff1-86db-326e0a88cac6/task-workspace-implementation.jpg` (749 × 667 px).
- Full-view comparison: `C:/Users/user/.codex/visualizations/2026/11/15/01a1e1a2-7b08-7ff1-86db-326e0a88cac6/task-workspace-comparison.png`.
- Focused panel comparison: `C:/Users/user/.codex/visualizations/2026/11/15/01a1e1a2-7b08-7ff1-86db-326e0a88cac6/task-workspace-focused-comparison.png`.
- Browser viewport: 749 × 667 CSS px at the in-app browser's default density. The source and implementation use different viewport sizes, so the full view preserves each source's native aspect ratio and the focused comparison aligns the task-panel regions by height rather than claiming pixel-for-pixel equivalence.
- State: practice board with a three-question text task imported, task workspace open, all answers completed, progress full, and submit enabled.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: the implementation uses the product's existing sans-serif UI hierarchy, with a clear title, compact source-file label, readable prompts, and answer text sized consistently with the board controls.
- Spacing and layout rhythm: the task workspace is centered over the board, uses a vertically scrollable answer region, keeps the submit action anchored in the footer, and preserves the numbered-row structure from the sketch. At a 700 × 700 responsive viewport the dialog measured 512 × 614 px with no horizontal overflow.
- Colors and visual tokens: the panel uses the existing shadcn neutral tokens and product blue for progress and focus. The dimmed whiteboard remains visible enough to preserve context without competing with the task.
- Image quality and assets: the reference does not require custom imagery. Existing Lucide icons remain sharp and consistent with the product's current icon set. Image-only task imports use the actual uploaded task image rather than a placeholder.
- Copy and content: `Tasks`, numbered prompts, answer fields, completion progress, source filename, and `Submit answers` map directly to the requested structure. The additional Nyx-checking note explains the existing submission behavior.

## Interaction verification

- Imported a three-question text task through the existing **Give task to Nyx** action.
- Confirmed the task workspace opens automatically after a successful import and can be reopened from the new header **Tasks** control.
- Confirmed numbered prompts are derived from the imported task text.
- Confirmed submit remains disabled until all three answers are filled, progress updates to `3 of 3 answered`, and submit then enables.
- Confirmed submit closes the dialog immediately while the existing Nyx request continues, and the header task control remains available.
- Confirmed the browser console contained no errors or warnings during the tested flow.

## Comparison history

- Earlier interaction issue: the dialog stayed in `Submitting…` until Nyx completed its response. Fixed by dispatching the existing Nyx turn without blocking dialog closure; the browser retest confirmed immediate closure after submission.
- No visual P0/P1/P2 correction loop was needed after the first rendered comparison.

## Implementation checklist

- [x] Use shadcn primitives rather than daisyUI for the new task UI.
- [x] Reuse the existing board-scoped task description and Nyx submission flow.
- [x] Add a compact header entry point.
- [x] Open the workspace automatically after import.
- [x] Render numbered task prompts and answer inputs.
- [x] Support image-only tasks with the original task image.
- [x] Show completion progress and validate submission.
- [x] Verify type checking, tests, lint, production build, browser rendering, interactions, responsive layout, and console output.

## Follow-up polish

- None required for this pass.

final result: passed
