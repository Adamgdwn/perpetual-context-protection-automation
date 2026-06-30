import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { BridgeClient } from "./bridgeClient";
import { BridgeManagedPseudoterminal } from "./bridgeTerminal";
import {
  PROTOCOL_VERSION,
  type AgentProfileId,
  type BridgeSessionSummary,
  type ExtensionHeartbeat,
  type TerminalSummary,
  type WorkspaceIdentity
} from "../shared/protocol";
import { resolveAgentProfile } from "../shared/profiles";

interface ManagedSessionRecord {
  session: BridgeSessionSummary;
  terminal: vscode.Terminal;
}

const managedSessions = new Map<string, ManagedSessionRecord>();

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Perpetual Context Protection");
  context.subscriptions.push(output);

  const windowId = loadWindowId(context);

  const sendHeartbeat = async (): Promise<ExtensionHeartbeat> => {
    const heartbeat = createHeartbeat(context, windowId);
    try {
      await createBridgeClient().sendHeartbeat(heartbeat);
      output.appendLine(`Heartbeat sent for ${heartbeat.workspace.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.appendLine(`Heartbeat failed: ${message}`);
    }
    return heartbeat;
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("pcpa.sendHeartbeat", sendHeartbeat),
    vscode.commands.registerCommand("pcpa.startManagedClaude", async () =>
      startManagedProfile("claude")
    ),
    vscode.commands.registerCommand("pcpa.startManagedCodex", async () =>
      startManagedProfile("codex")
    ),
    vscode.commands.registerCommand(
      "pcpa.sendTextToManagedSession",
      async (sessionId?: string, text?: string) => sendTextToManagedSession(sessionId, text)
    ),
    vscode.commands.registerCommand("pcpa.runManagedIoProof", async (text?: string) =>
      runManagedIoProof(text ?? "pcpa-ping")
    )
  );

  const intervalMs = getConfiguration().get<number>("heartbeatIntervalMs", 10000);
  const heartbeatTimer = setInterval(() => {
    void sendHeartbeat();
  }, intervalMs);
  context.subscriptions.push(new vscode.Disposable(() => clearInterval(heartbeatTimer)));

  void sendHeartbeat();
}

export function deactivate(): void {
  managedSessions.clear();
}

async function startManagedProfile(
  profileId: AgentProfileId
): Promise<BridgeSessionSummary> {
  const client = createBridgeClient();
  const profile = resolveAgentProfile(profileId);
  const session = await client.startSession({
    profileId,
    workspace: createWorkspaceIdentity()
  });

  const pty = new BridgeManagedPseudoterminal(client, session.id);
  const terminal = vscode.window.createTerminal({
    name: `PCPA ${profile.displayName}`,
    pty
  });
  terminal.show();
  managedSessions.set(session.id, { session, terminal });
  return session;
}

async function sendTextToManagedSession(
  sessionId?: string,
  text?: string
): Promise<void> {
  const targetSessionId = sessionId ?? [...managedSessions.keys()].at(-1);
  if (!targetSessionId) {
    throw new Error("No managed session is available");
  }

  const input =
    text ??
    (await vscode.window.showInputBox({
      title: "Send Text To Managed Session",
      prompt: "Text will be sent exactly as entered."
    }));

  if (input === undefined) {
    return;
  }

  await createBridgeClient().sendInput(targetSessionId, input);
}

async function runManagedIoProof(text: string): Promise<{
  ok: boolean;
  sessionId: string;
  observedOutput: string;
}> {
  const client = createBridgeClient();
  const session = await client.startSession({
    profileId: "echo-proof",
    workspace: createWorkspaceIdentity()
  });

  managedSessions.set(session.id, {
    session,
    terminal: vscode.window.createTerminal({
      name: "PCPA Echo Proof",
      pty: new BridgeManagedPseudoterminal(client, session.id)
    })
  });

  await waitForOutput(client, session.id, "PCPA_PROOF_READY", 5000);
  await client.sendInput(session.id, `${text}\r`);
  const observedOutput = await waitForOutput(
    client,
    session.id,
    `PCPA_PROOF_ECHO:${text}`,
    5000
  );

  return {
    ok: observedOutput.includes(`PCPA_PROOF_ECHO:${text}`),
    sessionId: session.id,
    observedOutput
  };
}

async function waitForOutput(
  client: BridgeClient,
  sessionId: string,
  expected: string,
  timeoutMs: number
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await client.getOutput(sessionId);
    if (response.output.includes(expected)) {
      return response.output;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const response = await client.getOutput(sessionId);
  throw new Error(`Timed out waiting for ${expected}. Output was: ${response.output}`);
}

function createHeartbeat(
  context: vscode.ExtensionContext,
  windowId: string
): ExtensionHeartbeat {
  const packageJson = context.extension.packageJSON as unknown as {
    version?: unknown;
  };
  const extensionVersion =
    typeof packageJson.version === "string" ? packageJson.version : "0.0.0";

  return {
    protocolVersion: PROTOCOL_VERSION,
    windowId,
    extensionVersion,
    workspace: createWorkspaceIdentity(),
    terminals: createTerminalSummaries(),
    timestamp: new Date().toISOString()
  };
}

function createWorkspaceIdentity(): WorkspaceIdentity {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const workspaceFolders = folders.map((folder) => folder.uri.toString());
  const name =
    vscode.workspace.name ??
    folders[0]?.name ??
    "untitled-vscode-window";

  return {
    id: workspaceFolders.join("|") || name,
    name,
    workspaceFolders
  };
}

function createTerminalSummaries(): TerminalSummary[] {
  const managedTerminalNames = new Set(
    [...managedSessions.values()].map((record) => record.terminal.name)
  );

  const unmanagedTerminals = vscode.window.terminals
    .filter((terminal) => !managedTerminalNames.has(terminal.name))
    .map<TerminalSummary>((terminal) => ({
      id: terminal.name,
      name: terminal.name,
      observability: "candidate",
      reason:
        "VS Code exposes this terminal identity, but this spike has not proven reliable output streaming for arbitrary existing terminals."
    }));

  const managed = [...managedSessions.values()].map<TerminalSummary>((record) => ({
    id: record.session.id,
    name: record.terminal.name,
    observability: "managed",
    profileId: record.session.profileId,
    reason: "Session was launched through the local bridge and has controlled PTY read/write."
  }));

  return [...managed, ...unmanagedTerminals];
}

function loadWindowId(context: vscode.ExtensionContext): string {
  const existing = context.globalState.get<string>("pcpa.windowId");
  if (existing) {
    return existing;
  }

  const created = randomUUID();
  void context.globalState.update("pcpa.windowId", created);
  return created;
}

function createBridgeClient(): BridgeClient {
  return new BridgeClient(getConfiguration().get<string>("bridgeUrl", "http://127.0.0.1:47320"));
}

function getConfiguration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("pcpa");
}
