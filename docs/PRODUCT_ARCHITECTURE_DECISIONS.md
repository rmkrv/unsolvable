# Product architecture decisions

Status: Proposed  
Date: 2026-11-07  
Scope: Public entry, authenticated home, account settings, and the product areas surfaced from home.

## Product model

Unsolvable is a collaborative mathematics workspace built around AI-assisted boards. The public site explains the product; the signed-in application helps a learner decide what to do next and resume their work.

The primary audience is learners in upper secondary school through the first years of university: people facing material difficult enough to require careful explanation, but who still have time to build real understanding. Younger learners may use age-appropriate material, but the product's visual language remains mature and their account/social experience requires stricter safeguards.

The first release has four product capabilities:

1. **Practice** — create or resume an AI-assisted board and solve problems alone or with collaborators.
2. **Find Your Weak Spots** — turn evidence from practice into skill-gap diagnoses and recommended next steps.
3. **Friends** — find consenting, discoverable learners and invite them to work together.
4. **Recent** — reopen the boards the current user visited most recently.

“User info” is named **Settings** in the interface because it also contains security, billing, recovery, and account deletion.

## ADR-001: Separate the public site from the authenticated app

**Decision**

- `/` is the public start page and never requires authentication.
- `/home` is the authenticated product home.
- `/boards/[boardId]` is the canonical board URL. A board ID is always explicit in the URL so sharing, collaboration, history, and MCP access do not depend on whichever board was opened last.
- `/settings/*`, `/practice`, `/weak-spots`, and `/friends` require authentication.
- After sign-in, return the user to a validated `redirectTo` route; otherwise send them to `/home`.
- A signed-in visitor may still open `/`. The primary call to action becomes **Go to home** rather than forcing a redirect.

**Why**

The current root route is both the product entry and an authenticated board. Splitting these responsibilities gives the product a shareable marketing surface, a predictable post-login destination, and stable resource URLs.

### Route map

| Route | Access | Responsibility |
| --- | --- | --- |
| `/` | Public | Product promise, representative board preview, how it works, sign-up and sign-in calls to action, trust/legal footer |
| `/auth/sign-in` | Public | Sign in, password recovery entry, OAuth continuation |
| `/auth/sign-up` | Public | Create an account and continue to onboarding or the requested destination |
| `/auth/forgot-password` | Public | Request a password-reset message without revealing whether an account exists |
| `/onboarding` | Signed in, first run | Capture learning goal and level, then offer a baseline practice/diagnostic board |
| `/home` | Signed in | Next-best action, product-area entry points, recent boards |
| `/practice` | Signed in | Start from a problem, topic, blank board, or assignment; resume active practice |
| `/weak-spots` | Signed in | Evidence, confidence, recommended practice, and progress by mathematical skill |
| `/friends` | Signed in | Search discoverable users, requests, collaborators, blocked users |
| `/boards` | Signed in | Search and manage all boards |
| `/boards/[boardId]` | Member or invited visitor | The existing AI-assisted whiteboard experience |
| `/settings/profile` | Signed in | Name, avatar, profile visibility |
| `/settings/account` | Signed in | Primary email, recovery email, account export/deletion |
| `/settings/security` | Signed in | Password change, active sessions, future MFA/passkeys |
| `/settings/billing` | Signed in | Plan, invoices, payment-provider portal |
| `/invites/[token]` | Public token entry | Explain the invitation, authenticate if needed, then accept or decline |

## ADR-002: Use two application shells

**Decision**

- The **public shell** contains brand navigation, sign in, and a single dominant sign-up call to action.
- The **app shell** contains persistent navigation for Home, Practice, Weak Spots, Friends, and Boards, plus notifications/help and the user menu.
- The board route uses a focused variation of the app shell: the board owns most of the viewport, while Home/Boards and account controls remain reachable.
- On narrow screens, the primary app destinations move to a compact bottom navigation or menu; the board keeps its existing tool-first layout.

