import type { AgentProfileId, SessionSignalState } from "./protocol";
import {
  resolveAgentProfile,
  type AgentSignalPattern,
  type ResolvedAgentProfile
} from "./profiles";

export type SignalDetectorState = SessionSignalState;

export type SignalEvidenceKind =
  | "explicit-marker"
  | "profile-pattern"
  | "idle"
  | "active"
  | "conflict"
  | "recent-command";

export interface SignalEvidence {
  kind: SignalEvidenceKind;
  id: string;
  description: string;
  excerpt?: string;
}

export interface SignalDetectorInput {
  profile: AgentProfileId | ResolvedAgentProfile;
  output: string;
  now?: Date | number | string;
  lastOutputAt?: Date | number | string;
  inputReady?: boolean;
  recentlySentCommandAt?: Date | number | string;
}

export interface SignalDetectorDecision {
  state: SignalDetectorState;
  shouldCompact: boolean;
  stopAutomation: boolean;
  summary: string;
  evidence: SignalEvidence[];
  quietForMs?: number;
}

interface SignalMatches {
  boundary: SignalEvidence[];
  complete: SignalEvidence[];
  blocked: SignalEvidence[];
  needsHuman: SignalEvidence[];
  compacting: SignalEvidence[];
  active: SignalEvidence[];
  inputReady: SignalEvidence[];
  conflicts: SignalEvidence[];
}

export function detectSessionSignal(
  input: SignalDetectorInput
): SignalDetectorDecision {
  const profile =
    typeof input.profile === "string"
      ? resolveAgentProfile(input.profile)
      : input.profile;
  const recentOutput = tail(input.output, profile.idleRules.outputLookbackChars);
  const matches = collectSignalMatches(profile, recentOutput);
  const now = coerceTime(input.now) ?? Date.now();
  const lastOutputAt = coerceTime(input.lastOutputAt);
  const recentlySentCommandAt = coerceTime(input.recentlySentCommandAt);
  const quietForMs = lastOutputAt === undefined ? undefined : now - lastOutputAt;
  const quietEvidence =
    quietForMs !== undefined && quietForMs >= profile.idleRules.quietPeriodMs;
  const inputReadyEvidence =
    input.inputReady === true ||
    (input.inputReady !== false && matches.inputReady.length > 0);
  const recentCommand =
    recentlySentCommandAt !== undefined &&
    now - recentlySentCommandAt < profile.idleRules.recentlySentCommandMs;
  const idleEvidence = quietEvidence || inputReadyEvidence;

  const idleReasons: SignalEvidence[] = [];
  if (quietEvidence) {
    idleReasons.push({
      kind: "idle",
      id: "quiet-period",
      description: `Output has been quiet for ${quietForMs}ms.`
    });
  }
  if (inputReadyEvidence) {
    idleReasons.push(
      input.inputReady === true
        ? {
            kind: "idle",
            id: "input-ready-observed",
            description: "The integration reported the terminal as input-ready."
          }
        : matches.inputReady[0]
    );
  }

  const recentCommandReason: SignalEvidence | undefined = recentCommand
    ? {
        kind: "recent-command",
        id: "recent-command",
        description: "A command was recently sent, so automation should wait."
      }
    : undefined;
  const activeReasons = [
    ...matches.active,
    ...(recentCommandReason ? [recentCommandReason] : [])
  ];
  const boundaryReasons = matches.boundary;
  const terminalDecision = decideTerminalState(matches, activeReasons);

  if (terminalDecision) {
    return terminalDecision;
  }

  if (matches.compacting.length > 0) {
    return decision("compacting", false, true, "Session appears to be compacting.", [
      ...matches.compacting,
      ...activeReasons
    ], quietForMs);
  }

  if (matches.conflicts.length > 0 && hasAnySignal(matches)) {
    return decision(
      "uncertain",
      false,
      true,
      "Conflicting signal language was detected.",
      [...matches.conflicts, ...allPositiveSignals(matches), ...activeReasons],
      quietForMs
    );
  }

  if (boundaryReasons.length > 0) {
    if (idleEvidence && activeReasons.length === 0) {
      return decision(
        "chunk-boundary",
        true,
        false,
        "Boundary signal and idle evidence agree.",
        [...boundaryReasons, ...idleReasons],
        quietForMs
      );
    }

    const hasOnlyRecentCommand =
      activeReasons.length === 1 && activeReasons[0]?.kind === "recent-command";
    if (activeReasons.length === 0 || hasOnlyRecentCommand) {
      return decision(
        "active",
        false,
        false,
        "Boundary language appeared before safe idle agreement; waiting.",
        [...boundaryReasons, ...idleReasons, ...activeReasons],
        quietForMs
      );
    }

    return decision(
      "uncertain",
      false,
      true,
      "Boundary language appeared without safe idle agreement.",
      [...boundaryReasons, ...idleReasons, ...activeReasons],
      quietForMs
    );
  }

  if (activeReasons.length > 0 || !idleEvidence) {
    return decision(
      "active",
      false,
      false,
      "No safe boundary or stop signal was detected.",
      activeReasons,
      quietForMs
    );
  }

  return decision(
    "active",
    false,
    false,
    "Idle terminal has no boundary or stop signal yet.",
    idleReasons,
    quietForMs
  );
}

