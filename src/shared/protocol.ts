export const PROTOCOL_VERSION = 1;

export type AgentProfileId = "claude" | "codex" | "echo-proof";

export type ObservabilityLevel =
  | "managed"
  | "adoptable"
  | "candidate"
  | "unsupported";

export type SessionAutomationState = "idle" | "armed" | "paused";

export type SessionCardStatus =
  | "detected"
  | "starting"
  | "running"
  | "exited"
  | "armed"
  | "paused"
  | "unsupported";

export type DesktopEventKind =
  | "heartbeat"
  | "session-started"
  | "session-input"
  | "session-armed"
  | "session-paused"
  | "session-dismissed"
  | "arm-all";

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

export interface DesktopConnectionSummary {
  bridgeOnline: boolean;
  heartbeatCount: number;
  sessionCount: number;
  lastHeartbeatAt?: string;
}

export interface DesktopSessionCard {
  id: string;
  source: "managed-session" | "heartbeat-terminal" | "workspace";
  workspaceId: string;
  workspaceName: string;
  windowId?: string;
  agentLabel: string;
  profileId?: AgentProfileId;
  observability: ObservabilityLevel;
  status: SessionCardStatus;
  automationState: SessionAutomationState;
  canArm: boolean;
  canArmAll: boolean;
  reason: string;
  lastEvent: string;
  lastEventAt: string;
  chunkCount: number;
}

export interface DesktopEventLogEntry {
  id: string;
  timestamp: string;
  kind: DesktopEventKind;
  message: string;
  cardId?: string;
  workspaceId?: string;
  affectedCardIds?: string[];
}

export interface DesktopStateResponse {
  protocolVersion: typeof PROTOCOL_VERSION;
  generatedAt: string;
  connection: DesktopConnectionSummary;
  cards: DesktopSessionCard[];
  events: DesktopEventLogEntry[];
  profiles: Array<{
    id: AgentProfileId;
    displayName: string;
    compactCommand: string;
    resumeInstruction: string;
  }>;
}

export interface DesktopActionResponse {
  ok: true;
  affectedCardIds: string[];
  state: DesktopStateResponse;
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
