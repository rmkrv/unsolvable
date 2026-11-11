export type TutorTurnInput = { boardId: string; message: string; trigger: string };
export type TutorTurnResult = { reply?: string };

export interface TutorTransport {
  readonly mode: "local" | "mcp";
  readonly label: string;
  status(): Promise<{ ready: boolean; error?: string }>;
  interrupt(boardId: string): Promise<void>;
  sendTurn(input: TutorTurnInput, signal?: AbortSignal): Promise<TutorTurnResult>;
}

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload;
}

export function createTutorTransport(baseUrl: string | undefined, fetcher: typeof fetch = fetch): TutorTransport {
  if (!baseUrl) {
    return {
      mode: "mcp",
      label: "Codex MCP",
      async status() { return { ready: false }; },
      async interrupt() {},
      async sendTurn() { throw new Error("Continue in the connected Codex tutor chat."); },
    };
  }

  return {
    mode: "local",
    label: "Codex local",
    async status() {
      const response = await fetcher(`${baseUrl}/status`);
      return responseJson<{ ready: boolean; error?: string }>(response, "Local Codex bridge unavailable.");
    },
    async interrupt(boardId) {
      await fetcher(`${baseUrl}/interrupt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
    },
    async sendTurn(input, signal) {
      const response = await fetcher(`${baseUrl}/turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
      return responseJson<TutorTurnResult>(response, "Codex could not complete this turn.");
    },
  };
}
