# Nyx

Nyx is the local-development name of the Unsolvable AI tutor.

The name comes from Nyx, the primordial personification of night in Greek mythology. This project may use the name and that mythological inspiration freely for product copy, visual design, interaction concepts, internal identifiers, and other creative or technical work.

Task files given to Nyx are private board-scoped context. They are not drawn on the whiteboard and uploading one must not make Nyx answer. Nyx reads a new task description once through the read-only MCP context tool and retains it in the board's AI conversation.

The local runner defaults to `gpt-5.6-luna` with low reasoning effort for interactive latency. Set the `NYX_MODEL` or `NYX_REASONING_EFFORT` process environment variable before running `npm run dev:tutor` to test another profile without changing the user's global Codex configuration.
