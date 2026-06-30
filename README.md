# Perpetual Context Protection Automation

Last updated: 2026-06-29T20:29:52-06:00

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
- Production status: Chunk Four implementation checkpoint - manual live cycle pending
- Planned public repo name: `perpetual-context-protection-automation`

## Quick Start

Use the existing nvm Node install, then install dependencies and run checks:

```bash
source /home/adamgoodwin/.nvm/nvm.sh
nvm use --silent
npm install
npm run lint
npm test
npm run build
npm run desktop:smoke
npm run test:vscode
```

Use `docs/current-build-pathway.md` as the active implementation route. The
original tmux/n8n research plan in `PLAN.md` is retained as superseded research,
not the current build path.

The current implementation includes the VS Code companion extension, localhost
bridge, managed PTY session path, and Electron desktop shell. The desktop app
renders bridge-backed session cards, append-only logs, and guarded operator
actions where candidate sessions remain visible but cannot be armed unattended.

Launch the draft desktop shell locally with:

```bash
source /home/adamgoodwin/.nvm/nvm.sh
nvm use --silent
npm run desktop:launch
```

Install or refresh the Linux desktop launcher with:

```bash
npm run desktop:install-linux-launcher
```

On this workstation the launcher is installed at:

```text
/home/adamgoodwin/Desktop/Perpetual Context Protection.desktop
```

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
