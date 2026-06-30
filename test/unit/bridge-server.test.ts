import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  DesktopActionResponse,
  DesktopStateResponse,
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

void test("desktop state exposes cards, logs, and guarded operator actions", async () => {
  const runtime = await startBridgeServer({ port: 0 });
  try {
    const heartbeat: ExtensionHeartbeat = {
      protocolVersion: PROTOCOL_VERSION,
      windowId: "desktop-window",
      extensionVersion: "0.0.1",
      workspace: {
        id: "desktop-workspace",
        name: "Desktop Workspace",
        workspaceFolders: ["file:///workspace"]
      },
      terminals: [
        {
          id: "candidate-terminal",
          name: "Existing Codex",
          observability: "candidate",
          profileId: "codex",
          reason: "Detected by VS Code, but not managed by the bridge."
        }
      ],
      timestamp: new Date().toISOString()
    };

    await postJson(`${runtime.url}/heartbeat`, heartbeat);

    const session = await postJson<BridgeSessionSummary>(`${runtime.url}/sessions`, {
      profileId: "echo-proof",
      workspace: heartbeat.workspace
    });

    const initialState = await getJson<DesktopStateResponse>(
      `${runtime.url}/desktop/state`
    );
    const managedCard = initialState.cards.find(
      (card) => card.source === "managed-session" && card.profileId === "echo-proof"
    );
    const candidateCard = initialState.cards.find(
      (card) => card.id.includes("candidate-terminal")
    );

    assert.ok(managedCard);
    assert.ok(candidateCard);
    assert.equal(managedCard.canArmAll, true);
    assert.equal(candidateCard.canArm, false);
    assert.equal(candidateCard.observability, "candidate");
    assert.equal(initialState.automation.mode, "dry-run");

    const liveMode = await postJson<DesktopActionResponse>(
      `${runtime.url}/desktop/automation-mode/live`,
      {}
    );
    assert.equal(liveMode.state.automation.mode, "live");

    const armAll = await postJson<DesktopActionResponse>(
      `${runtime.url}/desktop/arm-all`,
      {}
    );
    assert.deepEqual(armAll.affectedCardIds, [managedCard.id]);
    assert.equal(
      armAll.state.cards.find((card) => card.id === managedCard.id)?.automationState,
      "watching"
    );
    assert.equal(
      armAll.state.cards.find((card) => card.id === candidateCard.id)?.automationState,
      "idle"
    );

    const candidateArm = await postJsonResponse(
      `${runtime.url}/desktop/cards/${encodeURIComponent(candidateCard.id)}/arm`,
      {}
    );
    assert.equal(candidateArm.status, 409);
    assert.match(candidateArm.text, /cannot be armed/u);

    const paused = await postJson<DesktopActionResponse>(
      `${runtime.url}/desktop/cards/${encodeURIComponent(managedCard.id)}/pause`,
      {}
    );
    assert.equal(
      paused.state.cards.find((card) => card.id === managedCard.id)?.automationState,
      "paused"
    );

    const dismissed = await postJson<DesktopActionResponse>(
      `${runtime.url}/desktop/cards/${encodeURIComponent(candidateCard.id)}/dismiss`,
      {}
    );
    assert.equal(
      dismissed.state.cards.some((card) => card.id === candidateCard.id),
      false
    );
    assert.ok(dismissed.state.events.length >= initialState.events.length + 3);
    assert.equal(session.observability, "managed");
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

async function postJsonResponse(
  url: string,
  body: unknown
): Promise<{ status: number; text: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    text: await response.text()
  };
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
