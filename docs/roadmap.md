# Roadmap

Last Updated: 2026-06-30T10:32:05-06:00

## Now - Milestone 3.5: Pause Point And Live Testing

- Public repo and local path are aligned at `perpetual-context-protection-automation`.
- Guided AI Labs branding and the public GitHub README/screenshots are in place.
- Living docs and 01 Work Tracking are updated for a clean pause.
- Next implementation work starts with Adam-observed dry-run/live testing on a
  disposable managed Codex or Claude session.

## Completed - Milestone 1: VS Code Integration Proof

- Scaffolded desktop app and VS Code extension workspaces.
- Proved extension-to-desktop heartbeat.
- Proved bridge-owned managed PTY read/write path for Linux.
- Showed detected VS Code windows and session cards in the desktop app.

## Completed - Milestone 2: One Safe Loop

- Implemented session state machine and logs.
- Added Claude and Codex profiles.
- Implemented dry-run detection for one managed session.
- Sent compact/resume only after boundary and idle signals agreed in watched
  Codex live-cycle evidence.

## Completed - Milestone 3: Multi-Session Control

- Arm one session or all eligible managed sessions.
- Per-session pause, kill, reset, and complete/blocked states.
- Workspace-grouped session cards, event log, settings, and operator guide.
- Candidate/unsupported sessions remain visible but unarmable.

## Next - Milestone 4: Packaging And Release Evidence

- Adam-observed dry-run/live testing on a disposable managed session.
- Windows validation and packaging.
- Desktop package format decision.
- Fresh-platform smoke evidence.
- GitHub issue/contribution templates and release draft.
- Release review only after limitations and rollback evidence are current.

## Later

- Best-effort adoption of already-running arbitrary VS Code terminals
- n8n notifications or workflow hooks
- tmux adapter for users who prefer terminal-native control
- Additional coder profiles beyond Claude and Codex
