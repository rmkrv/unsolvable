import { env } from "cloudflare:workers";
import { Conflict, InvalidInput } from "@/lib/server/auth/authorization-errors";
import type { Viewer } from "@/lib/server/auth/viewer";
import {
  getAuthorizedCalendarEvent,
  getCalendarRepository,
  listCalendarOccurrences,
  occurrenceForStart,
  type CalendarOccurrenceView,
} from "./calendar-service";
import type { CalendarEventRecord } from "./calendar-repository";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type ExportResult = { exported: number; updated: number; skipped: number };

export function googleCalendarAuthorizationUrl(callbackUrl: string, state: string) {
  const config = googleConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function connectGoogleCalendar(
  viewer: Viewer,
  code: string,
  callbackUrl: string,
) {
  const config = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    }),
  });
  const token = await response.json() as GoogleTokenResponse;
  if (!response.ok || !token.refresh_token) {
    throw new Conflict(token.error_description || "Google did not return a reusable Calendar authorization. Please try connecting again.");
  }
  const scopes = token.scope || GOOGLE_CALENDAR_SCOPE;
  if (!scopes.split(" ").includes(GOOGLE_CALENDAR_SCOPE)) {
    throw new Conflict("Google Calendar permission was not granted.");
  }
  await getCalendarRepository().saveGoogleConnection({
    userId: viewer.appUserId,
    encryptedRefreshToken: await encryptRefreshToken(token.refresh_token, config.encryptionKey),
    grantedScopes: scopes,
  });
}

export async function isGoogleCalendarConnected(userId: string) {
  return Boolean(await getCalendarRepository().getGoogleConnection(userId));
}

export async function disconnectGoogleCalendar(viewer: Viewer) {
  const repository = getCalendarRepository();
  const connection = await repository.getGoogleConnection(viewer.appUserId);
  if (!connection) return;
  const refreshToken = await decryptRefreshToken(
    connection.encryptedRefreshToken,
    googleConfig().encryptionKey,
  );
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null;
    if (detail?.error !== "invalid_token") {
      throw new Conflict("Google Calendar access could not be revoked. Try again in a moment.");
    }
  }
  await repository.deleteGoogleConnection(viewer.appUserId);
}

export async function exportCalendarOccurrence(
  viewer: Viewer,
  eventId: string,
  occurrenceStart: Date,
): Promise<ExportResult> {
  const event = await getAuthorizedCalendarEvent(viewer, eventId);
  if (event.kind !== "study_session" || event.status === "cancelled") {
    throw new InvalidInput("Only active study sessions can be exported to Google Calendar.");
  }
  const occurrence = occurrenceForStart(event, occurrenceStart);
  if (!occurrence) throw new InvalidInput("That calendar occurrence does not exist.");
  const accessToken = await googleAccessToken(viewer.appUserId);
  const result = await exportOne(viewer.appUserId, accessToken, event, {
    ...event,
    occurrenceStart: occurrence.occurrenceStart.getTime(),
    occurrenceEnd: occurrence.occurrenceEnd.getTime(),
  });
  return result === "updated"
    ? { exported: 0, updated: 1, skipped: 0 }
    : { exported: 1, updated: 0, skipped: 0 };
}

export async function exportCalendarMonth(
  viewer: Viewer,
  studentUserId: string,
  from: Date,
  to: Date,
): Promise<ExportResult> {
  const occurrences = (await listCalendarOccurrences(viewer, studentUserId, from, to))
    .filter((event) => event.kind === "study_session" && event.status !== "cancelled");
  if (occurrences.length > 100) throw new InvalidInput("A month export is limited to 100 study sessions.");
  const result: ExportResult = { exported: 0, updated: 0, skipped: 0 };
  if (!occurrences.length) return result;
  const accessToken = await googleAccessToken(viewer.appUserId);
  for (const occurrence of occurrences) {
    const event = await getAuthorizedCalendarEvent(viewer, occurrence.id);
    const outcome = await exportOne(viewer.appUserId, accessToken, event, occurrence);
    result[outcome] += 1;
  }
  return result;
}

