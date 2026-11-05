# Unsolvable architecture

Unsolvable is a private, cloud-first full-stack application. The repository is intentionally a single deployable application today, with boundaries that can be moved into a monorepo later without rewriting the board domain.

## Dependency direction

```text
app + components
      |
      v
lib/client ---------> lib/domain <--------- lib/server
                           ^
                           |
                    provider contracts
```

- `lib/domain` owns board data, board operations, and tutor commands. It must not import React, Next.js, Cloudflare, databases, billing, authentication, or network clients.
- `lib/client` owns browser storage, canvas rendering, HTTP gateways, and tutor transports.
- `lib/server` owns request identity, application services, repository contracts, and infrastructure adapters.
- `app` contains delivery concerns: pages and HTTP/MCP route handlers.
- `components` compose UI state with domain functions and client adapters.
- `worker` is the Cloudflare runtime entry point.
- `db` owns the current physical schema. Schema migration to PostgreSQL is a separate infrastructure change.

`tests/architecture.test.mjs` enforces the most important dependency rules.

## Current runtime adapters

The refactor preserves the deployed behavior while placing it behind replaceable boundaries:

| Capability | Contract or entry point | Current adapter | Planned cloud adapter |
| --- | --- | --- | --- |
| Board model | `lib/domain/board/model.ts` | Provider-independent | Same package |
| Board persistence | `lib/server/boards/board-repository.ts` | D1 | Neon PostgreSQL |
| Browser board sync | `lib/client/board/board-gateway.ts` | `/api/board` polling | HTTP bootstrap + Durable Object WebSocket |
| Browser recovery | `lib/client/board/local-board-store.ts` | `localStorage` | Keep as offline recovery |
| Tutor transport | `lib/client/tutor/tutor-transport.ts` | Local Codex or hosted MCP | OpenAI Responses and Realtime APIs |
| Request identity | `lib/server/auth/*` | Sites authentication headers | Neon Auth session/JWT |
| Canvas | `lib/client/board/canvas-renderer.ts` | Canvas 2D | Same renderer fed by synchronized state |

Compatibility facades such as `lib/board-model.ts`, `lib/tutor-store.ts`, `lib/request-user.ts`, and `app/chatgpt-auth.ts` keep older imports working while new code uses the layered paths.

## Board persistence flow

```text
TutorBoard
  -> BoardGateway
  -> /api/board
  -> board service
  -> BoardRepository
  -> D1BoardRepository (current)
```

The Neon migration replaces only the final repository adapter and database schema. The page, canvas, client gateway, and route-level application behavior should not need to change.

## Tutor flow

Board actions are provider-independent commands. The current Codex/MCP integration validates an action, writes it to the action queue, and the browser applies it through the same renderer used for student work.

The production AI adapter will replace the transport and queue mechanism, but it must continue to emit the same validated domain commands. AI actions must not directly manipulate React state, Canvas APIs, or database rows.

## Authentication boundary

Routes use `lib/server/auth/request-identity.ts` instead of reading provider headers directly. Server-rendered pages use `lib/server/auth/current-user.ts`. The current implementation reads Sites headers; Neon Auth can replace those implementations without changing board services or UI components.

Authentication establishes identity. Board ownership and collaboration roles remain separate application authorization checks.

## Testing

Run the complete local verification suite with:

```bash
npm run check
```

The layers are tested as follows:

- Domain: deterministic unit tests without browser or cloud services.
- Architecture: dependency and adapter-boundary tests.
- Client adapters: deterministic tests with injected `fetch` and storage implementations.
- Repository adapters: a shared contract suite, first against D1 and later against Neon.
- Routes: integration tests for identity, validation, and error mapping.
- Product: staging smoke tests and browser end-to-end tests.

## Planned extraction path

Do not introduce a workspace until there are at least two independently deployed applications. When that threshold is reached, the current boundaries map to:

```text
apps/web                 <- app, components, worker
apps/api                 <- optional independently deployed API
packages/board-core      <- lib/domain/board
packages/tutor-protocol  <- lib/domain/tutor
packages/cloud           <- selected lib/server adapters; stays private
```

Public packages must never import `packages/cloud`. This preserves the option to open-source the board engine later without exposing production authentication, billing, data, or deployment code.
