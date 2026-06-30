# 2026-06-29 VS Code-First Build Plan

Status: active planning spec
Owner: Adam Goodwin

## Product Intent

Perpetual Context Protection is a desktop app for unattended AI-coding sessions.
Before leaving the machine, the operator opens the app, sees detected VS Code
windows and coder sessions, chooses which sessions to arm, and lets the tool
compact and resume those sessions at safe chunk boundaries.

The app must stop cleanly when a task is complete, blocked, needs a human, or the
detector is uncertain.

## V1 Shape

- Cross-platform desktop app for Windows and Linux.
- VS Code companion extension.
- Full-window UI with session cards and logs.
- Claude and Codex profiles first.
- Coder-agnostic profile model for later tools.
- Public GitHub repo under Adam's account.
- Public repo name: `perpetual-context-protection-automation`.

## Non-Goals For V1

- No screen scraping of VS Code windows.
- No blind keystroke injection into unknown terminals.
- No requirement that arbitrary already-open terminals be fully automated.
- No n8n dependency for the first working loop.
- No tmux dependency for the VS Code-first path.
- No autonomous destructive actions outside terminal compact/resume text.

## User Workflow

1. Operator opens VS Code with one or more coding sessions.
2. Operator opens the desktop app.
3. App shows cards for detected VS Code windows and coder sessions.
4. Each card shows observability: managed, adoptable, candidate, or unsupported.
5. Operator arms one card or uses `Arm All Managed`.
6. App watches terminal output and logs detector decisions.
7. At a safe chunk boundary, app sends the profile compact command.
8. App waits until compaction is finished.
9. App sends the profile resume instruction.
10. App repeats until the session is complete, blocked, needs human input, is
    paused, or errors.

## Core Components

### Desktop App

Responsibilities:

- session list and cards
- arm/pause/all controls
- state machine
- detector decisions
- logs
- local config
- agent profiles
- bridge server

Likely stack: TypeScript desktop app so the app, VS Code extension, and shared
protocol types can live in one repo. Exact desktop packaging choice should be
made in Chunk Two after the integration spike.

### VS Code Companion Extension

Responsibilities:

- identify workspace/window instance
- report heartbeats to the desktop app
- launch managed Claude/Codex sessions
- classify detected terminals by observability
- stream terminal output when reliable
- send text commands only when instructed by the desktop app

### Local Bridge

Responsibilities:

- localhost-only communication between desktop app and extension instances
- session registration
- command dispatch
- event streaming
- health checks

Default transport should be localhost WebSocket or HTTP plus Server-Sent Events.
Do not add cloud services for v1.

### Agent Profiles

Profile fields:

- id
- display name
- launch command
- compact command
- resume instruction
- explicit boundary markers
- completion markers
- blocked markers
- idle rules
- prompt hints
- platform overrides

Initial profiles:

- Claude
- Codex

## Session Observability Levels

| Level | UI behavior | Automation behavior |
|---|---|---|
| Managed | Normal session card | Can be armed |
| Adoptable | Session card with adoption prompt | Can be armed only after validation |
| Candidate | Session card with relaunch/adopt guidance | Cannot be armed unattended |
| Unsupported | Informational card or hidden by filter | Cannot be armed |

## Signal Strategy

The detector should not depend on one magic phrase.

Signal sources:

- explicit markers such as `===CHUNK_DONE===`
- terminal quiet period
- prompt/input-ready detection
- Claude/Codex closing language
- plan-state language such as "next chunk", "task complete", or "blocked"
- recently sent command tracking
- streaming/activity suppression

Required detector behavior:

- Compact only when boundary and idle evidence agree.
- Stop when task complete, blocked, needs-human, or uncertain.
- Log all detector decisions.
- Prefer false negatives over unsafe false positives.

## State Machine

```text
discovered
candidate
armed
watching
boundary_candidate
compacting
waiting_for_compact
resuming
complete
blocked
needs_human
paused
error
```

Terminal states until operator action:

- complete
- blocked
- needs_human
- error

## Public Safety Rules

- Operator must arm a session before automation starts.
- Candidate and unsupported sessions cannot be armed unattended.
- The app must expose pause controls at all times.
- Every sent command must be logged with session id, timestamp, agent profile,
  reason, and result.
- The app must not claim success when terminal output cannot be read.
- The app must not continue looping after complete/blocked/needs-human signals.

## Implementation Chunks

Use `docs/current-build-pathway.md` as the authoritative task list. The chunk
sequence is:

1. Repo and public project setup.
2. VS Code integration spike.
3. Desktop shell and session cards.
4. Agent profiles and signal detector.
5. One managed compact cycle.
6. Multi-session arm/pause/all control.
7. Windows/Linux packaging.
8. Public release hardening.

## Open Decisions

- Final desktop packaging stack.
- Exact VS Code terminal I/O path after spike.
- Whether existing arbitrary terminals can be adopted safely in v1 or only shown
  as candidates.
- Exact GitHub owner/remote URL.
- Whether to rename the local directory before or after Git initialization.

## References

- VS Code API reference: https://code.visualstudio.com/api/references/vscode-api
