<div align="center">
  <img src="docs/assets/unsolvable-logo.png" alt="Unsolvable logo" width="180" />
  <h1>Unsolvable</h1>
  <p>A full-stack mathematics practice application with persistent whiteboards and MCP-based AI assistance.</p>
</div>

## Status

In active development. The application runs locally and is not deployed.

## Implemented

- Multi-page whiteboards with pen, highlighter, text, images, shapes, selection, movement, and erasing.
- PostgreSQL persistence for boards, users, roles, learning data, and study plans.
- Versioned board saves with serialized writes, autosave coalescing, and conflict rebasing.
- An MCP endpoint with tools for board observation, math-step verification, feedback, handwriting, drawing, speech, and erasing.
- Neon Auth sign-in and OAuth authorization for MCP clients.
- Role-based application areas for students, parents, and administrators.
- Mathematics topic tests, saved analyses, performance summaries, and weak-spot views.
- Study-calendar recurrence, weekly plan overrides, and explicit Google Calendar export.

## Architecture

The application separates the board domain from the browser, server, database, authentication, and cloud adapters. Human edits and MCP actions are applied through the same validated board-command model. Board access is checked independently from authentication.

The repository contains the React application, route handlers, domain code, PostgreSQL schema and migrations, Cloudflare Workers configuration, and automated tests.

## Stack

- TypeScript and React
- Next.js route conventions with Vinext and Vite
- Tailwind CSS and daisyUI
- PostgreSQL on Neon with Drizzle ORM
- Neon Auth and OAuth
- Model Context Protocol (MCP)
- Cloudflare Workers target
- Node.js test runner, TypeScript, and ESLint

## Verification

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```
