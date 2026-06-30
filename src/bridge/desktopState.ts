import {
  PROTOCOL_VERSION,
  type BridgeSessionSummary,
  type DesktopActionResponse,
  type DesktopEventLogEntry,
  type DesktopSessionCard,
  type DesktopStateResponse,
  type ExtensionHeartbeat,
  type SessionAutomationMode,
  type SessionAutomationState,
  type SessionCardStatus,
  type TerminalSummary
} from "../shared/protocol";
import {
  BUILT_IN_AGENT_PROFILE_IDS,
  resolveAgentProfile
} from "../shared/profiles";
import {
  AutomationController,
  type AutomatableSession,
  type AutomationRuntimeEvent
} from "./automationController";
import {
  managedCardId,
  managedSessionIdFromCardId,
  terminalCardId,
  workspaceCardId
} from "./cardIds";

interface DesktopStateActionResult {
  statusCode: number;
  body: DesktopActionResponse | { ok: false; error: string };
}

interface CardBuildInput {
  heartbeats: ExtensionHeartbeat[];
  sessions: BridgeSessionSummary[];
}

export class DesktopStateStore {
  private readonly automation = new AutomationController();
  private readonly dismissedCardIds = new Set<string>();
  private readonly eventLog: DesktopEventLogEntry[] = [];
  private eventSequence = 0;

  public recordHeartbeat(heartbeat: ExtensionHeartbeat): void {
    this.appendEvent({
      kind: "heartbeat",
      message: `Heartbeat received from ${heartbeat.workspace.name}`,
      workspaceId: heartbeat.workspace.id,
      details: heartbeatEventDetails(heartbeat, "heartbeat", "ok")
    });
  }

  public recordSessionStarted(session: BridgeSessionSummary): void {
    this.appendEvent({
      kind: "session-started",
      cardId: managedCardId(session.id),
      workspaceId: session.workspaceId,
      message: `${displayNameForProfile(session.profileId)} managed session started for ${session.workspaceName}`,
      details: sessionEventDetails(session, "start", "ok")
    });
  }

  public recordSessionInput(session: BridgeSessionSummary): void {
    this.automation.recordManualInput(managedCardId(session.id));
    this.appendEvent({
      kind: "session-input",
      cardId: managedCardId(session.id),
      workspaceId: session.workspaceId,
      message: `Input sent to ${displayNameForProfile(session.profileId)} in ${session.workspaceName}`,
      details: sessionEventDetails(session, "input", "ok")
    });
  }

  public evaluateAutomation(sessions: AutomatableSession[]): void {
    for (const event of this.automation.evaluateSessions(sessions)) {
      this.recordAutomationEvent(event);
    }
  }

  public setAutomationMode(
    mode: SessionAutomationMode,
    input: CardBuildInput
  ): DesktopStateActionResult {
    this.automation.setMode(mode);
    this.appendEvent({
      kind: "automation-mode",
      message: `Automation mode set to ${mode}`,
      details: [`action:automation-mode`, `result:${mode}`]
    });
    return this.actionResponse([], input);
  }

