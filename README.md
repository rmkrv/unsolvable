# Unsolvable

Unsolvable is a private, cloud-first engineering whiteboard. The web product uses Neon Auth, PostgreSQL, and a provider-neutral remote MCP endpoint. Development and production use the same OAuth authorization path.

## Local setup

Requirements: Node.js 22.13 or newer, npm, a Neon project, and the Neon CLI.

```powershell
npm install
neon link --project-id <project-id> --branch <development-branch> --no-env-pull -y
neon env pull --file .dev.vars
neon neon-auth domain add http://127.0.0.1:5173
```

The trusted-domain command is required because the local app uses `127.0.0.1`; Neon Auth's built-in localhost allowance does not cover that IP origin. Add a unique `NEON_AUTH_COOKIE_SECRET` of at least 32 characters to `.dev.vars`. The required variable names are listed in `.dev.vars.example`. Never commit `.dev.vars`, `.env.local`, or `.neon`.

Apply migrations and start the web app:

```powershell
npm run db:migrate
npm run dev
```

Open <http://127.0.0.1:5173/auth/sign-up> to create a development account.

## Connect an AI assistant

Start the ordinary development server:

```powershell
npm run dev
```

Add `http://127.0.0.1:5173/mcp` to Codex, Claude, or another compatible MCP client. The client discovers Neon OAuth, opens Unsolvable's sign-in and consent pages, and receives an access token scoped to this MCP resource. The app never receives or stores the model provider's API key or login token.

## Hosted AI-assistant authorization

The hosted `/mcp` endpoint is provider-neutral Streamable HTTP MCP. Codex, Claude, and other OAuth-capable MCP clients use the same URL. It uses Neon OAuth for identity; PostgreSQL board membership determines effective read/write authority. Before publishing it:

1. Set `MCP_RESOURCE_URL` to the exact public HTTPS MCP endpoint, for example `https://board.example.com/mcp`.
2. Enable the OAuth server in Neon Auth.
3. Configure the login page as `https://board.example.com/auth/sign-in`, the consent page as `https://board.example.com/auth/consent`, and allow the MCP resource URL above.
4. Add the public MCP URL in the AI client. The protected-resource metadata endpoint lets compatible clients discover Neon Auth and show the consent flow.

An access token identifies the same Neon Auth subject as the signed-in user. Board membership is still checked in PostgreSQL, so Codex receives the user's effective board role rather than a parallel bypass.

## Data model

- Neon Auth owns credentials and sessions.
- `app_users` maps each Neon Auth subject to an internal user ID.
- Every user receives a personal workspace on the first board save.
- Workspace and board membership are separate from authentication.
- Boards store JSON state and an ordered tutor-action queue in PostgreSQL.
- Human and agent edits use validated board commands with optimistic event-version checks.

Database changes use Drizzle migrations in `drizzle/`. Develop against a Neon branch; production migrations are a separate deployment step.

## Verification

```powershell
npm run check
npm run test:db
```

`npm run check` is offline-safe. `npm run test:db` runs the repository contract against the Neon branch in `.dev.vars` and removes its own test records.

## Architecture

```text
browser -> Next/Vinext routes -> auth + application services -> repository contracts -> Neon PostgreSQL
   |                                      ^
AI client -> OAuth-protected /mcp ----------+
```

The board domain does not import React, Next.js, Cloudflare, authentication, billing, or database code. See `ARCHITECTURE.md` for the dependency boundaries and future monorepo extraction path.

## Extending agent rights

Current agent authority comes from the signed-in user's OAuth token: it cannot exceed the user's board role. Add future rights as explicit capabilities rather than weakening the board membership check. A new capability should have its own domain command and validation, OAuth scope/consent text, server policy check, and audit provenance. If an agent must truly exceed the user, give it a separate service principal and stored grant.
