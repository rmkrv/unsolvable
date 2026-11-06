# Unsolvable

Unsolvable is a private, cloud-first engineering whiteboard. The web product uses Neon Auth and PostgreSQL. A local Codex adapter is optional: it reuses the Codex login on the student's computer and does not require an OpenAI API key.

## Local setup

Requirements: Node.js 22.13 or newer, npm, a Neon project, and the Neon CLI.

```powershell
npm install
neon link --project-id <project-id> --branch <development-branch> --no-env-pull -y
neon env pull --file .dev.vars
```

Add a unique `NEON_AUTH_COOKIE_SECRET` of at least 32 characters to `.dev.vars`. The required variable names are listed in `.dev.vars.example`. Never commit `.dev.vars`, `.env.local`, or `.neon`.

Apply migrations and start the web app:

```powershell
npm run db:migrate
npm run dev
```

Open <http://127.0.0.1:5173/auth/sign-up> to create a development account.

## Optional local Codex tutor

Install Codex CLI and sign in once with `codex login`, then run:

```powershell
npm run dev:tutor
```

The loopback bridge launches Codex only when the student asks for help. It passes the local `/mcp` tools to that turn and keeps the student's API costs at zero. Do not expose the development server beyond loopback.

## Data model

- Neon Auth owns credentials and sessions.
- `app_users` maps each Neon Auth subject to an internal user ID.
- Every user receives a personal workspace on the first board save.
- Workspace and board membership are separate from authentication.
- Boards store JSON state and an ordered tutor-action queue in PostgreSQL.

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
   +-> optional local Codex bridge -> MCP tools
```

The board domain does not import React, Next.js, Cloudflare, authentication, billing, or database code. See `ARCHITECTURE.md` for the dependency boundaries and future monorepo extraction path.
