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
| Account profile | `lib/server/accounts/account-repository.ts` | Neon PostgreSQL | Same contract |
| Student summaries | `lib/server/students/student-summary-repository.ts` | Neon PostgreSQL | Same contract |
| Parent links | `lib/server/parents/parent-link-repository.ts` | Neon PostgreSQL | Same contract |
| Billing ownership and entitlements | `lib/server/billing/billing-repository.ts` | Neon PostgreSQL | Payment-provider adapter behind the billing service |
| Administration and audit | `lib/server/admin/*` | Neon PostgreSQL | Same internal-only boundary |
| Browser board sync | `lib/client/board/board-gateway.ts` | Versioned `/api/student/boards/*` polling | HTTP bootstrap + Durable Object WebSocket |
| Browser recovery | `lib/client/board/local-board-store.ts` | `localStorage` | Keep as offline recovery |
| AI tool transport | `app/mcp/route.ts` | Provider-neutral Streamable HTTP MCP | Same protocol across compatible clients |
| Request identity | `lib/server/auth/*` | Neon Auth session | Same provider behind an extracted API if needed |
| Canvas | `lib/client/board/canvas-renderer.ts` | Canvas 2D | Same renderer fed by synchronized state |

Compatibility facades such as `lib/board-model.ts`, `lib/tutor-store.ts`, and `lib/request-user.ts` keep older board imports working while new code uses the layered paths.

## Board persistence flow

```text
TutorBoard
  -> BoardGateway
  -> /api/student/boards/[boardId]
  -> role-aware Viewer
  -> board service
  -> BoardRepository
  -> PostgresBoardRepository
  -> Neon PostgreSQL
```

The request boundary resolves the Neon Auth subject to one role-aware application `Viewer`. Domain services and repositories receive only the internal application user ID. Personal workspaces are provisioned idempotently on first save. Workspace and board memberships provide authorization independently from authentication.

Canonical board pages use `/boards/[boardId]`. Browser reads include that explicit board ID, and successful opens upsert `user_board_activity`, so Home recents are per-user rather than reordered by a collaborator's edit. `/boards/current` is only a convenience redirect to the most recently opened authorized board, creating one when the workspace is empty.

## Account and learning data

Neon Auth owns credentials, sessions, primary email, password changes, and reset tokens. The application database owns account roles, `user_profiles`, parent-student links, billing ownership and entitlements, collaboration records, practice evidence, and derived skill mastery. Profile, billing, student, parent, and admin reads go through focused services; React pages and route handlers never query PostgreSQL directly.

## Account roles and authorization

Every application account has exactly one role: `student`, `parent`, or `admin`. Public onboarding may select only `student` or `parent`; established role changes and every admin grant or revocation require an audited admin operation. The model has no age, birth-date, minor, consent, or guardianship behavior.

Authorization combines independent dimensions:

1. role capability (`student`, `parent`, or `admin`);
2. an active parent-student relationship for parent summary access;
3. resource ownership or membership for billing accounts, boards, and workspaces.

A parent relationship does not grant billing access, and paying for a beneficiary does not grant learning-data access. Parent APIs expose bounded attendance and performance aggregates only—never raw boards or private tutor conversations. Admins use dedicated `/api/admin/*` endpoints and do not silently bypass customer services.

Billing is split into `billing_accounts` (owner), `subscriptions` (provider plan state), and `subscription_entitlements` (beneficiary). Only an account owner may manage provider billing details. Entitlement responses never expose provider identifiers or invoices belonging to another user.

Provider-dependent operations remain explicit boundaries: avatar bytes need object storage, billing management needs a selected payment provider, recovery email needs a verified auth factor, and account deletion needs a retention/cancellation policy. The UI does not simulate these operations while those decisions are open.

## Tutor flow

Board actions are provider-independent commands. The MCP integration validates an action, compiles visual actions into board commands, and persists them with the same event-version rules used by browser edits. The browser observes the new version and renders it. The action queue remains only for transient effects such as speech.

The production AI adapter can replace the transport, but it must continue to emit the same validated domain commands. AI actions must not directly manipulate React state, Canvas APIs, or database rows.

## Authentication boundary

Routes use `lib/server/auth/viewer-service.ts` instead of reading provider cookies directly. Server-rendered pages resolve the same viewer and enforce their required role before loading data. Only `lib/server/auth/neon.ts` configures Neon Auth and Cloudflare bindings.

Authentication establishes identity. Typed policy failures distinguish missing authentication, wrong role, forbidden resources, hidden resources, and conflicts, and map consistently to `401`, `403`, `404`, and `409` API responses.

Development and production use the same provider-neutral MCP authorization path. Codex, Claude, or another compatible client discovers Neon OAuth from protected-resource metadata and obtains an identity token whose audience is the exact MCP URL. The MCP subject resolves to a `student` viewer, and PostgreSQL board membership determines effective board rights. Parent and admin accounts cannot acquire board capabilities through MCP. The route does not accept browser cookies, local-profile credentials, model-provider keys, or development bypass tokens.

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
