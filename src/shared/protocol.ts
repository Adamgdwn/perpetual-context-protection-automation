export const PROTOCOL_VERSION = 1;

export type AgentProfileId = "claude" | "codex" | "echo-proof";

export type ObservabilityLevel =
  | "managed"
  | "adoptable"
  | "candidate"
  | "unsupported";

export type SessionSignalState =
  | "chunk-boundary"
  | "task-complete"
  | "blocked"
  | "needs-human"
  | "compacting"
  | "active"
  | "uncertain";

export type SessionAutomationMode = "dry-run" | "live";

export type SessionAutomationState =
  | "idle"
  | "watching"
  | "paused"
  | "dry-run-ready"
  | "compacting"
  | "resuming"
  | "complete"
  | "blocked"
  | "needs-human"
  | "uncertain"
  | "error";

export type SessionCardStatus =
  | "detected"
  | "starting"
  | "running"
  | "exited"
  | "watching"
  | "paused"
  | "dry-run-ready"
  | "compacting"
  | "resuming"
  | "complete"
  | "blocked"
  | "needs-human"
  | "uncertain"
  | "error"
  | "unsupported";

export type DesktopEventKind =
  | "heartbeat"
  | "session-started"
  | "session-input"
  | "session-armed"
  | "session-resumed"
  | "session-paused"
  | "session-reset"
  | "session-killed"
  | "session-dismissed"
  | "arm-all"
  | "automation-mode"
  | "automation-decision"
  | "automation-dry-run"
  | "automation-compact"
  | "automation-resume"
  | "automation-stop";

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
  lastOutputAt?: string;
  lastInputAt?: string;
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
  automationMode: SessionAutomationMode;
  canArm: boolean;
  canArmAll: boolean;
  canResume: boolean;
  canReset: boolean;
  canKill: boolean;
  reason: string;
  lastEvent: string;
  lastEventAt: string;
  chunkCount: number;
  lastDecision?: DesktopSignalDecision;
}

export interface DesktopSignalEvidence {
  kind: string;
  id: string;
  description: string;
  excerpt?: string;
}

export interface DesktopSignalDecision {
  state: SessionSignalState;
  shouldCompact: boolean;
  stopAutomation: boolean;
  summary: string;
  evidence: DesktopSignalEvidence[];
  timestamp: string;
  quietForMs?: number;
}

export interface DesktopEventLogEntry {
  id: string;
  timestamp: string;
  kind: DesktopEventKind;
  message: string;
  cardId?: string;
  workspaceId?: string;
  affectedCardIds?: string[];
  details?: string[];
}

export interface DesktopStateResponse {
  protocolVersion: typeof PROTOCOL_VERSION;
  generatedAt: string;
  automation: {
    mode: SessionAutomationMode;
  };
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