**Why**

Marketing navigation and task navigation serve different intents. Keeping them separate avoids cluttering the public page with application controls or hiding core product areas inside the board.

## ADR-003: Make Home an action hub, not a feature catalogue

**Decision**

Home is ordered by the learner's likely next action:

1. **Continue / Start practicing** — the primary, largest action. Resume the most relevant active board or create a new practice board.
2. **Weak spots** — show a concise insight only when enough evidence exists; otherwise offer a baseline diagnostic.
3. **Friends** — show active collaborators, pending invitations, or a find-partners prompt.
4. **Recent boards** — show the most recently opened boards, with an **All boards** link.

Each section must have a useful empty state. No section should be a dead promotional card.

The initial recent-board card includes title, preview, last opened time, owner/collaborators, and an overflow menu. It does not expose private collaborator details to non-members.

**Why**

The learner's job is not to choose among four features; it is to continue learning. Prioritizing one next action keeps Home useful as the product grows.

## ADR-004: Define what “recent” means

**Decision**

“Recent boards” is ordered by the current user's `lastOpenedAt`, not by the board's `updatedAt`.

Add a per-user, per-board activity record:

```text
user_board_activity
  user_id
  board_id
  last_opened_at
  last_viewed_event_version
  is_favorite
```

The row is upserted when the user successfully opens an authorized board. Editing a board continues to update `boards.updatedAt`; opening it updates only the user's activity. This keeps collaborative edits from unexpectedly reordering another learner's recent list.

## ADR-005: Keep credentials and profile data in the right owners

**Decision**

- Neon Auth remains the source of truth for identity, password, primary email, recovery mechanisms, sessions, and future MFA/passkeys.
- The application database stores product profile fields that are not authentication credentials: display name override, avatar reference, discoverability, learning preferences, locale, and onboarding state.
- Avatar bytes live in object storage; PostgreSQL stores only the object key and metadata.
- Billing is owned by a payment provider. The application stores provider customer/subscription IDs and normalized entitlement state, never raw card data.
- Settings pages call dedicated account/profile/billing services. They do not access provider SDKs directly from React components.

Suggested application profile extension:

```text
user_profiles
  user_id
  display_name
  avatar_object_key
  is_discoverable
  learning_level
  learning_goal
  locale
  onboarding_completed_at
  created_at
  updated_at
```

Recovery email should only be shown if the authentication provider supports it as a verified recovery factor. It must not be implemented as an unverified application-profile field.

## ADR-006: Model collaboration explicitly

**Decision**

- Board access continues to use `board_members` with `owner`, `editor`, and `viewer` roles.
- Friendship is separate from board access. Becoming friends never grants access to existing boards.
- A board invitation grants access to exactly one board or workspace after acceptance.
- User discovery is opt-in. Search returns only deliberately discoverable profiles and never exposes an email address.
- Requests, blocks, and reports are first-class states; a block prevents discovery, requests, invitations, and presence between the two users.
- Open people search is unavailable to younger learners until age, consent, moderation, and regional requirements are implemented. Their collaboration must use a constrained mechanism such as an approved invitation, classroom, or guardian-managed group.

Suggested collaboration records:

```text
friend_requests(sender_user_id, recipient_user_id, status, created_at, responded_at)
friendships(user_a_id, user_b_id, created_at)
user_blocks(blocker_user_id, blocked_user_id, created_at)
board_invites(board_id, inviter_user_id, invitee_user_id?, invitee_email_hash?, role, token_hash, expires_at)
```

Pairs are stored in a canonical order where appropriate so duplicate friendships cannot be created.

## ADR-007: Treat weak-spot diagnosis as evidence, not a label

**Decision**

