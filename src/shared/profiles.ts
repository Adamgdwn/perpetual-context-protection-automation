import type { AgentProfileId } from "./protocol";

export interface AgentLaunchCommand {
  command: string;
  args: string[];
}

export interface AgentSignalPattern {
  id: string;
  description: string;
  pattern: RegExp;
}

export interface AgentProfileSignals {
  explicitBoundaryMarkers: string[];
  explicitCompleteMarkers: string[];
  explicitBlockedMarkers: string[];
  explicitNeedsHumanMarkers: string[];
  boundary: AgentSignalPattern[];
  complete: AgentSignalPattern[];
  blocked: AgentSignalPattern[];
  needsHuman: AgentSignalPattern[];
  compacting: AgentSignalPattern[];
  compactComplete: AgentSignalPattern[];
  active: AgentSignalPattern[];
  inputReady: AgentSignalPattern[];
  conflictGuards: AgentSignalPattern[];
}

export interface AgentIdleRules {
  quietPeriodMs: number;
  recentlySentCommandMs: number;
  outputLookbackChars: number;
}

export interface AgentPromptHints {
  boundary: string[];
  complete: string[];
  blocked: string[];
  needsHuman: string[];
  inputReady: string[];
  active: string[];
}

export interface ResolvedAgentProfile {
  id: AgentProfileId;
  displayName: string;
  launchCommand: AgentLaunchCommand;
  command: string;
  args: string[];
  compactCommand: string;
  resumeInstruction: string;
  inputSubmitSequence: string;
  inputSubmitDelayMs: number;
  signals: AgentProfileSignals;
  idleRules: AgentIdleRules;
  promptHints: AgentPromptHints;
}

export const BUILT_IN_AGENT_PROFILE_IDS = [
  "claude",
  "codex",
  "echo-proof"
] as const satisfies readonly AgentProfileId[];

export function resolveAgentProfile(
  profileId: AgentProfileId,
  platform: NodeJS.Platform = process.platform
): ResolvedAgentProfile {
  if (profileId === "claude") {
    return createProfile({
      id: "claude",
      displayName: "Claude",
      launchCommand: { command: "claude", args: [] },
      compactCommand: "/compact",
      resumeInstruction: "Carry on with the next chunk.",
      inputSubmitSequence: "\r",
      inputSubmitDelayMs: 0,
      signals: createCoderSignals("claude"),
      idleRules: createCoderIdleRules(),
      promptHints: createCoderPromptHints()
    });
  }

  if (profileId === "codex") {
    return createProfile({
      id: "codex",
      displayName: "Codex",
      launchCommand: { command: "codex", args: [] },
      compactCommand: "/compact",
      resumeInstruction: "Carry on with the next chunk.",
      inputSubmitSequence: "\u001b[13u",
      inputSubmitDelayMs: 25,
      signals: createCoderSignals("codex"),
      idleRules: createCoderIdleRules(),
      promptHints: createCoderPromptHints()
    });
  }

  if (platform === "win32") {
    return createProfile({
      id: "echo-proof",
      displayName: "Echo Proof",
      launchCommand: {
        command: "powershell.exe",
        args: [
          "-NoProfile",
          "-Command",
          "$OutputEncoding=[Console]::OutputEncoding; Write-Output 'PCPA_PROOF_READY'; while ($null -ne ($line = [Console]::In.ReadLine())) { Write-Output ('PCPA_PROOF_ECHO:' + $line) }"
        ]
      },
      compactCommand: "/compact",
      resumeInstruction: "Carry on with the next chunk.",
      inputSubmitSequence: "\r",
      inputSubmitDelayMs: 0,
      signals: createEchoProofSignals(),
      idleRules: createCoderIdleRules(),
      promptHints: createEchoProofPromptHints()
    });
  }

  return createProfile({
    id: "echo-proof",
    displayName: "Echo Proof",
    launchCommand: {
      command: "/bin/sh",
      args: [
        "-lc",
        "printf 'PCPA_PROOF_READY\\n'; while IFS= read -r line; do printf 'PCPA_PROOF_ECHO:%s\\n' \"$line\"; done"
      ]
    },
    compactCommand: "/compact",
    resumeInstruction: "Carry on with the next chunk.",
    inputSubmitSequence: "\r",
    inputSubmitDelayMs: 0,
    signals: createEchoProofSignals(),
    idleRules: createCoderIdleRules(),
    promptHints: createEchoProofPromptHints()
  });
}

function createProfile(
  profile: Omit<ResolvedAgentProfile, "command" | "args">
): ResolvedAgentProfile {
  return {
    ...profile,
    command: profile.launchCommand.command,
    args: profile.launchCommand.args
  };
}

