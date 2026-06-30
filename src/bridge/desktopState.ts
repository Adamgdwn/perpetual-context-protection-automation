import {
  PROTOCOL_VERSION,
  type BridgeSessionSummary,
  type DesktopActionResponse,
  type DesktopEventLogEntry,
  type DesktopSessionCard,
  type DesktopStateResponse,
  type ExtensionHeartbeat,
  type SessionAutomationState,
  type SessionCardStatus,
  type TerminalSummary
} from "../shared/protocol";
import { resolveAgentProfile } from "../shared/profiles";

interface DesktopStateActionResult {
  statusCode: number;
  body: DesktopActionResponse | { ok: false; error: string };
}

interface CardBuildInput {
  heartbeats: ExtensionHeartbeat[];
  sessions: BridgeSessionSummary[];
}

const profileIds = ["claude", "codex", "echo-proof"] as const;

export class DesktopStateStore {
  private readonly automationByCardId = new Map<string, SessionAutomationState>();
  private readonly dismissedCardIds = new Set<string>();
  private readonly eventLog: DesktopEventLogEntry[] = [];
  private eventSequence = 0;

  public recordHeartbeat(heartbeat: ExtensionHeartbeat): void {
    this.appendEvent({
      kind: "heartbeat",
      message: `Heartbeat received from ${heartbeat.workspace.name}`,
      workspaceId: heartbeat.workspace.id
    });
  }

  public recordSessionStarted(session: BridgeSessionSummary): void {
    this.appendEvent({
      kind: "session-started",
      cardId: managedCardId(session.id),
      workspaceId: session.workspaceId,
      message: `${displayNameForProfile(session.profileId)} managed session started for ${session.workspaceName}`
    });
  }

  public recordSessionInput(session: BridgeSessionSummary): void {
    this.appendEvent({
      kind: "session-input",
      cardId: managedCardId(session.id),
      workspaceId: session.workspaceId,
      message: `Input sent to ${displayNameForProfile(session.profileId)} in ${session.workspaceName}`
    });
  }

  public createState(input: CardBuildInput): DesktopStateResponse {
    const cards = this.createCards(input);
    const lastHeartbeatAt = latestTimestamp(input.heartbeats.map((heartbeat) => heartbeat.timestamp));

    return {
      protocolVersion: PROTOCOL_VERSION,
      generatedAt: new Date().toISOString(),
      connection: {
        bridgeOnline: true,
        heartbeatCount: input.heartbeats.length,
        sessionCount: input.sessions.length,
        lastHeartbeatAt
      },
      cards,
      events: [...this.eventLog],
      profiles: profileIds.map((profileId) => {
        const profile = resolveAgentProfile(profileId);
        return {
          id: profile.id,
          displayName: profile.displayName,
          compactCommand: profile.compactCommand,
          resumeInstruction: profile.resumeInstruction
        };
      })
    };
  }

  public armCard(cardId: string, input: CardBuildInput): DesktopStateActionResult {
    const card = this.findVisibleCard(cardId, input);
    if (!card) {
      return { statusCode: 404, body: { ok: false, error: "Session card not found" } };
    }

    if (!card.canArm) {
      return {
        statusCode: 409,
        body: {
          ok: false,
          error: `${card.observability} sessions cannot be armed for unattended automation`
        }
      };
    }

    this.automationByCardId.set(card.id, "armed");
    this.appendEvent({
      kind: "session-armed",
      cardId: card.id,
      workspaceId: card.workspaceId,
      message: `${card.agentLabel} armed for ${card.workspaceName}`,
      affectedCardIds: [card.id]
    });

    return this.actionResponse([card.id], input);
  }

