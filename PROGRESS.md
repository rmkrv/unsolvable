# Progress

Updated: 2026-11-03

## Completed

- [x] Infinite pressure-aware canvas with pen, highlighter, eraser, pan, selection, move, zoom, undo/redo, and multiple pages.
- [x] One editable stroke model for student and AI marks.
- [x] Semantic trajectory generation and incremental drawing animation.
- [x] Browser speech recognition/synthesis and local interruption.
- [x] Deterministic polynomial transformation and root verification.
- [x] Authenticated D1 board state and ordered action queue.
- [x] Site MCP `2026-07-28` discovery, list, and call routes.
- [x] Eight Codex tools: observe, two verifiers, feedback, handwriting, diagram drawing, erase, and speak.
- [x] Arithmetic correction flow that underlines the mistaken stroke and handwrites a verified equation in free space.
- [x] Readable stroke handwriting for uppercase/lowercase letters and numerals, with mathematical superscripts, subscripts, fractions, and integral notation.
- [x] User-facing Codex plugin connection dialog.
- [x] One-button Codex deep-link flow with a prefilled Unsolvable plugin chat.
- [x] Removal of the local `codex app-server` launcher and port 8789 dependency.
- [x] Local Streamable HTTP MCP initialization for Codex's Add server interface.
- [x] Non-passive native wheel listener for canvas zoom and pan.
- [x] Local Codex CLI bridge with automatic executable discovery and inherited ChatGPT sign-in.
- [x] Board-triggered Codex turns with per-run MCP configuration and cancellation.
- [x] English-only speech controller that waits for an English voice, replaces older utterances, and never falls back to a Russian voice.
- [x] Persisted action cursor to prevent old queued board speech from replaying after reload.
- [x] Browser Web Lock around queued action playback so two open board tabs do not speak the same reply.
- [x] Automated tests and successful Vinext production build.

## Live verification

- MCP discovery returned protocol `2026-07-28`.
- Tool listing returned all eight tools.
- `observe_board` returned structured multipage data and a PNG content block.
- A `board_say` call queued an action and the signed-in browser feed returned the same action ID.
- The board interface changed from **Connect Codex** to **Codex connected** after the first authenticated MCP tool call.
- An unsigned local loopback MCP client completed `initialize`, listed the tools, and verified the incorrect factorization.
- The live MCP route listed `verify_arithmetic_equation` and `board_write_equation`, accepted `1 + 2 = 3`, and refused `1 + 2 = 4` as a proposed correction.
- Historical local-bridge validation was completed, then the bridge was retired so development and production use the same OAuth-protected remote MCP path.
- Spoken tool text containing non-Latin letters remains rejected for an English retry.

## Scenario status

| Scenario | Status |
| --- | --- |
| A — incorrect equation | Supported: exact-stroke underline plus verified handwritten correction for numeric arithmetic. |
| B — correct equation | Supported: deterministic validity result plus concise feedback/speech action. |
| C — AI drawing | Supported: MCP semantic draw action becomes animated editable trajectories. |
| D — collaborative correction | Supported: student edits set `modifiedBy` and are included in the next observation. |
| E — long problem | Supported: all pages and exact stroke locations are included in observations. |
| F — alternative solution | Supported: Codex can draw a second semantic path at another anchor. |
| G — interruption | Partial: browser speech/drawing stops immediately; MCP cannot cancel a Codex turn from the Site. |

## Known limitations

- Published MCP alone cannot initiate Codex turns. Local mode starts Codex from the board through the CLI bridge.
- Handwriting recognition quality depends on Codex vision over the PNG snapshot. Deterministic verification covers bounded univariate polynomial algebra and numeric arithmetic; other notation needs model reasoning.
- The current schema keeps one active board per Site-scoped user.
- Hosted plugin installation and a real authenticated Codex call still require publishing the Site; local preview verifies the same MCP contract with Sites mock authentication.
- AI clients now connect explicitly to the remote MCP endpoint and complete Neon OAuth; no local Codex profile is detected or reused.
