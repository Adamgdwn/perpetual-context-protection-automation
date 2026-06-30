export const PROTOCOL_VERSION = 1;

export type AgentProfileId = "claude" | "codex" | "echo-proof";

export type ObservabilityLevel =
  | "managed"
  | "adoptable"
  | "candidate"
  | "unsupported";

export interface WorkspaceIdentity {
  id: string;
  name: string;
  workspaceFolders: string[];
}

export interface TerminalSummary {
  id: string;
  name: string;
  observability: ObservabilityLevel;
  profileId?: AgentProfileId;
  reason: string;
  lastOutputPreview?: string;
}

export interface ExtensionHeartbeat {
  protocolVersion: typeof PROTOCOL_VERSION;
  windowId: string;
  extensionVersion: string;
  workspace: WorkspaceIdentity;
  terminals: TerminalSummary[];
  timestamp: string;
}

export interface StartSessionRequest {
  profileId: AgentProfileId;
  workspace: WorkspaceIdentity;
  cols?: number;
  rows?: number;
}

export interface SendInputRequest {
  text: string;
}

export interface BridgeSessionSummary {
  id: string;
  profileId: AgentProfileId;
  workspaceId: string;
  workspaceName: string;
  observability: "managed";
  startedAt: string;
  status: "starting" | "running" | "exited";
  command: string;
  outputLength: number;
  exitCode?: number;
}

export interface SessionOutputResponse {
  session: BridgeSessionSummary;
  output: string;
}

export interface BridgeHealthResponse {
  ok: true;
  service: "pcpa-local-bridge";
  protocolVersion: typeof PROTOCOL_VERSION;
  timestamp: string;
  sessionCount: number;
  heartbeatCount: number;
}

export interface BridgeErrorResponse {
  ok: false;
  error: string;
}

export function isAgentProfileId(value: string): value is AgentProfileId {
  return value === "claude" || value === "codex" || value === "echo-proof";
}
