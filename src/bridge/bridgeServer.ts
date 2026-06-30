import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { URL } from "node:url";
import {
  PROTOCOL_VERSION,
  isAgentProfileId,
  type BridgeHealthResponse,
  type ExtensionHeartbeat,
  type SendInputRequest,
  type StartSessionRequest
} from "../shared/protocol";
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
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 47320;

export async function startBridgeServer(
  options: BridgeServerOptions = {}
): Promise<BridgeRuntime> {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const state: BridgeState = {
    heartbeats: new Map(),
    sessions: new Map()
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

  const address = server.address() as AddressInfo;

  return {
    server,
    host,
    port: address.port,
    url: `http://${host}:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
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

    sendJson(response, 404, { ok: false, error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown bridge error";
    sendJson(response, 500, { ok: false, error: message });
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
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