function decideTerminalState(
  matches: SignalMatches,
  activeReasons: SignalEvidence[]
): SignalDetectorDecision | undefined {
  const hasComplete = matches.complete.length > 0;
  const hasBlocked = matches.blocked.length > 0;
  const hasNeedsHuman = matches.needsHuman.length > 0;
  const conflictsWithComplete = hasComplete && (hasBlocked || hasNeedsHuman);
  const hasActiveConflict = activeReasons.length > 0 && (hasComplete || hasBlocked || hasNeedsHuman);
  const hasLanguageConflict =
    matches.conflicts.length > 0 && (hasComplete || hasBlocked || hasNeedsHuman);

  if (conflictsWithComplete || hasActiveConflict || hasLanguageConflict) {
    return decision(
      "uncertain",
      false,
      true,
      "Stop-state signals conflict with other evidence.",
      [
        ...matches.complete,
        ...matches.blocked,
        ...matches.needsHuman,
        ...matches.conflicts,
        ...activeReasons
      ]
    );
  }

  if (hasComplete) {
    return decision(
      "task-complete",
      false,
      true,
      "The session reports the task is complete.",
      matches.complete
    );
  }

  if (hasBlocked) {
    return decision(
      "blocked",
      false,
      true,
      "The session reports a blocked state.",
      [...matches.blocked, ...matches.needsHuman]
    );
  }

  if (hasNeedsHuman) {
    return decision(
      "needs-human",
      false,
      true,
      "The session asks for human input.",
      matches.needsHuman
    );
  }

  return undefined;
}

function collectSignalMatches(
  profile: ResolvedAgentProfile,
  output: string
): SignalMatches {
  return {
    boundary: [
      ...collectMarkerMatches(
        profile.signals.explicitBoundaryMarkers,
        "boundary-marker",
        output
      ),
      ...collectPatternMatches(profile.signals.boundary, output)
    ],
    complete: [
      ...collectMarkerMatches(
        profile.signals.explicitCompleteMarkers,
        "complete-marker",
        output
      ),
      ...collectPatternMatches(profile.signals.complete, output)
    ],
    blocked: [
      ...collectMarkerMatches(
        profile.signals.explicitBlockedMarkers,
        "blocked-marker",
        output
      ),
      ...collectPatternMatches(profile.signals.blocked, output)
    ],
    needsHuman: [
      ...collectMarkerMatches(
        profile.signals.explicitNeedsHumanMarkers,
        "needs-human-marker",
        output
      ),
      ...collectPatternMatches(profile.signals.needsHuman, output)
    ],
    compacting: collectPatternMatches(profile.signals.compacting, output),
    active: collectPatternMatches(profile.signals.active, output).map((item) => ({
      ...item,
      kind: "active"
    })),
    inputReady: collectPatternMatches(profile.signals.inputReady, output),
    conflicts: collectPatternMatches(profile.signals.conflictGuards, output).map(
      (item) => ({ ...item, kind: "conflict" })
    )
  };
}

function collectMarkerMatches(
  markers: string[],
  idPrefix: string,
  output: string
): SignalEvidence[] {
  return markers
    .filter((marker) => output.includes(marker))
    .map((marker) => ({
      kind: "explicit-marker",
      id: `${idPrefix}:${marker}`,
      description: `Explicit marker ${marker} was present.`,
      excerpt: marker
    }));
}

function collectPatternMatches(
  patterns: AgentSignalPattern[],
  output: string
): SignalEvidence[] {
  return patterns.flatMap((signal) => {
    const match = output.match(signal.pattern);
    if (!match) {
      return [];
    }

    return [
      {
        kind: "profile-pattern" as const,
        id: signal.id,
        description: signal.description,
        excerpt: match[0]
      }
    ];
  });
}

function hasAnySignal(matches: SignalMatches): boolean {
  return allPositiveSignals(matches).length > 0;
}

function allPositiveSignals(matches: SignalMatches): SignalEvidence[] {
  return [
    ...matches.boundary,
    ...matches.complete,
    ...matches.blocked,
    ...matches.needsHuman,
    ...matches.compacting,
    ...matches.active
  ];
}

function decision(
  state: SignalDetectorState,
  shouldCompact: boolean,
  stopAutomation: boolean,
  summary: string,
  evidence: SignalEvidence[],
  quietForMs?: number
): SignalDetectorDecision {
  return {
    state,
    shouldCompact,
    stopAutomation,
    summary,
    evidence,
    quietForMs
  };
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

function tail(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(value.length - maxLength);
}
