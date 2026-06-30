# Domain Language

Document type: shared vocabulary
Audience: project owner, builders, AI coding agents, reviewers, and operators
Purpose: define the terms used consistently across code, docs, tests, UI, prompts, runbooks, and release notes.

## Purpose

This file defines the shared vocabulary for the project.

Important domain terms should be named consistently across labels, database tables, functions, services, tests, docs, prompts, and runbooks.

When a term changes, update this file and the affected code or documentation in the same chunk where practical.

## Terms

| Term | Meaning | Avoid Saying | Code/Docs Usage |
|---|---|---|---|
| Desktop app | The full-window operator control panel used to inspect, arm, pause, and review coder sessions. | watcher UI, dashboard only | Product shell and primary user surface. |
| VS Code companion extension | The VS Code extension installed in each VS Code window to report workspace/session state and perform safe terminal I/O. | plugin, scraper | VS Code integration package. |
| Session card | A UI card representing one detected VS Code workspace, managed coder session, or candidate terminal. | window card, terminal blob | Desktop app session list. |
| Coder session | A running Claude, Codex, or later coding-agent CLI instance that may be watched and controlled. | agent window | Core automation target. |
| Managed session | A coder session launched or adopted through a reliable integration path with known read/write behavior. | watched terminal | Eligible for unattended automation. |
| Candidate session | A detected VS Code terminal or window that may be relevant but is not yet safe to automate. | unknown window | Shown to operator, not armed by default. |
| Observability level | The declared reliability of read/write control for a session: managed, adoptable, candidate, or unsupported. | confidence | Determines whether `Arm` is allowed. |
| Agent profile | A configuration for one coder CLI: launch command, compact command, resume text, signals, and idle rules. | bot config | Claude, Codex, future agents. |
| Boundary signal | Evidence that a coder session has finished a useful chunk and may be compacted. | done text | Pause detector input. |
| Completion signal | Evidence that the overall task has no more chunks and automation should stop. | final done | State machine terminal condition. |
| Blocked signal | Evidence that the coder needs a human decision, access, clarification, or intervention. | error text | State machine terminal condition. |
| Compact cycle | The sequence: boundary detected, compact command sent, compaction completed, resume message sent. | loop | Core automation action. |
| Arm | Enable automation for a selected session. | go, start loop | Operator action. |
| Pause | Temporarily stop automation for a selected session without closing it. | stop | Operator safety action. |

## Naming Guidance

Use domain-specific names. A name should explain the responsibility it owns.

Challenge vague names when they hide unclear responsibility:

- `manager`
- `helper`
- `utils`
- `thing`
- `stuff`
- `data`
- `processor`
- `handler`
- `misc`
- `temp`
- `common`
- `general`

Prefer names that point to the actual domain concept, boundary, or behavior.

## Agent Guidance

When terminology is vague or inconsistent, the agent should:

1. Flag the naming issue.
2. Explain the risk to comprehension, tests, prompts, or future changes.
3. Recommend the smallest safe naming improvement.
4. Keep related code, docs, tests, UI, and prompts aligned when the owner accepts the change.

Do not rename broadly just for style. Improve names when the change fits the active chunk or the owner approves the refactor.
