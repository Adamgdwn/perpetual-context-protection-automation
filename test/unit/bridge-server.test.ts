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
    assert.equal(
      initialState.setup.vscodeExtension.extensionId,
      "adamgoodwin.perpetual-context-protection-automation"
    );
    assert.equal(initialState.setup.vscodeExtension.installCommand, "npm run vscode:install");
    assert.ok(initialState.setup.vscodeExtension.checkedLocations.length >= 1);

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

void test("desktop controls isolate multiple managed sessions", async () => {
  const runtime = await startBridgeServer({ port: 0 });
  try {
    const firstHeartbeat = createHeartbeat("window-one", "workspace-one", "Workspace One", [
      {
        id: "candidate-terminal",
        name: "Existing Codex",
        observability: "candidate",
        profileId: "codex",
        reason: "Detected by VS Code, but not managed by the bridge."
      }
    ]);
    const secondHeartbeat = createHeartbeat(
      "window-two",
      "workspace-two",
      "Workspace Two",
      [
        {
          id: "unsupported-terminal",
          name: "Plain Shell",
          observability: "unsupported",
          reason: "No supported coding agent detected."
        }
      ]
    );

    await postJson(`${runtime.url}/heartbeat`, firstHeartbeat);
    await postJson(`${runtime.url}/heartbeat`, secondHeartbeat);

    const firstSession = await postJson<BridgeSessionSummary>(
      `${runtime.url}/sessions`,
      {
        profileId: "echo-proof",
        workspace: firstHeartbeat.workspace
      }
    );
    const secondSession = await postJson<BridgeSessionSummary>(
      `${runtime.url}/sessions`,
      {
        profileId: "echo-proof",
        workspace: secondHeartbeat.workspace
      }
    );

    const initialState = await getJson<DesktopStateResponse>(
      `${runtime.url}/desktop/state`
    );
    const managedCards = initialState.cards.filter(
      (card) => card.source === "managed-session"
    );
    const candidateCard = initialState.cards.find(
      (card) => card.id.includes("candidate-terminal")
    );
    const unsupportedCard = initialState.cards.find(
      (card) => card.id.includes("unsupported-terminal")
    );

    assert.equal(initialState.connection.heartbeatCount, 2);
    assert.equal(managedCards.length, 2);
    assert.ok(candidateCard);
    assert.ok(unsupportedCard);
    assert.equal(candidateCard.canArm, false);
    assert.equal(unsupportedCard.canArm, false);

    const armAll = await postJson<DesktopActionResponse>(
      `${runtime.url}/desktop/arm-all`,
      {}
    );
    assert.deepEqual(
      new Set(armAll.affectedCardIds),
      new Set(managedCards.map((card) => card.id))
    );
    assert.equal(
      armAll.state.cards.find((card) => card.id === candidateCard.id)
        ?.automationState,
      "idle"
    );
    assert.equal(
      armAll.state.cards.find((card) => card.id === unsupportedCard.id)
        ?.automationState,
      "idle"
    );

    const [firstCard, secondCard] = managedCards;
    const paused = await postJson<DesktopActionResponse>(
      `${runtime.url}/desktop/cards/${encodeURIComponent(firstCard.id)}/pause`,
      {}
    );
    assert.equal(
      paused.state.cards.find((card) => card.id === firstCard.id)
        ?.automationState,
      "paused"
    );
    assert.equal(
      paused.state.cards.find((card) => card.id === secondCard.id)
        ?.automationState,
      "watching"
    );

    const armAllAfterPause = await postJson<DesktopActionResponse>(
      `${runtime.url}/desktop/arm-all`,
      {}
    );
    assert.deepEqual(armAllAfterPause.affectedCardIds, []);

    const resumed = await postJson<DesktopActionResponse>(
      `${runtime.url}/desktop/cards/${encodeURIComponent(firstCard.id)}/resume`,
      {}
    );
    assert.equal(
      resumed.state.cards.find((card) => card.id === firstCard.id)
        ?.automationState,
      "watching"
    );

    const reset = await postJson<DesktopActionResponse>(
      `${runtime.url}/desktop/cards/${encodeURIComponent(firstCard.id)}/reset`,
      {}
    );
    assert.equal(
      reset.state.cards.find((card) => card.id === firstCard.id)?.automationState,
      "idle"
    );

    const kill = await postJson<DesktopActionResponse>(
      `${runtime.url}/desktop/cards/${encodeURIComponent(secondCard.id)}/kill`,
      {}
    );
    const killedCard = kill.state.cards.find((card) => card.id === secondCard.id);
    assert.equal(killedCard?.status, "exited");
    assert.equal(killedCard?.canKill, false);

    const candidateArm = await postJsonResponse(
      `${runtime.url}/desktop/cards/${encodeURIComponent(candidateCard.id)}/arm`,
      {}
    );
    assert.equal(candidateArm.status, 409);
    assert.match(candidateArm.text, /cannot be armed/u);

    const candidatePause = await postJsonResponse(
      `${runtime.url}/desktop/cards/${encodeURIComponent(candidateCard.id)}/pause`,
      {}
    );
    assert.equal(candidatePause.status, 409);
    assert.match(candidatePause.text, /cannot be paused/u);

    assertEventDetailsInclude(kill.state, secondSession.id, "kill", "exited");
    assertEventDetailsInclude(reset.state, firstSession.id, "reset", "idle");
  } finally {
    await runtime.close();
  }
});

