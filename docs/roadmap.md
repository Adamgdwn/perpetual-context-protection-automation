# Roadmap

Last Updated: 2026-06-29T18:37:53-06:00

## Now - Milestone 0: Repo And Product Alignment

- Correct public repo name to `perpetual-context-protection-automation`
- Initialize local Git and create public GitHub repo under Adam's account
- Keep the old tmux/n8n plan as superseded research
- Use the VS Code-first build pathway as the active plan

## Next - Milestone 1: VS Code Integration Proof

- Scaffold desktop app and VS Code extension workspaces
- Prove extension-to-desktop heartbeat
- Prove at least one reliable terminal read/write path for Claude or Codex
- Show detected VS Code windows and session cards in the desktop app

## Then - Milestone 2: One Safe Loop

- Implement session state machine and logs
- Add Claude and Codex profiles
- Implement dry-run detection for one managed session
- Send compact/resume only after boundary and idle signals agree

## After - Milestone 3: Multi-Session Control

- Arm one session or all eligible managed sessions
- Per-session pause, kill, reset, and complete/blocked states
- Windows and Linux validation
- Installer packaging for both platforms

## Later

- Best-effort adoption of already-running arbitrary VS Code terminals
- n8n notifications or workflow hooks
- tmux adapter for users who prefer terminal-native control
- Additional coder profiles beyond Claude and Codex