- A diagnosis is derived from attempts and board evidence; it is not stored as a permanent judgment about a learner.
- The interface must show why a skill was flagged, confidence, recency, and a concrete practice action.
- Learners can dismiss an incorrect inference and retake a diagnostic.
- AI suggestions may summarize evidence, but deterministic scoring and stored evidence own the mastery value.
- Raw board content is not automatically shared with friends or used for public ranking.

Suggested learning records:

```text
skills(id, parent_skill_id, name, version)
practice_sessions(id, user_id, board_id, mode, started_at, completed_at)
practice_attempts(id, session_id, skill_id, outcome, evidence, created_at)
user_skill_mastery(user_id, skill_id, score, confidence, evidence_count, calculated_at)
```

Start with a small, versioned skill taxonomy. Do not bake topic names into UI code or add a graph database before the evidence model proves insufficient.

## ADR-008: Make destructive account actions deliberate

**Decision**

- Changing password, changing recovery factors, exporting data, and deleting the account require recent authentication.
- Account deletion uses an explicit confirmation step, revokes active sessions, cancels or schedules cancellation of billing, and queues deletion across auth, application data, files, and provider mappings.
- Deletion is idempotent and auditable. The UI shows whether deletion is immediate or delayed before confirmation.
- The exact retention/cancellation window is a business and legal decision and must be set before implementation.

## ADR-009: Evolve APIs by resource

**Decision**

Keep the current board domain and repository boundary, but replace the implicit “latest board” HTTP behavior with explicit resources:

```text
GET    /api/boards?cursor=&limit=
POST   /api/boards
GET    /api/boards/[boardId]
PUT    /api/boards/[boardId]
DELETE /api/boards/[boardId]
POST   /api/boards/[boardId]/opened
GET    /api/boards/[boardId]/actions?after=
GET    /api/me
PATCH  /api/me/profile
GET    /api/me/home
```

`GET /api/me/home` may aggregate the small Home payload, but domain services remain separate. The MCP endpoint continues to authorize against explicit board membership and should require a board identity when more than one board exists.

Existing optimistic event-version checks remain in place for board writes.

## ADR-010: Add the missing product states to the MVP

The original three-page outline is the correct top level, but a coherent MVP also needs:

- first-run onboarding or a deliberate **Skip for now** path;
- password reset and email verification states;
- an all-boards view and explicit board creation flow;
- board invitations and invite acceptance;
- empty, loading, offline, forbidden, deleted-board, and not-found states;
- privacy, terms, and billing-policy links on public/auth surfaces;
- account deletion confirmation and completion states.

Notifications, advanced social feeds, public profiles, and a global leaderboard are intentionally outside the first release.

## ADR-011: Use daisyUI 5 as the application design system

**Decision**

- New public, Home, social, learning, and Settings UI uses daisyUI 5 on the existing Tailwind CSS 4 setup.
- When implementation begins, add `daisyui@latest` as a development dependency and load it from `app/globals.css` with `@plugin "daisyui";`. Do not add a deprecated `tailwind.config.js`.
- Use daisyUI components for standard interface patterns and Tailwind utilities for responsive composition. Keep custom CSS for the canvas renderer and whiteboard-specific interactions that have no suitable component.
- Use semantic theme colors rather than hard-coded palette utilities in application UI. The current visual language maps naturally to daisyUI tokens:
  - paper surfaces → `base-100`;
  - raised/chrome surfaces → `base-200` and `base-300`;
  - ink → `base-content`;
  - product blue → `primary`;
  - safe/connected state → `success`;
  - destructive state → `error`.
- Start with one custom light theme named `unsolvable`. A dark theme is deferred until the whiteboard canvas, handwriting, screenshots, and exported boards have a deliberate dark-mode policy.
- Use `primary` for the single most important action on a screen. Secondary actions use default, ghost, outline, or link treatments rather than competing brand-colored buttons.
- Theme radius, border, and depth tokens own shared component shape. Pages must not establish separate card, field, or button radius systems.

### Component map

