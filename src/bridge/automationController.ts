import { createHash } from "node:crypto";
import type {
  BridgeSessionSummary,
  DesktopEventKind,
  DesktopSignalDecision,
  SessionAutomationMode,
  SessionAutomationState
} from "../shared/protocol";
import type { AgentSignalPattern, ResolvedAgentProfile } from "../shared/profiles";
import {
  detectSessionSignal,
  type SignalDetectorDecision
} from "../shared/signalDetector";
import { managedCardId } from "./cardIds";

export interface AutomatableSession {
  id: string;
  profile: ResolvedAgentProfile;
  status: BridgeSessionSummary["status"];
  lastOutputAt?: string;
  getOutput: () => string;
  sendLine: (text: string) => void;
  summary: () => BridgeSessionSummary;
}

export interface AutomationSnapshot {
  state: SessionAutomationState;
  mode: SessionAutomationMode;
  chunkCount: number;
  lastDecision?: DesktopSignalDecision;
}

export interface AutomationRuntimeEvent {
  kind: DesktopEventKind;
  cardId: string;
  workspaceId: string;
  affectedCardIds?: string[];
  message: string;
  details?: string[];
}

interface CompactPhase {
  boundaryKey: string;
  compactSentAtMs: number;
  outputLengthAtSend: number;
}

interface AutomationRecord {
  state: SessionAutomationState;
  mode: SessionAutomationMode;
  chunkCount: number;
  handledDryRunBoundaryKeys: Set<string>;
  handledLiveBoundaryKeys: Set<string>;
  lastDecision?: DesktopSignalDecision;
  lastDecisionSignature?: string;
  recentlySentCommandAtMs?: number;
  compactPhase?: CompactPhase;
  resumeSentAtMs?: number;
}

export class AutomationController {
  private readonly records = new Map<string, AutomationRecord>();
  private mode: SessionAutomationMode = "dry-run";

  public getMode(): SessionAutomationMode {
    return this.mode;
  }

  public setMode(mode: SessionAutomationMode): void {
    this.mode = mode;
  }

  public getSnapshot(cardId: string): AutomationSnapshot {
    const record = this.records.get(cardId);
    if (!record) {
      return {
        state: "idle",
        mode: this.mode,
        chunkCount: 0
      };
    }

    return {
      state: record.state,
      mode: record.mode,
      chunkCount: record.chunkCount,
      lastDecision: record.lastDecision
    };
  }

  public armCard(cardId: string): AutomationSnapshot {
    const record = this.ensureRecord(cardId);
    record.mode = this.mode;
    record.state =
      record.mode === "live" && record.compactPhase ? "compacting" : "watching";
    return this.snapshotFromRecord(record);
  }

  public resumeCard(cardId: string): AutomationSnapshot {
    return this.armCard(cardId);
  }

  public pauseCard(cardId: string): AutomationSnapshot {
    const record = this.ensureRecord(cardId);
    record.state = "paused";
    return this.snapshotFromRecord(record);
  }

  public resetCard(cardId: string): AutomationSnapshot {
    this.records.delete(cardId);
    return this.getSnapshot(cardId);
  }

  public dismissCard(cardId: string): void {
    this.records.delete(cardId);
  }

  public recordManualInput(cardId: string, now: Date | number | string = Date.now()): void {
    const record = this.records.get(cardId);
    if (!record) {
      return;
    }
    record.recentlySentCommandAtMs = coerceTime(now) ?? Date.now();
  }

  public evaluateSessions(
    sessions: AutomatableSession[],
    now: Date | number | string = Date.now()
  ): AutomationRuntimeEvent[] {
    const nowMs = coerceTime(now) ?? Date.now();
    const events: AutomationRuntimeEvent[] = [];

    for (const session of sessions) {
      const cardId = managedCardId(session.id);
      const record = this.records.get(cardId);
      if (!record || session.status === "exited") {
        continue;
      }

      if (record.state === "paused" || isTerminalAutomationState(record.state)) {
        continue;
      }

      if (record.state === "resuming") {
        this.promoteResumedSession(record, session, nowMs);
        continue;
      }

      if (record.state === "compacting") {
        this.resumeAfterCompactIfReady(record, session, nowMs, events);
        continue;
      }

      if (record.state !== "watching") {
        continue;
      }

      this.evaluateWatchingSession(record, session, nowMs, events);
    }

    return events;
  }

