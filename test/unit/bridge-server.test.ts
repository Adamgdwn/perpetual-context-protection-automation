import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  BridgeHealthResponse,
  BridgeSessionSummary,
  ExtensionHeartbeat,
  SessionOutputResponse
} from "../../src/shared/protocol";
import { PROTOCOL_VERSION } from "../../src/shared/protocol";
import { startBridgeServer } from "../../src/bridge/bridgeServer";

void test("bridge accepts heartbeats and manages an echo-proof PTY session", async () => {
  const runtime = await startBridgeServer({ port: 0 });
  try {
    const health = await getJson<BridgeHealthResponse>(`${runtime.url}/health`);
    assert.equal(health.ok, true);
    assert.equal(health.sessionCount, 0);

    const heartbeat: ExtensionHeartbeat = {
      protocolVersion: PROTOCOL_VERSION,
      windowId: "unit-window",
      extensionVersion: "0.0.1",
      workspace: {
        id: "unit-workspace",
        name: "Unit Workspace",
        workspaceFolders: []
      },
      terminals: [],
      timestamp: new Date().toISOString()
    };

    await postJson(`${runtime.url}/heartbeat`, heartbeat);

    const session = await postJson<BridgeSessionSummary>(`${runtime.url}/sessions`, {
      profileId: "echo-proof",
      workspace: heartbeat.workspace
    });
    assert.equal(session.profileId, "echo-proof");
    assert.equal(session.observability, "managed");

    await waitForOutput(runtime.url, session.id, "PCPA_PROOF_READY");
    await postJson(`${runtime.url}/sessions/${session.id}/input`, { text: "hello\r" });
    const output = await waitForOutput(
      runtime.url,
      session.id,
      "PCPA_PROOF_ECHO:hello"
    );

    assert.match(output.output, /PCPA_PROOF_ECHO:hello/u);
  } finally {
    await runtime.close();
  }
});

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const text = await response.text();
  assert.equal(response.ok, true, text);
  return JSON.parse(text) as T;
}

async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  assert.equal(response.ok, true, text);
  return JSON.parse(text) as T;
}

async function waitForOutput(
  bridgeUrl: string,
  sessionId: string,
  expected: string
): Promise<SessionOutputResponse> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const response = await getJson<SessionOutputResponse>(
      `${bridgeUrl}/sessions/${sessionId}/output`
    );
    if (response.output.includes(expected)) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${expected}`);
}
