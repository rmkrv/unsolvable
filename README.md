<div align="center">
  <img src="public/brand/unsolvable-logo.png" alt="Unsolvable logo" width="180" />
  <h1>Unsolvable</h1>
  <p>An AI-assisted learning platform for deliberate practice, precise feedback, and collaborative problem-solving.</p>
</div>

## Google Calendar setup

Schedule export uses a Google OAuth web client and the Google Calendar Events API. Copy `.dev.vars.example` to `.dev.vars`, set the three `GOOGLE_CALENDAR_*` values, and register this local redirect URI in Google Cloud:

```text
http://127.0.0.1:5173/api/integrations/google-calendar/callback
```

Hosted environments must register the equivalent HTTPS callback. The application requests Calendar event access only after a user chooses an export action. Refresh tokens are encrypted before being stored; `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY` must be a unique secret of at least 32 characters.