  public pauseCard(cardId: string, input: CardBuildInput): DesktopStateActionResult {
    const card = this.findVisibleCard(cardId, input);
    if (!card) {
      return { statusCode: 404, body: { ok: false, error: "Session card not found" } };
    }

    this.automationByCardId.set(card.id, "paused");
    this.appendEvent({
      kind: "session-paused",
      cardId: card.id,
      workspaceId: card.workspaceId,
      message: `${card.agentLabel} paused for ${card.workspaceName}`,
      affectedCardIds: [card.id]
    });

    return this.actionResponse([card.id], input);
  }

  public dismissCard(cardId: string, input: CardBuildInput): DesktopStateActionResult {
    const card = this.findVisibleCard(cardId, input);
    if (!card) {
      return { statusCode: 404, body: { ok: false, error: "Session card not found" } };
    }

    this.dismissedCardIds.add(card.id);
    this.automationByCardId.delete(card.id);
    this.appendEvent({
      kind: "session-dismissed",
      cardId: card.id,
      workspaceId: card.workspaceId,
      message: `${card.agentLabel} dismissed for ${card.workspaceName}`,
      affectedCardIds: [card.id]
    });

    return this.actionResponse([card.id], input);
  }

  public armAll(input: CardBuildInput): DesktopStateActionResult {
    const cards = this.createCards(input);
    const eligibleCards = cards.filter((card) => card.canArmAll);
    const affectedCardIds = eligibleCards.map((card) => card.id);

    for (const card of eligibleCards) {
      this.automationByCardId.set(card.id, "armed");
    }

    this.appendEvent({
      kind: "arm-all",
      message:
        affectedCardIds.length === 0
          ? "Arm All found no managed sessions"
          : `Arm All armed ${affectedCardIds.length} managed session${affectedCardIds.length === 1 ? "" : "s"}`,
      affectedCardIds
    });

    return this.actionResponse(affectedCardIds, input);
  }

  private findVisibleCard(cardId: string, input: CardBuildInput): DesktopSessionCard | undefined {
    return this.createCards(input).find((card) => card.id === cardId);
  }

  private actionResponse(
    affectedCardIds: string[],
    input: CardBuildInput
  ): DesktopStateActionResult {
    return {
      statusCode: 200,
      body: {
        ok: true,
        affectedCardIds,
        state: this.createState(input)
      }
    };
  }

  private createCards(input: CardBuildInput): DesktopSessionCard[] {
    const cards: DesktopSessionCard[] = [
      ...input.sessions.map((session) => this.createManagedCard(session))
    ];
    const managedTerminalIds = new Set(input.sessions.map((session) => session.id));

    for (const heartbeat of input.heartbeats) {
      const visibleTerminals = heartbeat.terminals.filter(
        (terminal) => !managedTerminalIds.has(terminal.id)
      );

      if (visibleTerminals.length === 0) {
        cards.push(this.createWorkspaceCard(heartbeat));
        continue;
      }

      for (const terminal of visibleTerminals) {
        cards.push(this.createHeartbeatTerminalCard(heartbeat, terminal));
      }
    }

    return cards
      .filter((card) => !this.dismissedCardIds.has(card.id))
      .sort((left, right) => left.workspaceName.localeCompare(right.workspaceName));
  }

  private createManagedCard(session: BridgeSessionSummary): DesktopSessionCard {
    const cardId = managedCardId(session.id);
    const automationState = this.automationByCardId.get(cardId) ?? "idle";
    const latestEvent = this.latestEventFor(cardId, session.workspaceId);

    return {
      id: cardId,
      source: "managed-session",
      workspaceId: session.workspaceId,
      workspaceName: session.workspaceName,
      agentLabel: displayNameForProfile(session.profileId),
      profileId: session.profileId,
      observability: "managed",
      status: statusForManagedSession(session.status, automationState),
      automationState,
      canArm: session.status !== "exited",
      canArmAll: session.status !== "exited",
      reason: "Managed bridge session with controlled PTY read/write.",
      lastEvent: latestEvent.message,
      lastEventAt: latestEvent.timestamp,
      chunkCount: 0
    };
  }