void test("distinct VS Code windows stay as separate cards keyed by window id", async () => {
  const runtime = await startBridgeServer({ port: 0 });
  try {
    // Two windows open on the same workspace must not collapse into one card.
    // Before the extension minted a per-window id, every window shared one id
    // and overwrote a single heartbeat slot.
    const windowOne = createHeartbeat("window-a", "shared-workspace", "Shared Workspace", []);
    const windowTwo = createHeartbeat("window-b", "shared-workspace", "Shared Workspace", []);

    await postJson(`${runtime.url}/heartbeat`, windowOne);
    await postJson(`${runtime.url}/heartbeat`, windowTwo);

    const twoWindows = await getJson<DesktopStateResponse>(`${runtime.url}/desktop/state`);
    const workspaceCards = twoWindows.cards.filter((card) => card.source === "workspace");
    assert.equal(twoWindows.connection.heartbeatCount, 2);
    assert.equal(workspaceCards.length, 2);
    assert.deepEqual(
      new Set(workspaceCards.map((card) => card.windowId)),
      new Set(["window-a", "window-b"])
    );

    // Re-posting an existing window id updates that window rather than adding a
    // new card, which is exactly why the extension must send a stable-but-unique
    // id per window.
    await postJson(`${runtime.url}/heartbeat`, windowOne);
    const afterUpdate = await getJson<DesktopStateResponse>(`${runtime.url}/desktop/state`);
    assert.equal(afterUpdate.connection.heartbeatCount, 2);
  } finally {
    await runtime.close();
  }
});

void test("stale window heartbeats are pruned from desktop state", async () => {
  const runtime = await startBridgeServer({ port: 0 });
  try {
    const fresh = createHeartbeat("window-fresh", "fresh-workspace", "Fresh Workspace", []);
    const stale: ExtensionHeartbeat = {
      ...createHeartbeat("window-stale", "stale-workspace", "Stale Workspace", []),
      timestamp: new Date(Date.now() - 60_000).toISOString()
    };

    await postJson(`${runtime.url}/heartbeat`, fresh);
    await postJson(`${runtime.url}/heartbeat`, stale);

    const state = await getJson<DesktopStateResponse>(`${runtime.url}/desktop/state`);
    assert.equal(state.connection.heartbeatCount, 1);
    assert.equal(
      state.cards.some((card) => card.windowId === "window-stale"),
      false
    );
    assert.equal(
      state.cards.some((card) => card.windowId === "window-fresh"),
      true
    );
  } finally {
    await runtime.close();
  }
});

void test("deleting a managed session stops it, removes the card, and logs a stop", async () => {
  const runtime = await startBridgeServer({ port: 0 });
  try {
    const heartbeat = createHeartbeat("del-window", "del-workspace", "Delete Workspace", []);
    await postJson(`${runtime.url}/heartbeat`, heartbeat);
    const session = await postJson<BridgeSessionSummary>(`${runtime.url}/sessions`, {
      profileId: "echo-proof",
      workspace: heartbeat.workspace
    });

    const before = await getJson<DesktopStateResponse>(`${runtime.url}/desktop/state`);
    assert.equal(
      before.cards.some((card) => card.source === "managed-session"),
      true
    );

    const deleted = await fetch(`${runtime.url}/sessions/${session.id}`, {
      method: "DELETE"
    });
    assert.equal(deleted.status, 200);

    // Deleting again is a clean 404, not a crash.
    const deletedAgain = await fetch(`${runtime.url}/sessions/${session.id}`, {
      method: "DELETE"
    });
    assert.equal(deletedAgain.status, 404);

    const after = await getJson<DesktopStateResponse>(`${runtime.url}/desktop/state`);
    assert.equal(after.connection.sessionCount, 0);
    assert.equal(
      after.cards.some((card) => card.source === "managed-session"),
      false
    );
    const details = after.events.flatMap((event) => event.details ?? []);
    assert.equal(details.includes(`session:${session.id}`), true);
    assert.equal(details.includes("action:stop"), true);
  } finally {
    await runtime.close();
  }
});

function createHeartbeat(
  windowId: string,
  workspaceId: string,
  workspaceName: string,
  terminals: ExtensionHeartbeat["terminals"]
): ExtensionHeartbeat {
  return {
    protocolVersion: PROTOCOL_VERSION,
    windowId,
    extensionVersion: "0.0.1",
    workspace: {
      id: workspaceId,
      name: workspaceName,
      workspaceFolders: [`file:///${workspaceId}`]
    },
    terminals,
    timestamp: new Date().toISOString()
  };
}

function assertEventDetailsInclude(
  state: DesktopStateResponse,
  sessionId: string,
  action: string,
  result: string
): void {
  const details = state.events.flatMap((event) => event.details ?? []);
  assert.equal(details.includes(`session:${sessionId}`), true);
  assert.equal(details.includes(`action:${action}`), true);
  assert.equal(details.includes(`result:${result}`), true);
}

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
