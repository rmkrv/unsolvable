# Some things are Unsolvable. Or are you just weak?

Unsolvable is an engineering whiteboard with a local Codex adapter. The student writes in the browser; Codex observes the board through Unsolvable's local MCP tools and sends validated speech, feedback, erasure, and semantic drawing actions back to the browser.

The local adapter starts Codex CLI only when the student requests help. It reuses the Codex sign-in on the computer. No OpenAI API key or MCP configuration in Codex Settings is needed.

## Local development

Requirements: Node.js 22.13 or newer, installed dependencies, and a local Codex CLI signed in with ChatGPT. Set `CODEX_BIN` to the absolute executable path if Codex is installed outside PATH and the Codex desktop installation directory.

```powershell
npm run dev:tutor
```

Open <http://127.0.0.1:5173/signin-with-chatgpt?return_to=%2F>. The local Sites adapter signs in as `seedy@sites.test`.

`npm run dev:tutor` prepares local D1 storage, starts the board on port 5173, and starts a loopback Codex bridge on an available port. Press **Check work** or send a message in the board to start a Codex turn. The bridge supplies Unsolvable's MCP endpoint to that turn automatically and reuses the host Codex login.

## Local connection

1. Run `npm run dev:tutor` and open the board at `http://127.0.0.1:5173/`.
2. Press **Check work** or type a request. Unsolvable calls the local Codex CLI and shows the result on the board.

If Codex is not signed in yet, run `codex login` once on the computer. The local MCP route accepts loopback Codex calls in development. Do not expose the development server beyond loopback.

Unsolvable accepts requests in the browser's recognition language, but Codex replies and speaks in English. Speech synthesis waits for a browser-available English voice and stays silent with a clear status message if none appears. New speech stops old speech. Browser tabs share an action cursor so a board reload or second tab does not replay spoken actions.

## Connect from Codex after publication

After the Site is published with the `mcp` capability:

1. Open Unsolvable in the browser and press **Connect Codex**.
2. Press **Open Unsolvable in Codex**.
3. If prompted, choose **Install** and **Connect**, then **Continue**.

The deep link opens a new Codex chat with Unsolvable already mentioned and its tutor prompt prefilled. The Site detects the first authenticated MCP call and changes its status to **Codex connected** automatically.

Sites authenticates `/mcp` requests and maps both the browser and plugin to the same Site-scoped user. No local MCP configuration, `codex mcp add`, or separate connector login is required.

The deployment must set `VECTOR_PLUGIN_ID` to the exact plugin ID returned by Sites after the first MCP publication. `/connect/codex` uses it to construct the supported `codex://new` deep link.

## MCP tools

- `observe_board` returns event version, requests, multipage stroke metadata, exact stroke IDs, and a PNG snapshot.
- `verify_math_step` deterministically checks supported polynomial transformations and roots.
- `verify_arithmetic_equation` checks whether a numeric equation is true.
- `board_feedback` queues a visual mark tied to existing stroke IDs.
- `board_write_equation` handwrites a checked correction in nearby free space as editable pen strokes. Lowercase letters, powers, subscripts, fractions, and common integral symbols use a handwriting stroke font.
- `board_draw` queues a semantic diagram rendered locally as editable pen trajectories.
- `board_write_text` places one short plain-text label at a board coordinate as grouped editable pen strokes.
- `board_draw_arrow` draws one grouped editable arrow between two board coordinates; it does not attach to other shapes.
- `board_erase` removes only identified AI/feedback work in the browser.
- `board_say` queues a short spoken response.

The MCP endpoint is `POST /mcp` and implements Sites MCP `2026-07-28` discovery, tool listing, and tool calls.

## Architecture

```text
student browser ── signed-in board sync ──> Site D1
       ^                                      │
       │ editable action queue                │ observe_board
       │                                      v
trajectory + browser speech <── /mcp tools ─ local Codex CLI
                                             ^
                                             │ triggered by board via loopback bridge
```

Every visible mark uses the same `Stroke` object with time-ordered points. Codex selects semantic templates and bounded anchors; the browser generates geometry, pressure variation, arrowheads, glyph strokes, and incremental animation. The model never supplies arbitrary pixel arrays.

The handwriting glyphs are derived from the MIT-licensed [p5-hershey-js](https://github.com/LingDong-/p5-hershey-js) Script Simplex font. The source data and license are in `vendor/hershey/`; `scripts/build-handwriting-font.mjs` produces the compact glyph module used by the browser.

## Important MCP limitation

The local bridge starts a Codex turn when the student requests help or when auto-observe triggers. The published Site MCP route alone cannot initiate a Codex turn; that mode still requires an active Codex chat.

## Verification

```powershell
npm test
npm run build
```

The tests cover invalid/correct algebra, equivalent equations, root checking, uncertain notation, action sanitization, exact-stroke filtering, and drawing bounds.
"# unsolvable" 
