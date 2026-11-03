# Architecture

## 1. Codex integration boundary

Unsolvable has a local Codex CLI bridge and a Site-hosted MCP server. Local development starts Codex from the board using the existing host sign-in and passes the board MCP endpoint to the turn. Publishing `.openai/hosting.json` with `"capabilities": ["mcp"]` creates the owner's private plugin for hosted use.

The stateless `POST /mcp` route implements protocol version `2026-07-28`: `server/discover`, `tools/list`, and `tools/call`.

Sites authenticates hosted calls before forwarding them. The route uses `oai-authenticated-user-id` to select the same D1 board record used by the signed-in browser. Local preview uses a loopback-only identity and the local bridge runs Codex CLI with the existing host sign-in. No API key or copied ChatGPT credential is involved.

## 2. Durable shared state

`tutor_boards` stores the active board JSON, a bounded PNG snapshot, event version, and last MCP activity per Site-scoped user. `tutor_actions` is an ordered Codex-to-browser action queue. Browser writes are same-origin, size-bounded, and authenticated.

The browser polls for new actions and applies them through the same renderer used for student work. The current implementation supports one active board per Site user; `boardId` keeps action routing explicit and allows a future multi-board index.

## 3. Board model and drawing

Every mark is a `Stroke` containing time-ordered `(x, y, pressure, t)` samples, style, author, timestamps, optional semantic metadata, and a stable ID. Selection, movement, erasure, undo/redo, persistence, hit-testing, and Codex references all operate on those objects.

Codex can request bounded semantic templates such as axes, parabola, free-body diagram, projectile, phasor, energy bars, or series circuit. `lib/trajectory-generator.ts` owns the actual trajectories, pressure variation, glyphs, and arrows. Finished AI work remains editable.

`board_write_equation` uses the same editable pen strokes to handwrite a correction. The client places it near the referenced mistake in free space. A Script Simplex stroke font preserves lowercase letters, and the math layout raises powers, lowers subscripts, and stacks fractions. Numeric corrections are checked before queueing, so a false arithmetic equation is refused.

## 4. Observation and correctness

`observe_board` returns a compact multipage scene graph with exact stroke IDs, viewport, and the latest canvas PNG. The model uses `verify_math_step` for transformations and `verify_arithmetic_equation` for numeric equalities. Unsupported notation returns `unknown` rather than guessing.

Visual actions are validated against known stroke IDs. Drawing templates, anchors, scales, label counts, speech length, and confidence values are bounded before they enter the queue.

## 5. Voice and scheduling

Speech recognition and synthesis use browser Web Speech. Drawing narration begins with trajectory animation, and local interruption cancels speech and the remaining animation while preserving completed marks.

MCP is request-driven. In local mode, the board asks the loopback bridge to start a Codex turn; the turn calls `observe_board` and board tools. A published Site MCP connection still needs an active Codex chat because the Site cannot initiate turns by itself.