  private createHeartbeatTerminalCard(
    heartbeat: ExtensionHeartbeat,
    terminal: TerminalSummary
  ): DesktopSessionCard {
    const cardId = terminalCardId(heartbeat.windowId, terminal.id);
    const automationState = this.automationByCardId.get(cardId) ?? "idle";
    const latestEvent = this.latestEventFor(cardId, heartbeat.workspace.id);

    return {
      id: cardId,
      source: "heartbeat-terminal",
      workspaceId: heartbeat.workspace.id,
      workspaceName: heartbeat.workspace.name,
      windowId: heartbeat.windowId,
      agentLabel: terminal.profileId
        ? displayNameForProfile(terminal.profileId)
        : terminal.name,
      profileId: terminal.profileId,
      observability: terminal.observability,
      status: statusForObservedTerminal(terminal.observability, automationState),
      automationState,
      canArm: terminal.observability === "managed",
      canArmAll: terminal.observability === "managed",
      reason: terminal.reason,
      lastEvent: latestEvent.message,
      lastEventAt: latestEvent.timestamp,
      chunkCount: 0
    };
  }

  private createWorkspaceCard(heartbeat: ExtensionHeartbeat): DesktopSessionCard {
    const cardId = workspaceCardId(heartbeat.windowId);
    const automationState = this.automationByCardId.get(cardId) ?? "idle";
    const latestEvent = this.latestEventFor(cardId, heartbeat.workspace.id);

    return {
      id: cardId,
      source: "workspace",
      workspaceId: heartbeat.workspace.id,
      workspaceName: heartbeat.workspace.name,
      windowId: heartbeat.windowId,
      agentLabel: "VS Code window",
      observability: "candidate",
      status: statusForObservedTerminal("candidate", automationState),
      automationState,
      canArm: false,
      canArmAll: false,
      reason: "VS Code window heartbeat received; no managed coder terminal reported yet.",
      lastEvent: latestEvent.message,
      lastEventAt: latestEvent.timestamp,
      chunkCount: 0
    };
  }

  private latestEventFor(cardId: string, workspaceId: string): DesktopEventLogEntry {
    const event = [...this.eventLog]
      .reverse()
      .find((entry) => entry.cardId === cardId || entry.workspaceId === workspaceId);

    return (
      event ?? {
        id: "initial",
        timestamp: new Date(0).toISOString(),
        kind: "heartbeat",
        message: "Detected",
        cardId,
        workspaceId
      }
    );
  }

  private appendEvent(event: Omit<DesktopEventLogEntry, "id" | "timestamp">): void {
    const timestamp = new Date().toISOString();
    this.eventSequence += 1;
    this.eventLog.push({
      id: `${timestamp}-${this.eventSequence}`,
      timestamp,
      ...event
    });
  }
}

function managedCardId(sessionId: string): string {
  return `managed:${sessionId}`;
}

function terminalCardId(windowId: string, terminalId: string): string {
  return `terminal:${windowId}:${terminalId}`;
}

function workspaceCardId(windowId: string): string {
  return `workspace:${windowId}`;
}

function displayNameForProfile(profileId: BridgeSessionSummary["profileId"]): string {
  return resolveAgentProfile(profileId).displayName;
}

function statusForManagedSession(
  sessionStatus: BridgeSessionSummary["status"],
  automationState: SessionAutomationState
): SessionCardStatus {
  if (automationState === "armed") {
    return "armed";
  }
  if (automationState === "paused") {
    return "paused";
  }
  return sessionStatus;
}

function statusForObservedTerminal(
  observability: TerminalSummary["observability"],
  automationState: SessionAutomationState
): SessionCardStatus {
  if (automationState === "armed") {
    return "armed";
  }
  if (automationState === "paused") {
    return "paused";
  }
  return observability === "unsupported" ? "unsupported" : "detected";
}

function latestTimestamp(timestamps: string[]): string | undefined {
  return timestamps
    .filter((timestamp) => !Number.isNaN(Date.parse(timestamp)))
    .sort()
    .at(-1);
}
