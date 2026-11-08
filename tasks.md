# Product tasks

## Highest priority

- [ ] Implement parental controls across the backend and database, including guardian-child relationships, consent and age state, permission policies, audit history, and server-side enforcement. Keep billing ownership and subscription data strictly separate from child profiles and learning data, with guardian-only billing access and authorization.
- [ ] Implement calendar planning across the frontend, backend, and database, including study-plan scheduling, deadlines, reminders, recurring sessions, time-zone handling, completion state, and authorization for guardian-managed plans.

## High importance

- [ ] Implement notifications end to end: persistence, authenticated API, unread state, notification list, and an enabled header action.
- [ ] Implement the diagnostic and targeted-practice flows behind **Take a diagnostic** and **Practice this skill**, including practice-session and evidence recording.
- [ ] Implement the collaboration flow behind **Study together**: learner search, invitations, friend requests, accept/decline actions, blocking, and the required authorization checks.
- [ ] Implement verified recovery-email management and connect it to **Add recovery email**.
- [ ] Connect **Manage billing** to a real provider portal through an authenticated server endpoint. Keep the action unavailable until a provider customer exists.
- [ ] Implement secure account deletion behind **Remove account**, including recent-authentication checks, confirmation, board/data retention rules, and billing cancellation.
- [ ] Create a real Privacy page and update the footer **Privacy** link from `#` to its route.
- [ ] Create a real Terms page and update the footer **Terms** link from `#` to its route.
- [ ] Complete the board-to-AI action lifecycle: make **Check work** and voice requests start an authorized AI run, and make **Stop** cancel the remote run as well as local speech and drawing.
- [ ] Resolve the landing-page board mock controls: either make **Pen**, **Select**, and **Add annotation** functional or render them as non-interactive presentation elements.
- [ ] Keep development previews explicit: preview-only **Save changes** must remain clearly labeled as local state, and unavailable actions must not appear operational.