async function exportOne(
  userId: string,
  accessToken: string,
  event: CalendarEventRecord,
  occurrence: Pick<CalendarOccurrenceView, "occurrenceStart" | "occurrenceEnd">,
): Promise<"exported" | "updated"> {
  const repository = getCalendarRepository();
  const occurrenceStart = new Date(occurrence.occurrenceStart);
  const existing = await repository.getExport(event.id, userId, occurrenceStart);
  const body = googleEventBody(event, occurrence);
  let googleEventId = existing?.googleEventId ?? null;
  let updated = false;

  if (googleEventId) {
    const response = await googleRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
      accessToken,
      "PATCH",
      body,
    );
    if (response.ok) {
      updated = true;
    } else if (response.status === 404 || response.status === 410) {
      googleEventId = null;
    } else {
      await throwGoogleError(response);
    }
  }

  if (!googleEventId) {
    const response = await googleRequest(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      accessToken,
      "POST",
      body,
    );
    if (!response.ok) await throwGoogleError(response);
    const created = await response.json() as { id?: string };
    if (!created.id) throw new Conflict("Google Calendar did not return an event identifier.");
    googleEventId = created.id;
  }

  await repository.saveExport({
    calendarEventId: event.id,
    userId,
    occurrenceStart,
    googleCalendarId: "primary",
    googleEventId,
  });
  return updated ? "updated" : "exported";
}

async function googleAccessToken(userId: string) {
  const connection = await getCalendarRepository().getGoogleConnection(userId);
  if (!connection) throw new Conflict("Connect Google Calendar before exporting sessions.");
  return refreshAccessToken(
    await decryptRefreshToken(connection.encryptedRefreshToken, googleConfig().encryptionKey),
  );
}

function googleEventBody(
  event: CalendarEventRecord,
  occurrence: Pick<CalendarOccurrenceView, "occurrenceStart" | "occurrenceEnd">,
) {
  return {
    summary: event.title,
    description: [event.description, "Planned in Unsolvable."].filter(Boolean).join("\n\n"),
    start: { dateTime: new Date(occurrence.occurrenceStart).toISOString(), timeZone: event.timeZone },
    end: { dateTime: new Date(occurrence.occurrenceEnd).toISOString(), timeZone: event.timeZone },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: event.reminderMinutes }],
    },
    extendedProperties: {
      private: {
        unsolvableEventId: event.id,
        unsolvableOccurrenceStart: new Date(occurrence.occurrenceStart).toISOString(),
      },
    },
  };
}

async function refreshAccessToken(refreshToken: string) {
  const config = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const token = await response.json() as GoogleTokenResponse;
  if (!response.ok || !token.access_token) {
    throw new Conflict("Google Calendar authorization has expired. Reconnect it and try again.");
  }
  return token.access_token;
}

function googleRequest(url: string, accessToken: string, method: "POST" | "PATCH", body: unknown) {
  return fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function throwGoogleError(response: Response): Promise<never> {
  const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  throw new Conflict(detail?.error?.message || "Google Calendar could not save this session.");
}

function googleConfig() {
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const encryptionKey = env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!clientId || !clientSecret || !encryptionKey || encryptionKey.length < 32) {
    throw new Conflict("Google Calendar integration is not configured on this environment.");
  }
  return { clientId, clientSecret, encryptionKey };
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptRefreshToken(token: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(secret),
    new TextEncoder().encode(token),
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(cipher))}`;
}

async function decryptRefreshToken(value: string, secret: string) {
  const [version, encodedIv, encodedCipher] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedCipher) throw new Conflict("Stored Google authorization is invalid.");
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(encodedIv) },
      await encryptionKey(secret),
      fromBase64Url(encodedCipher),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Conflict("Stored Google authorization could not be read. Reconnect Google Calendar.");
  }
}

function base64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
