import type {
  BridgeSessionSummary,
  ExtensionHeartbeat,
  ResizeSessionRequest,
  SendInputRequest,
  SessionOutputResponse,
  StartSessionRequest
} from "../shared/protocol";

export class BridgeClient {
  public constructor(private readonly baseUrl: string) {}

  public async sendHeartbeat(heartbeat: ExtensionHeartbeat): Promise<void> {
    await this.request("/heartbeat", {
      method: "POST",
      body: heartbeat
    });
  }

  public async startSession(
    body: StartSessionRequest
  ): Promise<BridgeSessionSummary> {
    return this.request<BridgeSessionSummary>("/sessions", {
      method: "POST",
      body
    });
  }

  public async sendInput(sessionId: string, text: string): Promise<void> {
    const body: SendInputRequest = { text };
    await this.request(`/sessions/${encodeURIComponent(sessionId)}/input`, {
      method: "POST",
      body
    });
  }

  public async getOutput(sessionId: string): Promise<SessionOutputResponse> {
    return this.request<SessionOutputResponse>(
      `/sessions/${encodeURIComponent(sessionId)}/output`,
      { method: "GET" }
    );
  }

  public async resizeSession(
    sessionId: string,
    cols: number,
    rows: number
  ): Promise<void> {
    const body: ResizeSessionRequest = { cols, rows };
    await this.request(`/sessions/${encodeURIComponent(sessionId)}/resize`, {
      method: "POST",
      body
    });
  }

  public async stopSession(sessionId: string): Promise<void> {
    await this.request(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE"
    });
  }

  private async request<T = unknown>(
    path: string,
    options: { method: "GET" | "POST" | "DELETE"; body?: unknown }
  ): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      method: options.method,
      headers:
        options.body === undefined
          ? undefined
          : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    const text = await response.text();
    const parsed = text.length === 0 ? undefined : (JSON.parse(text) as T);

    if (!response.ok) {
      throw new Error(
        `Bridge request ${options.method} ${path} failed with ${response.status}: ${text}`
      );
    }

    return parsed as T;
  }
}