  public createState(input: CardBuildInput): DesktopStateResponse {
    const cards = this.createCards(input);
    const lastHeartbeatAt = latestTimestamp(input.heartbeats.map((heartbeat) => heartbeat.timestamp));

    return {
      protocolVersion: PROTOCOL_VERSION,
      generatedAt: new Date().toISOString(),
      automation: {
        mode: this.automation.getMode()
      },
      connection: {
        bridgeOnline: true,
        heartbeatCount: input.heartbeats.length,
        sessionCount: input.sessions.length,
        lastHeartbeatAt
      },
      cards,
      events: [...this.eventLog],
      profiles: BUILT_IN_AGENT_PROFILE_IDS.map((profileId) => {
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

    const snapshot = this.automation.armCard(card.id);
    this.appendEvent({
      kind: "session-armed",
      cardId: card.id,
      workspaceId: card.workspaceId,
      message: `${card.agentLabel} watching in ${snapshot.mode} mode for ${card.workspaceName}`,
      affectedCardIds: [card.id],
      details: cardEventDetails(card, "arm", snapshot.state)
    });

    return this.actionResponse([card.id], input);
  }

  public resumeCard(cardId: string, input: CardBuildInput): DesktopStateActionResult {
    const card = this.findVisibleCard(cardId, input);
    if (!card) {
      return { statusCode: 404, body: { ok: false, error: "Session card not found" } };
    }

    if (!card.canResume) {
      return {
        statusCode: 409,
        body: { ok: false, error: `${card.status} sessions cannot be resumed` }
      };
    }

    const snapshot = this.automation.resumeCard(card.id);
    this.appendEvent({
      kind: "session-resumed",
      cardId: card.id,
      workspaceId: card.workspaceId,
      message: `${card.agentLabel} resumed in ${snapshot.mode} mode for ${card.workspaceName}`,
      affectedCardIds: [card.id],
      details: cardEventDetails(card, "resume", snapshot.state)
    });

    return this.actionResponse([card.id], input);
  }

  public pauseCard(cardId: string, input: CardBuildInput): DesktopStateActionResult {
    const card = this.findVisibleCard(cardId, input);
    if (!card) {
      return { statusCode: 404, body: { ok: false, error: "Session card not found" } };
    }

    if (card.source !== "managed-session") {
      return {
        statusCode: 409,
        body: { ok: false, error: `${card.observability} sessions cannot be paused` }
      };
    }

    this.automation.pauseCard(card.id);
    this.appendEvent({
      kind: "session-paused",
      cardId: card.id,
      workspaceId: card.workspaceId,
      message: `${card.agentLabel} paused for ${card.workspaceName}`,
      affectedCardIds: [card.id],
      details: cardEventDetails(card, "pause", "paused")
    });

    return this.actionResponse([card.id], input);
  }

  public resetCard(cardId: string, input: CardBuildInput): DesktopStateActionResult {
    const card = this.findVisibleCard(cardId, input);
    if (!card) {
      return { statusCode: 404, body: { ok: false, error: "Session card not found" } };
    }

    if (!card.canReset) {
      return {
        statusCode: 409,
        body: { ok: false, error: "Session card is already idle" }
      };
    }

    const snapshot = this.automation.resetCard(card.id);
    this.appendEvent({
      kind: "session-reset",
      cardId: card.id,
      workspaceId: card.workspaceId,
      message: `${card.agentLabel} automation reset for ${card.workspaceName}`,
      affectedCardIds: [card.id],
      details: cardEventDetails(card, "reset", snapshot.state)
    });

    return this.actionResponse([card.id], input);
  }

  public killCard(cardId: string, input: CardBuildInput): DesktopStateActionResult {
    const card = this.findVisibleCard(cardId, input);
    if (!card) {
      return { statusCode: 404, body: { ok: false, error: "Session card not found" } };
    }

    if (card.source !== "managed-session") {
      return {
        statusCode: 409,
        body: { ok: false, error: `${card.observability} sessions cannot be killed` }
      };
    }

    this.automation.resetCard(card.id);
    this.appendEvent({
      kind: "session-killed",
      cardId: card.id,
      workspaceId: card.workspaceId,
      message: `${card.agentLabel} kill requested for ${card.workspaceName}`,
      affectedCardIds: [card.id],
      details: cardEventDetails(card, "kill", "exited")
    });

    return this.actionResponse([card.id], input);
  }

  public dismissCard(cardId: string, input: CardBuildInput): DesktopStateActionResult {
    const card = this.findVisibleCard(cardId, input);
    if (!card) {
      return { statusCode: 404, body: { ok: false, error: "Session card not found" } };
    }

    this.dismissedCardIds.add(card.id);
    this.automation.dismissCard(card.id);
    this.appendEvent({
      kind: "session-dismissed",
      cardId: card.id,
      workspaceId: card.workspaceId,
      message: `${card.agentLabel} dismissed for ${card.workspaceName}`,
      affectedCardIds: [card.id],
      details: cardEventDetails(card, "dismiss", "hidden")
    });

    return this.actionResponse([card.id], input);
  }

  public armAll(input: CardBuildInput): DesktopStateActionResult {
    const cards = this.createCards(input);
    const eligibleCards = cards.filter((card) => card.canArmAll);
    const affectedCardIds = eligibleCards.map((card) => card.id);

    for (const card of eligibleCards) {
      this.automation.armCard(card.id);
    }

    this.appendEvent({
      kind: "arm-all",
      message:
        affectedCardIds.length === 0
          ? "Arm All found no managed sessions"
          : `Arm All armed ${affectedCardIds.length} managed session${affectedCardIds.length === 1 ? "" : "s"}`,
      affectedCardIds,
      details:
        eligibleCards.length === 0
          ? ["action:arm-all", "result:none"]
          : eligibleCards.flatMap((card) =>
              cardEventDetails(card, "arm-all", "watching")
            )
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
    const automationSnapshot = this.automation.getSnapshot(cardId);
    const automationState = automationSnapshot.state;
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
      automationMode: automationSnapshot.mode,
      canArm: session.status !== "exited" && automationState === "idle",
      canArmAll: session.status !== "exited" && automationState === "idle",
      canResume:
        session.status !== "exited" &&
        (automationState === "paused" || automationState === "dry-run-ready"),
      canReset: automationState !== "idle",
      canKill: session.status !== "exited",
      reason: "Managed bridge session with controlled PTY read/write.",
      lastEvent: latestEvent.message,
      lastEventAt: latestEvent.timestamp,
      chunkCount: automationSnapshot.chunkCount,
      lastDecision: automationSnapshot.lastDecision
    };
  }

  private createHeartbeatTerminalCard(
    heartbeat: ExtensionHeartbeat,
    terminal: TerminalSummary
  ): DesktopSessionCard {
    const cardId = terminalCardId(heartbeat.windowId, terminal.id);
    const automationSnapshot = this.automation.getSnapshot(cardId);
    const automationState = automationSnapshot.state;
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
      automationMode: automationSnapshot.mode,
      canArm: false,
      canArmAll: false,
      canResume: false,
      canReset: automationState !== "idle",
      canKill: false,
      reason: terminal.reason,
      lastEvent: latestEvent.message,
      lastEventAt: latestEvent.timestamp,
      chunkCount: automationSnapshot.chunkCount,
      lastDecision: automationSnapshot.lastDecision
    };
  }

  private createWorkspaceCard(heartbeat: ExtensionHeartbeat): DesktopSessionCard {
    const cardId = workspaceCardId(heartbeat.windowId);
    const automationSnapshot = this.automation.getSnapshot(cardId);
    const automationState = automationSnapshot.state;
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
      automationMode: automationSnapshot.mode,
      canArm: false,
      canArmAll: false,
      canResume: false,
      canReset: automationState !== "idle",
      canKill: false,
      reason: "VS Code window heartbeat received; no managed coder terminal reported yet.",
      lastEvent: latestEvent.message,
      lastEventAt: latestEvent.timestamp,
      chunkCount: automationSnapshot.chunkCount,
      lastDecision: automationSnapshot.lastDecision
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

  private recordAutomationEvent(event: AutomationRuntimeEvent): void {
    this.appendEvent(event);
  }
}

function displayNameForProfile(profileId: BridgeSessionSummary["profileId"]): string {
  return resolveAgentProfile(profileId).displayName;
}

function statusForManagedSession(
  sessionStatus: BridgeSessionSummary["status"],
  automationState: SessionAutomationState
): SessionCardStatus {
  return statusFromAutomationState(automationState) ?? sessionStatus;
}

function statusForObservedTerminal(
  observability: TerminalSummary["observability"],
  automationState: SessionAutomationState
): SessionCardStatus {
  const automationStatus = statusFromAutomationState(automationState);
  if (automationStatus) {
    return automationStatus;
  }
  return observability === "unsupported" ? "unsupported" : "detected";
}

function statusFromAutomationState(
  automationState: SessionAutomationState
): SessionCardStatus | undefined {
  if (automationState === "idle") {
    return undefined;
  }
  return automationState;
}

function latestTimestamp(timestamps: string[]): string | undefined {
  return timestamps
    .filter((timestamp) => !Number.isNaN(Date.parse(timestamp)))
    .sort()
    .at(-1);
}

function heartbeatEventDetails(
  heartbeat: ExtensionHeartbeat,
  action: string,
  result: string
): string[] {
  return [
    `window:${heartbeat.windowId}`,
    `workspace:${heartbeat.workspace.name}`,
    `workspaceId:${heartbeat.workspace.id}`,
    `terminals:${heartbeat.terminals.length}`,
    `action:${action}`,
    `result:${result}`
  ];
}

function sessionEventDetails(
  session: BridgeSessionSummary,
  action: string,
  result: string
): string[] {
  const cardId = managedCardId(session.id);
  return [
    `session:${session.id}`,
    `card:${cardId}`,
    `workspace:${session.workspaceName}`,
    `workspaceId:${session.workspaceId}`,
    `agent:${displayNameForProfile(session.profileId)}`,
    `action:${action}`,
    `result:${result}`
  ];
}

function cardEventDetails(
  card: DesktopSessionCard,
  action: string,
  result: string
): string[] {
  const sessionId = managedSessionIdFromCardId(card.id);
  return [
    ...(sessionId ? [`session:${sessionId}`] : []),
    `card:${card.id}`,
    `workspace:${card.workspaceName}`,
    `workspaceId:${card.workspaceId}`,
    `agent:${card.agentLabel}`,
    `source:${card.source}`,
    `observability:${card.observability}`,
    `action:${action}`,
    `result:${result}`
  ];
}