  private evaluateWatchingSession(
    record: AutomationRecord,
    session: AutomatableSession,
    nowMs: number,
    events: AutomationRuntimeEvent[]
  ): void {
    const decision = detectSessionSignal({
      profile: session.profile,
      output: session.getOutput(),
      now: nowMs,
      lastOutputAt: session.lastOutputAt,
      recentlySentCommandAt: record.recentlySentCommandAtMs
    });
    const desktopDecision = toDesktopDecision(decision, nowMs);
    record.lastDecision = desktopDecision;

    const decisionEvent = this.createDecisionEventIfChanged(record, session);
    if (decisionEvent) {
      events.push(decisionEvent);
    }

    if (decision.stopAutomation) {
      record.state = stopStateForDecision(decision);
      events.push(createAutomationEvent(session, "automation-stop", record, {
        message: `${session.profile.displayName} automation stopped: ${decision.state}`,
        details: decisionDetails(desktopDecision)
      }));
      return;
    }

    if (!decision.shouldCompact) {
      return;
    }

    const boundaryKey = createBoundaryKey(session, decision);
    if (record.mode === "dry-run") {
      if (!record.handledDryRunBoundaryKeys.has(boundaryKey)) {
        record.handledDryRunBoundaryKeys.add(boundaryKey);
        record.state = "dry-run-ready";
        events.push(createAutomationEvent(session, "automation-dry-run", record, {
          message: `${session.profile.displayName} dry run: would compact at detected boundary`,
          details: decisionDetails(desktopDecision)
        }));
      }
      return;
    }

    if (record.handledLiveBoundaryKeys.has(boundaryKey)) {
      return;
    }

    session.sendLine(session.profile.compactCommand);
    record.handledLiveBoundaryKeys.add(boundaryKey);
    record.recentlySentCommandAtMs = nowMs;
    record.compactPhase = {
      boundaryKey,
      compactSentAtMs: nowMs,
      outputLengthAtSend: session.getOutput().length
    };
    record.state = "compacting";
    events.push(createAutomationEvent(session, "automation-compact", record, {
      message: `${session.profile.displayName} compact command sent after boundary and idle agreement`,
      details: decisionDetails(desktopDecision)
    }));
  }

  private resumeAfterCompactIfReady(
    record: AutomationRecord,
    session: AutomatableSession,
    nowMs: number,
    events: AutomationRuntimeEvent[]
  ): void {
    if (!record.compactPhase) {
      return;
    }

    const output = session.getOutput();
    const outputAfterCompactSend = output.slice(record.compactPhase.outputLengthAtSend);
    if (!hasCompactCompleteEvidence(session.profile, outputAfterCompactSend)) {
      return;
    }
    const outputLength = output.length;

    const lastOutputAtMs = coerceTime(session.lastOutputAt);
    const quietForMs =
      lastOutputAtMs === undefined
        ? nowMs - record.compactPhase.compactSentAtMs
        : nowMs - lastOutputAtMs;
    const sentForMs = nowMs - record.compactPhase.compactSentAtMs;

    if (
      quietForMs < session.profile.idleRules.quietPeriodMs ||
      sentForMs < session.profile.idleRules.recentlySentCommandMs
    ) {
      return;
    }

    session.sendLine(session.profile.resumeInstruction);
    record.compactPhase = undefined;
    record.resumeSentAtMs = nowMs;
    record.recentlySentCommandAtMs = nowMs;
    record.state = "resuming";
    record.chunkCount += 1;
    events.push(createAutomationEvent(session, "automation-resume", record, {
      message: `${session.profile.displayName} resume instruction sent after compact quiet period`,
      details: [
        `resume:${session.profile.resumeInstruction}`,
        `quietForMs:${quietForMs}`,
        `outputLength:${outputLength}`
      ]
    }));
  }

  private promoteResumedSession(
    record: AutomationRecord,
    session: AutomatableSession,
    nowMs: number
  ): void {
    if (
      record.resumeSentAtMs !== undefined &&
      nowMs - record.resumeSentAtMs >= session.profile.idleRules.recentlySentCommandMs
    ) {
      record.resumeSentAtMs = undefined;
      record.state = "watching";
    }
  }

  private createDecisionEventIfChanged(
    record: AutomationRecord,
    session: AutomatableSession
  ): AutomationRuntimeEvent | undefined {
    if (!record.lastDecision || record.lastDecision.state === "active") {
      return undefined;
    }

    const signature = [
      record.lastDecision.state,
      record.lastDecision.shouldCompact,
      record.lastDecision.stopAutomation,
      ...record.lastDecision.evidence.map((item) => `${item.kind}:${item.id}`)
    ].join("|");
    if (signature === record.lastDecisionSignature) {
      return undefined;
    }

    record.lastDecisionSignature = signature;
    return createAutomationEvent(session, "automation-decision", record, {
      message: `${session.profile.displayName} detector: ${record.lastDecision.state} - ${record.lastDecision.summary}`,
      details: decisionDetails(record.lastDecision)
    });
  }

