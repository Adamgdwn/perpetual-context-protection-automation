import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { URL } from "node:url";
import {
  PROTOCOL_VERSION,
  isAgentProfileId,
  type BridgeHealthResponse,
  type DesktopActionResponse,
  type DesktopStateResponse,
  type ExtensionHeartbeat,
  type SendInputRequest,
  type SessionAutomationMode,
  type StartSessionRequest
} from "../shared/protocol";
import { DesktopStateStore } from "./desktopState";
import { managedSessionIdFromCardId } from "./cardIds";
import { ManagedPtySession } from "./managedPtySession";

export interface BridgeServerOptions {
  host?: string;
  port?: number;
}

export interface BridgeRuntime {
  server: Server;
  host: string;
  port: number;
  url: string;
  close: () => Promise<void>;
}

interface BridgeState {
  heartbeats: Map<string, ExtensionHeartbeat>;
  sessions: Map<string, ManagedPtySession>;
  desktop: DesktopStateStore;
  automationTimer: NodeJS.Timeout | undefined;
}

export const DEFAULT_BRIDGE_HOST = "127.0.0.1";
export const DEFAULT_BRIDGE_PORT = 47320;

export async function startBridgeServer(
  options: BridgeServerOptions = {}
): Promise<BridgeRuntime> {
  const host = options.host ?? DEFAULT_BRIDGE_HOST;
  const port = options.port ?? DEFAULT_BRIDGE_PORT;
  const state: BridgeState = {
    heartbeats: new Map(),
    sessions: new Map(),
    desktop: new DesktopStateStore(),
    automationTimer: undefined
  };

  const server = createServer((request, response) => {
    void handleRequest(state, request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  state.automationTimer = setInterval(() => {
    state.desktop.evaluateAutomation([...state.sessions.values()]);
  }, 1000);
  state.automationTimer.unref();

  const address = server.address() as AddressInfo;

  return {
    server,
    host,
    port: address.port,
    url: `http://${host}:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        if (state.automationTimer) {
          clearInterval(state.automationTimer);
          state.automationTimer = undefined;
        }
        for (const session of state.sessions.values()) {
          session.stop();
        }
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}

async function handleRequest(
  state: BridgeState,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    if (request.method === "OPTIONS") {
      sendEmpty(response, 204);
      return;
    }

    if (!request.url) {
      sendJson(response, 400, { ok: false, error: "Missing request URL" });
      return;
    }

    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      const body: BridgeHealthResponse = {
        ok: true,
        service: "pcpa-local-bridge",
        protocolVersion: PROTOCOL_VERSION,
        timestamp: new Date().toISOString(),
        sessionCount: state.sessions.size,
        heartbeatCount: state.heartbeats.size
      };
      sendJson(response, 200, body);
      return;
    }

    if (request.method === "POST" && url.pathname === "/heartbeat") {
      const heartbeat = await readJson<ExtensionHeartbeat>(request);
      if (heartbeat.protocolVersion !== PROTOCOL_VERSION || !heartbeat.windowId) {
        sendJson(response, 400, { ok: false, error: "Invalid heartbeat" });
        return;
      }
      state.heartbeats.set(heartbeat.windowId, heartbeat);
      state.desktop.recordHeartbeat(heartbeat);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/heartbeats") {
      sendJson(response, 200, [...state.heartbeats.values()]);
      return;
    }

    if (request.method === "GET" && url.pathname === "/sessions") {
      sendJson(
        response,
        200,
        [...state.sessions.values()].map((session) => session.summary())
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/sessions") {
      const body = await readJson<StartSessionRequest>(request);
      if (!isAgentProfileId(body.profileId) || !body.workspace?.id) {
        sendJson(response, 400, { ok: false, error: "Invalid session request" });
        return;
      }

      const session = new ManagedPtySession({
        profileId: body.profileId,
        workspace: body.workspace,
        cols: body.cols,
        rows: body.rows
      });
      session.start();
      state.sessions.set(session.id, session);
      state.desktop.recordSessionStarted(session.summary());
      sendJson(response, 201, session.summary());
      return;
    }

    const inputMatch = url.pathname.match(/^\/sessions\/([^/]+)\/input$/u);
    if (request.method === "POST" && inputMatch) {
      const session = state.sessions.get(inputMatch[1]);
      if (!session) {
        sendJson(response, 404, { ok: false, error: "Session not found" });
        return;
      }
      const body = await readJson<SendInputRequest>(request);
      if (typeof body.text !== "string") {
        sendJson(response, 400, { ok: false, error: "Invalid input request" });
        return;
      }
      session.write(body.text);
      state.desktop.recordSessionInput(session.summary());
      sendJson(response, 200, { ok: true });
      return;
    }

    const outputMatch = url.pathname.match(/^\/sessions\/([^/]+)\/output$/u);
    if (request.method === "GET" && outputMatch) {
      const session = state.sessions.get(outputMatch[1]);
      if (!session) {
        sendJson(response, 404, { ok: false, error: "Session not found" });
        return;
      }
      sendJson(response, 200, {
        session: session.summary(),
        output: session.getOutput()
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/desktop/state") {
      sendJson(response, 200, createDesktopState(state));
      return;
    }

    if (request.method === "POST" && url.pathname === "/desktop/arm-all") {
      sendDesktopAction(response, state.desktop.armAll(desktopInput(state)));
      return;
    }

    const automationModeMatch = url.pathname.match(
      /^\/desktop\/automation-mode\/(dry-run|live)$/u
    );
    if (request.method === "POST" && automationModeMatch) {
      sendDesktopAction(
        response,
        state.desktop.setAutomationMode(
          automationModeMatch[1] as SessionAutomationMode,
          desktopInput(state)
        )
      );
      return;
    }

    const desktopActionMatch = url.pathname.match(
      /^\/desktop\/cards\/([^/]+)\/(arm|resume|pause|reset|kill|dismiss)$/u
    );
    if (request.method === "POST" && desktopActionMatch) {
      const cardId = decodeURIComponent(desktopActionMatch[1]);
      const action = desktopActionMatch[2];
      const input = desktopInput(state);
      if (action === "arm") {
        sendDesktopAction(response, state.desktop.armCard(cardId, input));
        return;
      }
      if (action === "resume") {
        sendDesktopAction(response, state.desktop.resumeCard(cardId, input));
        return;
      }
      if (action === "pause") {
        sendDesktopAction(response, state.desktop.pauseCard(cardId, input));
        return;
      }
      if (action === "reset") {
        sendDesktopAction(response, state.desktop.resetCard(cardId, input));
        return;
      }
      if (action === "kill") {
        const sessionId = managedSessionIdFromCardId(cardId);
        const session = sessionId ? state.sessions.get(sessionId) : undefined;
        if (!session) {
          sendJson(response, 404, {
            ok: false,
            error: "Managed session not found"
          });
          return;
        }
        session.stop();
        sendDesktopAction(response, state.desktop.killCard(cardId, desktopInput(state)));
        return;
      }
      sendDesktopAction(response, state.desktop.dismissCard(cardId, input));
      return;
    }

    sendJson(response, 404, { ok: false, error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown bridge error";
    sendJson(response, 500, { ok: false, error: message });
  }
}

function createDesktopState(state: BridgeState): DesktopStateResponse {
  return state.desktop.createState(desktopInput(state));
}

function desktopInput(state: BridgeState): {
  heartbeats: ExtensionHeartbeat[];
  sessions: ReturnType<ManagedPtySession["summary"]>[];
} {
  return {
    heartbeats: [...state.heartbeats.values()],
    sessions: [...state.sessions.values()].map((session) => session.summary())
  };
}

function sendDesktopAction(
  response: ServerResponse,
  result: {
    statusCode: number;
    body: DesktopActionResponse | { ok: false; error: string };
  }
): void {
  sendJson(response, result.statusCode, result.body);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...bridgeResponseHeaders(response)
  });
  response.end(JSON.stringify(body));
}

function sendEmpty(response: ServerResponse, statusCode: number): void {
  response.writeHead(statusCode, bridgeResponseHeaders(response));
  response.end();
}

function bridgeResponseHeaders(response: ServerResponse): Record<string, string> {
  const headers: Record<string, string> = {
    "cache-control": "no-store",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type"
  };
  const origin = response.req.headers.origin;
  if (origin && isLoopbackBrowserOrigin(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "origin";
  }
  return headers;
}

function isLoopbackBrowserOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1")
    );
  } catch {
    return false;
  }
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}
