# Initial Scope - Perpetual Context Protection Automation

Generated: 2026-06-29T18:04:01-06:00
Revised: 2026-06-29T18:55:26-06:00

## Classification

| Field          | Value |
|----------------|-------|
| Project name   | Perpetual Context Protection Automation |
| Public slug    | perpetual-context-protection-automation |
| Current local dir | perpetual-context-protection-automation |
| Type           | automation |
| Governance     | 1 |
| Risk tier      | low |
| Stack          | TypeScript desktop app / VS Code extension |
| Primary model  | hybrid |
| Location       | /home/adamgoodwin/code/Applications/perpetual-context-protection-automation |

## Build approach

Primary builder: **hybrid**

## Scope brief

**Problem:** When coding with loops, there is still a loss of fidelity because
the context window drops off before it auto-compacts. The tool should watch
armed VS Code coder sessions, detect safe pause boundaries, compact the session,
and tell the agent to carry on with the next chunk.

**User / consumer:** Programmers will initiate it.

**MVP:** an installable desktop app plus VS Code companion extension. The app
shows detected VS Code windows and coder sessions as cards, lets the operator
arm selected sessions, logs decisions, and runs compact/resume loops for managed
Claude and Codex sessions on Windows and Linux.

## First session checklist

- [ ] Read `START_HERE.md`
- [ ] Review `docs/current-build-pathway.md`
- [ ] Review `docs/standards/README.md`
- [ ] Review `docs/standards/engineering-governance-by-use-case.md`
- [ ] Review `docs/policy/durable-development-engineering-policy.md`
- [ ] Review `docs/standards/ship-ready-engineering-standard.md`
- [ ] Fill in commands in `AI_BOOTSTRAP.md`
- [ ] Confirm governance level and risk tier in `project-control.yaml`
- [ ] Add first ADR if architecture decisions were made at intake
- [ ] Run governance preflight: `bash scripts/governance-preflight.sh`
