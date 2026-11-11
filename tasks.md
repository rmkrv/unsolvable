# Product tasks

## Highest priority

- [ ] Implement the `student`, `parent`, and `admin` role system, including parent-student relationships, server-side authorization, separate dashboards, attendance/performance summaries, audit history, and billing ownership separated from subscription beneficiaries. Students may learn and pay independently; no age or guardian requirement is part of the role model.
- [x] Implement calendar planning across the frontend, backend, and database, including study-plan scheduling, deadlines, reminders, recurring sessions, time-zone handling, completion state, authorization for parent-managed plans, and explicit Google Calendar export by event or month.

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

## Product refinements

- [ ] Add a compact preview of the most recently used whiteboard to the **Resume session** card so the card provides useful visual context instead of feeling empty.
- [ ] Make **Next focus** identify a specific concept the student struggles with, supported by stored practice evidence and an actionable recommendation, rather than generic encouragement to complete more attempts.
- [ ] Connect the sidebar's **Learning rhythm** card to real planning data, such as progress toward upcoming exams and scheduled study sessions.
- [ ] Replace **Mathematical thinking studio** with broader product positioning that supports Unsolvable's ambition beyond mathematics, and update related copy consistently across the application.
