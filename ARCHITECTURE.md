# Unsolvable architecture

Unsolvable is a private, cloud-first full-stack application. The repository is intentionally a single deployable application today, with boundaries that can be moved into a monorepo later without rewriting the board domain.

Product-level route, account, learning, and collaboration decisions are recorded in [`docs/PRODUCT_ARCHITECTURE_DECISIONS.md`](docs/PRODUCT_ARCHITECTURE_DECISIONS.md).

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
- `lib/client` owns browser storage, canvas rendering, and HTTP gateways.
- `lib/server` owns request identity, application services, repository contracts, and infrastructure adapters.
- `app` contains delivery concerns: pages and HTTP/MCP route handlers.
- `components` compose UI state with domain functions and client adapters.
- `worker` is the Cloudflare runtime entry point.
- `db` owns the PostgreSQL schema and the Cloudflare-compatible Neon connection factory.

`tests/architecture.test.mjs` enforces the most important dependency rules.

## Current runtime adapters

Runtime providers stay behind replaceable boundaries:

| Capability | Contract or entry point | Current adapter | Planned cloud adapter |
| --- | --- | --- | --- |
| Board model | `lib/domain/board/model.ts` | Provider-independent | Same package |
| Board persistence | `lib/server/boards/board-repository.ts` | Neon PostgreSQL | Same contract, optional extracted API |
| Browser board sync | `lib/client/board/board-gateway.ts` | Versioned `/api/board` polling | HTTP bootstrap + Durable Object WebSocket |
| Browser recovery | `lib/client/board/local-board-store.ts` | `localStorage` | Keep as offline recovery |
| AI tool transport | `app/mcp/route.ts` | Provider-neutral Streamable HTTP MCP | Same protocol across compatible clients |
| Request identity | `lib/server/auth/*` | Neon Auth session | Same provider behind an extracted API if needed |
| Canvas | `lib/client/board/canvas-renderer.ts` | Canvas 2D | Same renderer fed by synchronized state |

Compatibility facades such as `lib/board-model.ts`, `lib/tutor-store.ts`, and `lib/request-user.ts` keep older board imports working while new code uses the layered paths.

## Board persistence flow

```text
TutorBoard
  -> BoardGateway
  -> /api/board
  -> board service
  -> BoardRepository
  -> PostgresBoardRepository
  -> Neon PostgreSQL
```

The repository maps the Neon Auth subject to an internal application user. Personal workspaces are provisioned idempotently on first save. Workspace and board memberships provide authorization independently from authentication.

## Tutor flow

Board actions are provider-independent commands. The MCP integration validates an action, compiles visual actions into board commands, and persists them with the same event-version rules used by browser edits. The browser observes the new version and renders it. The action queue remains only for transient effects such as speech.

The production AI adapter can replace the transport, but it must continue to emit the same validated domain commands. AI actions must not directly manipulate React state, Canvas APIs, or database rows.

## Authentication boundary

Routes use `lib/server/auth/request-identity.ts` instead of reading provider cookies directly. Server-rendered pages use `lib/server/auth/current-user.ts`. Only `lib/server/auth/neon.ts` configures Neon Auth and Cloudflare bindings.

Authentication establishes identity. Board ownership and collaboration roles remain separate application authorization checks.

Development and production use the same provider-neutral MCP authorization path. Codex, Claude, or another compatible client discovers Neon OAuth from protected-resource metadata and obtains an identity token whose audience is the exact MCP URL. PostgreSQL board membership determines effective board rights. The MCP route does not accept browser cookies, local-profile credentials, model-provider keys, or development bypass tokens. An agent acting on behalf of a user is limited by that user's board membership; future elevated agents require a separate principal and an explicit stored grant.

## Testing

Run the complete local verification suite with:

```bash
npm run check
```

The layers are tested as follows:

- Domain: deterministic unit tests without browser or cloud services.
- Architecture: dependency and adapter-boundary tests.
- Client adapters: deterministic tests with injected `fetch` and storage implementations.
- Repository adapter: a contract suite against an isolated Neon development branch.
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
