# Architecture Overview

Last Updated: 2026-06-29T18:37:53-06:00

## Summary

The current architecture is VS Code-first.

The system is a cross-platform desktop control app plus a VS Code companion
extension. The desktop app is the operator surface and policy/state machine. The
VS Code extension is the window/session integration layer that reports detected
VS Code workspaces and observable coder terminals, streams terminal output where
the API path supports it, and sends compact/resume commands when the desktop app
arms a session.

tmux and n8n are optional future adapters, not the v1 foundation.

## Components

```text
Desktop app
  - full window control panel
  - session cards, logs, arm/pause/all controls
  - pause-boundary detector and compact/resume state machine
  - local config, session event log, agent profiles

Local bridge
  - localhost HTTP/WebSocket channel
  - desktop app accepts heartbeats from VS Code extension instances
  - extension receives arm/pause/compact/resume commands from desktop app

VS Code companion extension
  - runs inside each VS Code window where installed
  - reports workspace identity and candidate coder terminals
  - launches managed Claude/Codex terminals
  - reads terminal output when reliable
  - sends compact/resume text to the selected terminal

Coder sessions
  - Claude, Codex, and later coder CLIs
  - each uses a profile: launch command, compact command, resume text,
    completion signals, blocked signals, and idle rules
```

## Session Observability

Every detected session card must expose its observability level.

| Level | Meaning | V1 behavior |
|---|---|---|
| Managed | Launched by the extension or connected through a reliable output stream | Can be armed for unattended compact/resume |
| Adoptable | Looks like a Claude/Codex session and has enough API support to read/write safely | Ask operator before adopting; validate in dry-run first |
| Candidate | VS Code window or terminal appears relevant but cannot be read reliably | Show card, but offer relaunch as managed instead of unattended automation |
| Unsupported | Terminal cannot be observed or controlled safely | Do not arm |

This keeps the product aligned with the desired workflow - open the app, see
the windows/sessions, choose what to run - without depending on brittle screen
scraping.

## Pause Detection

Pause detection is multi-signal. A single phrase is not enough.

Signals:

- explicit protocol markers such as `===CHUNK_DONE===`, `===TASK_COMPLETE===`,
  `===BLOCKED===`, and `===NEEDS_HUMAN===`
- terminal quiet period after output
- prompt or input-ready indication when available
- known closing phrases from Claude/Codex responses
- plan-state cues such as no remaining chunks or a declared stop condition
- negative signals such as active streaming, tool execution, user typing, or
  recently sent compact/resume command

The state machine may only inject `/compact` when a positive boundary signal and
an idle/input-ready signal agree.

## State Machine

```text
Detected
  -> Candidate
  -> Armed
  -> Watching
  -> BoundaryCandidate
  -> Compacting
  -> WaitingForCompact
  -> Resuming
  -> Watching
  -> Complete | Blocked | NeedsHuman | Paused | Error
```

Important rules:

- `Complete`, `Blocked`, and `NeedsHuman` are terminal states until the operator
  explicitly resumes or resets the session.
- If the detector is uncertain, the session becomes `NeedsHuman`; it does not
  guess and inject commands.
- `Arm All` applies only to managed or explicitly adopted sessions.

## Key Decisions

- **VS Code is the product home.** v1 is not a standalone tmux watcher.
- **Desktop app owns orchestration.** VS Code extensions report sessions and
  execute terminal I/O; the desktop app owns user decisions and automation
  policy.
- **Managed sessions are the reliable path.** Existing terminals may be shown as
  candidates, but unattended automation requires a reliable read/write path.
- **Signals are layered.** Explicit markers are preferred, but natural-language
  closing patterns and idle evidence are part of v1.
- **Coder profiles keep the system agent agnostic.** Claude and Codex ship first;
  later agents add profiles rather than custom core logic.

## Reference Constraints

The VS Code API includes terminal enumeration and text sending, shell
integration events, and `TerminalShellExecution.read()` for command output
streams when shell integration supports it. This must be validated with the
interactive Claude/Codex CLIs in Chunk One before depending on it:

- https://code.visualstudio.com/api/references/vscode-api