| Surface | daisyUI building blocks | Product-specific composition |
| --- | --- | --- |
| Public start | `navbar`, `hero`, `card`, `button`, `footer` | Show a real product outcome and one dominant sign-up action; avoid a grid of equal feature cards above the fold |
| Auth and onboarding | `card`, `fieldset`, `input`, `button`, `alert`, `steps` | Keep one focused form per step and preserve a validated return destination |
| App shell | `drawer` + `menu` on desktop; `dock` on small screens | Home, Practice, Weak Spots, Friends, and Boards are primary destinations; Settings stays in the user menu |
| Home | `card` for next actions, `list` for recent boards, `avatar-group` for collaborators, `badge` for small statuses, `skeleton` while loading | Practice remains visually dominant; the other sections are useful states rather than equally weighted promotional tiles |
| Practice | `card`, `button`, `badge`, `progress` | Start from a topic, suggested problem, assignment, or blank board, then enter the custom board workspace |
| Weak Spots | `stats`, `progress`, `badge`, `card`, `alert` | Pair every diagnosis with evidence, confidence, recency, and a practice action; never communicate mastery with color alone |
| Friends | `input`, `list`, `avatar`, `badge`, `button`, `modal` | Separate search, pending requests, friends, and blocked users; make privacy state visible |
| Boards | `list` or responsive `card` rows, `dropdown`, `badge`, `skeleton` | Show title, preview, last opened time, collaborators, and permission; support search and pagination/cursors |
| Settings | `breadcrumbs`, side `menu`, `fieldset`, `input`, `button`, `alert`, `modal` | Use separate Profile, Account, Security, and Billing routes; reserve a confirmation modal for consequential actions |
| Board workspace | existing custom canvas and tool controls, with `navbar`, `dropdown`, `tooltip`, `modal`, and `toast` at the edges | Do not rebuild canvas gestures as generic components; keep the board visually focused and preserve maximum drawing space |

### Interaction and accessibility rules

- Use native links for navigation and buttons for actions.
- Prefer the native HTML `dialog` pattern for modal flows; destructive actions need an explicit action label and cannot rely on clicking the backdrop.
- Use `alert` with an appropriate live-region role for submission failures and important asynchronous outcomes.
- Every icon-only control needs an accessible name and visible focus state.
- Loading layouts use stable `skeleton` placeholders; short action waits may use a `loading` indicator inside the triggering button.
- Status always has a text or icon cue in addition to semantic color.
- Responsive layout changes must not reorder the learning hierarchy: Practice remains first, Recent remains easy to reach, and destructive Settings actions remain separated.
- Honor reduced-motion preferences, maintain keyboard access, and test text and non-text contrast against the custom theme before release.

This decision applies to new application UI. The existing shadcn-derived primitives can remain during migration, but a page must not mix visually competing component systems. Migrate by route or coherent surface rather than replacing isolated controls across the entire application.

## ADR-012: Present Unsolvable as a serious learning studio

**Decision**

The visual direction is **a modern mathematical studio**: precise, calm, warm, and highly capable. It must feel credible to an early university learner without becoming cold or intimidating to a younger student.

It is explicitly not a cartoon classroom, a neon AI dashboard, or a gamified children's product.

### Visual principles

1. **Show the work.** Use real board fragments, equations, diagrams, annotations, and collaboration states as the main visual material. Avoid generic stock photos of students and decorative AI imagery.
2. **One clear hierarchy.** Every screen has one dominant action or insight. Size, spacing, and typography establish hierarchy before color does.
3. **Calm precision.** Use cool porcelain surfaces, graphite ink, fine borders, restrained deep-teal emphasis, and modest depth. The product should feel crafted rather than clinical.
4. **Dense where users work, spacious where they decide.** The public page and Home have generous spacing; boards, lists, and Settings use efficient professional density.
5. **Quiet intelligence.** AI guidance appears as evidence, annotations, and next steps—not glowing gradients, robot mascots, or constant conversational chrome.
6. **Mature at every level.** Younger learners receive simpler language and content, not a more childish skin.

