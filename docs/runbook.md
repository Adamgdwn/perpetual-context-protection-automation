# Runbook

Last updated: 2026-06-29T20:44:55-06:00

## Purpose

In operation, the desktop app receives VS Code extension heartbeats, shows
session cards, watches armed managed coder sessions, and performs compact/resume
cycles only when detector and idle evidence agree.

## Alerts And Failures

- Bridge disconnected: confirm VS Code is open and the companion extension is
  running.
- No sessions detected: launch or relaunch a managed Claude/Codex session through
  the extension.
- Candidate session only: do not arm unattended; relaunch as managed.
- Stuck compact: pause the session, inspect logs, and resume manually if safe.
- False boundary: pause all, save logs, add transcript fixture before changing
  detector rules.
- Blocked or needs-human: read the session card log and resolve the underlying
  agent request manually.

## Dependencies

- Desktop app installed and running.
- VS Code installed.
- VS Code companion extension installed and enabled.
- Claude and/or Codex CLI available on the target machine.
- Local bridge reachable on localhost.

## Launch

- Use `/home/adamgoodwin/Desktop/Perpetual Context Protection.desktop` on this Linux workstation.
- If the icon needs to be refreshed, run `npm run desktop:install-linux-launcher`.
- The launcher should show the infinity icon and render the full desktop UI. If
  it opens blank, run `npm run desktop:smoke` before live testing.
- Keep automation mode on `Dry Run` for the first observed cycle. Switch to
  `Live` only when Adam is watching and ready to pause.

## Recovery

- Use the app-level pause control before manual intervention.
- Use per-card reset when a card's automation state should return to idle
  without killing the managed terminal.
- Use per-card kill only for the single managed PTY session that should be
  stopped.
- Restart the VS Code extension host if heartbeats stop.
- Restart the desktop app if the bridge is unhealthy.
- If automation is uncertain, continue manually in VS Code.

## Escalation

Escalate to Adam when the app cannot classify a session safely, sends a command
to the wrong session, or platform-specific terminal behavior blocks v1 support.