  private ensureRecord(cardId: string): AutomationRecord {
    const existing = this.records.get(cardId);
    if (existing) {
      return existing;
    }

    const created: AutomationRecord = {
      state: "idle",
      mode: this.mode,
      chunkCount: 0,
      handledDryRunBoundaryKeys: new Set(),
      handledLiveBoundaryKeys: new Set()
    };
    this.records.set(cardId, created);
    return created;
  }

  private snapshotFromRecord(record: AutomationRecord): AutomationSnapshot {
    return {
      state: record.state,
      mode: record.mode,
      chunkCount: record.chunkCount,
      lastDecision: record.lastDecision
    };
  }
}

function createAutomationEvent(
  session: AutomatableSession,
  kind: DesktopEventKind,
  record: AutomationRecord,
  event: {
    message: string;
    details?: string[];
  }
): AutomationRuntimeEvent {
  const summary = session.summary();
  const cardId = managedCardId(session.id);
  return {
    kind,
    cardId,
    workspaceId: summary.workspaceId,
    affectedCardIds: [cardId],
    message: event.message,
    details: [
      `session:${summary.id}`,
      `card:${cardId}`,
      `workspace:${summary.workspaceName}`,
      `agent:${session.profile.displayName}`,
      `action:${kind}`,
      "result:ok",
      ...(event.details ?? [])
    ]
  };
}

function toDesktopDecision(
  decision: SignalDetectorDecision,
  nowMs: number
): DesktopSignalDecision {
  return {
    state: decision.state,
    shouldCompact: decision.shouldCompact,
    stopAutomation: decision.stopAutomation,
    summary: decision.summary,
    evidence: decision.evidence.map((item) => ({
      kind: item.kind,
      id: item.id,
      description: item.description,
      excerpt: item.excerpt
    })),
    quietForMs: decision.quietForMs,
    timestamp: new Date(nowMs).toISOString()
  };
}

function decisionDetails(decision: DesktopSignalDecision): string[] {
  return [
    `decision:${decision.state}`,
    `shouldCompact:${decision.shouldCompact}`,
    `stopAutomation:${decision.stopAutomation}`,
    ...(decision.quietForMs === undefined ? [] : [`quietForMs:${decision.quietForMs}`]),
    ...decision.evidence.map((item) => {
      const excerpt = item.excerpt ? ` excerpt=${item.excerpt}` : "";
      return `evidence:${item.kind}:${item.id}${excerpt} - ${item.description}`;
    })
  ];
}

function stopStateForDecision(
  decision: SignalDetectorDecision
): SessionAutomationState {
  if (decision.state === "task-complete") {
    return "complete";
  }
  if (decision.state === "blocked") {
    return "blocked";
  }
  if (decision.state === "needs-human") {
    return "needs-human";
  }
  return "uncertain";
}

function isTerminalAutomationState(state: SessionAutomationState): boolean {
  return (
    state === "complete" ||
    state === "blocked" ||
    state === "needs-human" ||
    state === "uncertain" ||
    state === "error"
  );
}

function createBoundaryKey(
  session: AutomatableSession,
  decision: SignalDetectorDecision
): string {
  const output = session.getOutput();
  const boundaryEvidence = decision.evidence.filter(isBoundaryEvidence);
  const evidenceKey = boundaryEvidence
    .map((item) => `${item.kind}:${item.id}:${item.excerpt ?? ""}`)
    .join("|");
  const boundaryPosition = Math.max(
    0,
    ...boundaryEvidence.map((item) =>
      item.excerpt ? output.lastIndexOf(item.excerpt) : -1
    )
  );
  return createHash("sha256")
    .update(`${session.id}:${boundaryPosition}:${evidenceKey}`)
    .digest("hex")
    .slice(0, 16);
}

function isBoundaryEvidence(
  evidence: SignalDetectorDecision["evidence"][number]
): boolean {
  return (
    evidence.kind === "explicit-marker" ||
    evidence.id === "next-chunk-ready" ||
    evidence.id === "next-action-start-chunk" ||
    evidence.id === "chunk-complete"
  );
}

function hasCompactCompleteEvidence(
  profile: ResolvedAgentProfile,
  output: string
): boolean {
  if (profile.signals.compactComplete.some((signal: AgentSignalPattern) =>
    signal.pattern.test(output)
  )) {
    return true;
  }

  if (profile.id !== "codex") {
    return false;
  }

  const recentOutput = output.slice(-2_000);
  return (
    /›[^\r\n]*(?:gpt-\d|gpt-5|context\s+left)/iu.test(recentOutput) &&
    !/\bWorking\s*\(/iu.test(recentOutput)
  );
}

function coerceTime(value: Date | number | string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