### Theme direction

The initial `unsolvable` daisyUI theme should preserve the strongest parts of the existing interface:

| Semantic role | Direction | Provisional reference |
| --- | --- | --- |
| `base-100` | cool porcelain | `#F7F8F5` |
| `base-200` | navigation and raised chrome | `#ECEFEB` |
| `base-300` | dividers and stronger raised surfaces | `#D9DED7` |
| `base-content` | graphite ink | `#181C1A` |
| `primary` | focused deep-teal action | `#0F6B5D` |
| `neutral` | strong secondary controls | `#202522` |
| `success` | verified/correct/connected | `#2C7A50` |
| `warning` | needs attention or uncertain evidence | `#B45B2B` |
| `error` | destructive or failed state | `#B9423A` |

These are visual references, not approved accessibility values. The complete theme must define all daisyUI semantic tokens and pass contrast checks before implementation.

- Use a 1 px border system, low-noise shadows, and medium radii: fields around 8 px and content boxes around 12 px.
- Keep `--depth` enabled but restrained and `--noise` disabled.
- Use one modern sans-serif family for product UI. A restrained serif may appear in the public hero or brand wordmark only; equations use appropriate mathematical rendering rather than the display font.
- Use the primary color once per view for the dominant action. Correctness, warnings, and errors use their semantic colors only.
- Motion is short and functional: state changes, panel entry, board collaboration, and progress updates. Avoid ambient floating or pulsing decoration.

### Page-level composition

- **Start page:** a strong editorial headline beside a polished, authentic board preview. Lead with the learner outcome, then explain Practice, diagnosis, and collaboration through real product evidence. Keep the first viewport focused on one sign-up action and one sign-in link.
- **Home:** a composed dashboard, not four equal feature tiles. The primary Practice/Continue panel spans more visual weight; Weak Spots and Friends provide compact evidence-driven summaries; Recent Boards reads as a refined working list.
- **Weak Spots:** communicate seriousness with clear skill names, evidence counts, confidence, and recommended next problems. Do not use school-report-card styling or red failure marks.
- **Friends:** emphasize collaboration context—what someone is studying, shared boards, and availability—while keeping profile exposure minimal.
- **Settings:** quiet, form-led, and predictable. Billing and destructive account actions are visually separated from profile editing.
- **Board:** remains the visual centerpiece. Surrounding product chrome recedes so paper, mathematics, and collaborators receive attention.

### Voice

Use concise, respectful language that assumes the learner is capable. Prefer “Let’s work through the step that broke down” over “You failed this topic.” Explanations may be simple, but never patronizing.

## Delivery slices

1. **Design-system and navigation foundation** — add the daisyUI 5 dependency and custom `unsolvable` theme, move the current board to `/boards/[boardId]`, make `/` public, add `/home`, app/public shells, explicit board listing, and per-user recent activity.
2. **Account foundation** — profile/security/account settings, avatar storage boundary, reset/recovery flows, and deletion orchestration. Billing can initially link to the provider portal.
3. **Learning loop** — practice-session creation, a small skill taxonomy, evidence capture, and weak-spot recommendations.
4. **Collaboration loop** — discoverability, friend requests, block/report controls, board invitations, and presence/realtime improvements.

Each slice should ship with route authorization tests, service/repository tests, and end-to-end coverage for its critical user flow.

## Decisions still requiring product input

These do not block the navigation foundation, but they should be decided before their respective slices:

- what evidence qualifies a skill diagnosis and how confidence is communicated;
- whether users can be found by username only, institution, invite code, or another privacy-preserving identifier;
- the billing model and entitlement boundaries;
- the deletion grace period and legally required retention;
- whether minors are in scope, which materially changes discovery, messaging, consent, and safety requirements.