function createCoderSignals(profileId: "claude" | "codex"): AgentProfileSignals {
  const displayName = profileId === "claude" ? "Claude" : "Codex";
  return {
    explicitBoundaryMarkers: ["===CHUNK_DONE==="],
    explicitCompleteMarkers: ["===TASK_COMPLETE==="],
    explicitBlockedMarkers: ["===BLOCKED==="],
    explicitNeedsHumanMarkers: ["===NEEDS_HUMAN==="],
    boundary: [
      signal(
        "next-chunk-ready",
        `${displayName} says the current chunk is ready to hand off to the next chunk`,
        /\b(?:ready|set)\s+for\s+(?:the\s+)?next\s+chunk\b/iu
      ),
      signal(
        "next-action-start-chunk",
        `${displayName} names a next action that starts or proceeds with another chunk`,
        /\bnext\s+action\s*:\s*(?:start|begin|proceed\s+with|carry\s+on\s+with)\s+(?:the\s+)?(?:next\s+)?chunk\b/iu
      ),
      signal(
        "chunk-complete",
        `${displayName} describes the current chunk as complete`,
        /\bchunk(?:\s+[\w-]+)?\s+(?:is\s+)?(?:draft\s+)?(?:complete|done|finished)\b/iu
      )
    ],
    complete: [
      signal(
        "requested-task-complete",
        `${displayName} says the requested task is complete`,
        /\b(?:requested\s+)?task\s+(?:is\s+)?complete\b/iu
      ),
      signal(
        "no-required-work-remains",
        `${displayName} says no required work remains`,
        /\bno\s+(?:required\s+)?work\s+remains\b/iu
      )
    ],
    blocked: [
      signal(
        "blocked",
        `${displayName} reports a blocked state`,
        /\b(?:blocked|cannot\s+proceed|can't\s+proceed|unable\s+to\s+continue)\b/iu
      ),
      signal(
        "missing-access",
        `${displayName} reports missing access or credentials`,
        /\b(?:missing|need|requires?)\s+(?:access|credentials|permission|approval)\b/iu
      )
    ],
    needsHuman: [
      signal(
        "needs-human",
        `${displayName} asks for human attention`,
        /\b(?:needs?\s+human|human\s+(?:input|attention|review)|operator\s+input)\b/iu
      ),
      signal(
        "needs-decision",
        `${displayName} asks for a human decision or clarification`,
        /\b(?:please\s+confirm|need\s+(?:your\s+)?(?:decision|clarification|input)|waiting\s+for\s+(?:your\s+)?(?:decision|input|confirmation))\b/iu
      )
    ],
    compacting: [
      signal(
        "compact-command",
        `${displayName} compact command is visible in the transcript`,
        /(?:^|\n)\s*\/compact\b/iu
      ),
      signal(
        "compacting",
        `${displayName} appears to be compacting context`,
        /\b(?:compacting|compact(?:ion)?\s+in\s+progress|summarizing\s+context)\b/iu
      )
    ],
    compactComplete: [
      signal(
        "context-compacted",
        `${displayName} reports that context compaction completed`,
        /\b(?:context\s+compacted|compaction\s+complete|compact\s+complete|compacted\s+context)\b/iu
      )
    ],
    active: [
      signal(
        "running-command",
        `${displayName} reports an active command or test run`,
        /\b(?:running|executing|building|installing|waiting\s+for)\b.*\b(?:tests?|command|build|install|process|server|tool)\b/iu
      ),
      signal(
        "tool-call",
        `${displayName} transcript shows active tool output`,
        /\b(?:tool\s+call|command\s+output|still\s+running|streaming)\b/iu
      )
    ],
    inputReady: [
      signal(
        "shell-prompt",
        `${displayName} transcript includes a shell prompt`,
        /(?:^|\n)\s*[$#%>]\s*$/u
      ),
      signal(
        "input-ready",
        `${displayName} says it is ready for input`,
        /\b(?:ready\s+for\s+input|awaiting\s+input|input\s+ready)\b/iu
      )
    ],
    conflictGuards: [
      signal(
        "negated-status",
        `${displayName} negates a terminal or boundary status`,
        /\b(?:not|n't|cannot|can't|do\s+not|don't|should\s+not|shouldn't)\b.{0,48}\b(?:complete|done|finished|blocked|ready)\b/iu
      )
    ]
  };
}

function createEchoProofSignals(): AgentProfileSignals {
  return {
    explicitBoundaryMarkers: ["===CHUNK_DONE==="],
    explicitCompleteMarkers: ["===TASK_COMPLETE==="],
    explicitBlockedMarkers: ["===BLOCKED==="],
    explicitNeedsHumanMarkers: ["===NEEDS_HUMAN==="],
    boundary: [],
    complete: [],
    blocked: [],
    needsHuman: [],
    compacting: [],
    compactComplete: [],
    active: [],
    inputReady: [
      signal(
        "echo-ready",
        "Echo proof process is ready to receive input",
        /\bPCPA_PROOF_READY\b/u
      )
    ],
    conflictGuards: []
  };
}

function createCoderIdleRules(): AgentIdleRules {
  return {
    quietPeriodMs: 30_000,
    recentlySentCommandMs: 15_000,
    outputLookbackChars: 12_000
  };
}

function createCoderPromptHints(): AgentPromptHints {
  return {
    boundary: [
      "Use ===CHUNK_DONE=== when a chunk is finished but more chunks remain.",
      "Natural next-chunk language is treated as a candidate until idle evidence agrees."
    ],
    complete: ["Use ===TASK_COMPLETE=== only when no required work remains."],
    blocked: ["Use ===BLOCKED=== when work cannot continue without intervention."],
    needsHuman: ["Use ===NEEDS_HUMAN=== when operator input or review is needed."],
    inputReady: ["A quiet terminal or prompt-ready state is required before automation injects text."],
    active: ["Streaming output, running tools, or recently sent commands suppress compaction."]
  };
}

function createEchoProofPromptHints(): AgentPromptHints {
  return {
    boundary: ["PCPA_PROOF_READY is used only by tests and I/O proof sessions."],
    complete: [],
    blocked: [],
    needsHuman: [],
    inputReady: ["PCPA_PROOF_READY means the proof terminal can receive input."],
    active: []
  };
}

function signal(
  id: string,
  description: string,
  pattern: RegExp
): AgentSignalPattern {
  return { id, description, pattern };
}
