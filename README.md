# Perpetual Context Protection Automation

## Purpose

A reusable desktop app and VS Code companion extension for protecting long
AI-coding sessions from context-window drift.

The operator opens the desktop app before stepping away, sees cards for detected
VS Code windows and coder sessions, chooses which sessions to arm, and lets the
tool compact and resume Claude, Codex, or later coder CLIs at safe chunk
boundaries.

The product goal is coder agnostic: observe when a session is paused at a useful
boundary, send the configured compact command, wait for compaction to finish,
send the configured resume instruction, and stop cleanly when the task is
complete or blocked.

## Status

- Owner: Adam Goodwin
- Technical lead: hybrid session (Claude Code + Codex)
- Governance level: 1
- Risk tier: low
- Production status: revised planning - VS Code-first implementation not yet started
- Planned public repo name: `perpetual-context-protection-automation`

## Quick Start

No runnable code yet.

Use `docs/current-build-pathway.md` as the active implementation route. The
original tmux/n8n research plan in `PLAN.md` is retained as superseded research,
not the current build path.

The first implementation slice proves the VS Code integration can detect
windows/sessions, create session cards, and reliably read/write at least one
managed coder terminal.

## Key Files

- `docs/current-build-pathway.md` - active token-friendly chunk plan
- `docs/specs/2026-06-29-vscode-first-build-plan.md` - product and architecture plan
- `docs/architecture.md` - current system architecture
- `docs/roadmap.md` - milestone timeline
- `PLAN.md` - superseded tmux/n8n research plan retained for reference

## Documentation

- `docs/architecture.md`
- `docs/context-map.md`
- `docs/current-build-pathway.md`
- `docs/manual.md`
- `docs/roadmap.md`
- `docs/policy/durable-development-engineering-policy.md`
- `docs/standards/README.md`
- `docs/standards/engineering-governance-by-use-case.md`
- `docs/standards/ship-ready-engineering-standard.md`
- `docs/standards/context-hygiene-standard.md`
- `docs/deployment-guide.md`
- `docs/runbook.md`
- `docs/CHANGELOG.md`
- `docs/risks/risk-register.md`

## Support Model

Maintained by Adam Goodwin. Operational issues handled via Claude Code or Codex sessions using the standard agentic workflow.
