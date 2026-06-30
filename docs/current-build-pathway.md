# Current Build Pathway

Last Updated: 2026-06-29T19:18:45-06:00
Status: Chunk One draft complete - Chunk Two ready
Owner: Technical Lead

> **Single active pathway document.** This is the live path from planning to a
> usable v1. `PLAN.md` is superseded research. Use this file for implementation
> chunks and validation evidence.

## Purpose

Build Perpetual Context Protection as a reusable, public, installable desktop
app with a VS Code companion extension. The operator opens the app, sees cards
for detected VS Code windows and coder sessions, chooses which sessions to arm,
and the tool safely compacts and resumes Claude/Codex sessions until the task is
complete, blocked, or paused.

## Current Product Constraints

- V1 must work on Windows and Linux.
- V1 must be VS Code-first.
- V1 must support Claude and Codex profiles.
- V1 should be coder agnostic by design.
- V1 should show a full window UI with session cards and logs.
- V1 may show arbitrary detected terminals as candidates, but unattended
  automation requires reliable read/write observability.
- V1 must avoid screen scraping and blind keystroke injection.
- V1 must stop on complete, blocked, needs-human, or uncertain states instead of
  looping forever.
- Keep chunks small. Avoid gold plating.

## Required Work Pattern

For ordinary scoped work:

1. Run `git status --short`. If the repo is not initialized, report that and use
   Chunk Zero.
2. Read the short repo-local agent instructions.
3. Open only this file plus task-specific files.
4. Run the fastest relevant validation after changes.
5. Update this file when chunk status, validation, or next handoff changes.

For material or risk-triggering work:

1. Start from `START_HERE.md`.
2. Run `bash scripts/governance-preflight.sh`.
3. Review the relevant standards named in `docs/context-map.md`.
4. Review `project-control.yaml` and open exceptions.
5. Capture a timestamp with `date -Iseconds`.
6. Work in the smallest complete chunk that can be reviewed safely.

## Completion State Rule

Agents may report only bounded states: `Draft complete`, `Task complete`,
`Integration complete`, `Release ready`, or `Blocked`. Project completion is a
human decision.

## Active Path

| Step | Status | Timestamp | Owner | Notes |
|---|---|---|---|---|
| Planning revision | done | 2026-06-29T18:37:53-06:00 | Adam + Codex | VS Code-first desktop app + extension direction confirmed |
| Chunk Zero - Repo and public project setup | done | 2026-06-29T18:55:26-06:00 | build agent | Git initialized, public remote pushed, corrected local path cleanup complete |
| Chunk One - VS Code integration spike | done | 2026-06-29T19:18:45-06:00 | build agent | Bridge-owned `node-pty` path proved on Linux; Windows validation handoff recorded |
| Chunk Two - Desktop shell and session cards | active | 2026-06-29T19:18:45-06:00 | build agent | Full window UI and extension bridge |
| Chunk Three - Agent profiles and signal detector | pending | - | build agent | Claude/Codex profiles, multi-signal boundary detection |
| Chunk Four - One managed compact cycle | pending | - | build agent | Safe dry-run then live compact/resume for one session |
| Chunk Five - Multi-session arm/pause/all control | pending | - | build agent | Multiple session cards, operator approvals, logs |
| Chunk Six - Windows/Linux packaging | pending | - | build agent | Installable app + extension setup |
| Chunk Seven - Public release hardening | pending | - | build agent | Docs, examples, security notes, GitHub release path |

## Chunk Zero - Repo And Public Project Setup

Status: done

Completion target: Task complete

Budget class: Small

Objective: Make the repository real and align names before implementation.

Inputs:

- `README.md`
- `START_HERE.md`
- `project-control.yaml`
- `docs/current-build-pathway.md`

Outputs:

- Local Git repository initialized
- Public GitHub repo under Adam's account
- Corrected public repo name: `perpetual-context-protection-automation`
- Current local directory either renamed or documented as temporary
- First commit pushed

Acceptance criteria:

- [x] `git status --short` works from repo root
- [x] remote `origin` points to Adam's public GitHub repo
- [x] repo name uses `context`, not the typo spelling
- [x] initial commit includes planning docs and governance scaffold
- [x] README states the VS Code-first product direction
- [x] `project-control.yaml` matches the corrected repo/product name

Validation:

```bash
git status --short
git remote -v
bash scripts/governance-preflight.sh
```

Evidence:

- 2026-06-29T18:55:26-06:00: `git status --short` worked from repo root and showed only planned documentation cleanup before commit.
- 2026-06-29T18:55:26-06:00: `git remote -v` confirmed `origin` points to `https://github.com/Adamgdwn/perpetual-context-protection-automation.git`.
- 2026-06-29T18:55:26-06:00: strict typo-path search across `README.md`, `START_HERE.md`, `INITIAL_SCOPE.md`, `project-control.yaml`, and `docs/` returned no stale local-path matches.
- 2026-06-29T18:55:26-06:00: `bash scripts/governance-preflight.sh` passed with 0 warnings.

Stop condition: Stop if GitHub authentication, repo visibility, or local
directory rename requires Adam's decision.

Next action: Start Chunk One and prove the VS Code terminal read/write path.

---

## Chunk One - VS Code Integration Spike

Status: done

Completion target: Draft complete

Budget class: Medium

Objective: Prove the core technical assumption before building product surface:
the VS Code companion extension can discover a VS Code window, identify or start
a coder terminal, read enough output to detect state, and send text back to that
terminal on both Windows and Linux.

Inputs:

- `docs/specs/2026-06-29-vscode-first-build-plan.md`
- `docs/architecture.md`
- VS Code API docs for terminal APIs

Outputs:

- Minimal VS Code extension scaffold
- Minimal local desktop/bridge stub or CLI bridge
- Spike notes documenting which terminal I/O path works:
  - shell integration stream
  - extension-owned pseudoterminal
  - `node-pty` bridge
  - other adapter
- Observability result matrix for Claude and Codex on Linux and Windows

Acceptance criteria:

- [x] Extension starts in VS Code dev host
- [x] Extension sends heartbeat to local bridge with workspace/window identity
- [x] Extension can launch a managed Claude or Codex session
- [x] Extension or bridge can read output from that managed session
- [x] Extension or bridge can send text into that managed session
- [x] Linux result is proven locally
- [x] Windows result is proven or a specific Windows validation handoff is recorded
- [x] Unsupported arbitrary terminals are classified as candidate/unsupported, not silently automated

Validation:

```bash
npm audit
npm run lint
npm test
npm run test:vscode
```

Evidence:

- 2026-06-29T19:18:45-06:00: Added root TypeScript/npm scaffold, VS Code extension manifest, localhost bridge, `node-pty` managed session runtime, and extension-host test runner.
- 2026-06-29T19:18:45-06:00: `npm audit` passed with 0 vulnerabilities after removing unnecessary Mocha dependency.
- 2026-06-29T19:18:45-06:00: `npm run lint` passed.
- 2026-06-29T19:18:45-06:00: `npm test` passed; bridge accepted heartbeat, launched managed echo PTY, read output, and sent input.
- 2026-06-29T19:18:45-06:00: `npm run test:vscode` passed under `xvfb`; VS Code extension host activated, heartbeat command worked, managed Codex launch command worked, and bridge-backed echo read/write proof passed.
- 2026-06-29T19:18:45-06:00: Spike notes and observability matrix recorded in `docs/spikes/2026-06-29-1918-vscode-terminal-io-spike-notes.md`.

Stop condition: Stop if no reliable read/write path exists for interactive
Claude/Codex sessions inside VS Code. Escalate with options: managed
pseudoterminal, helper process, or tmux/node-pty adapter.

Close-out state: Draft complete. The reliable v1 path is bridge-owned managed
PTY sessions surfaced through the VS Code extension. Windows validation remains
a handoff item rather than a Linux-local proof.

Next action: Start Chunk Two and build the desktop shell/session cards against
the bridge heartbeat and managed session data.

---

## Chunk Two - Desktop Shell And Session Cards

Status: active

Completion target: Draft complete

Budget class: Medium

Objective: Build the first usable operator surface: a full desktop window with
session cards, connection status, logs, and arm/pause controls wired to mock or
spike-backed session data.

Inputs:

- Chunk One spike result
- `docs/architecture.md`
- `docs/domain-language.md`

Outputs:

- Desktop app scaffold
- Extension-to-desktop bridge protocol
- Session cards for detected windows/sessions
- Event log view
- Basic settings/profile screen placeholder

Acceptance criteria:

- [ ] Desktop app launches on Linux
- [ ] Desktop app receives at least one VS Code extension heartbeat
- [ ] Session card displays workspace, agent, observability level, status, last event, and chunk count
- [ ] Operator can arm, pause, and dismiss a session card
- [ ] `Arm All` applies only to managed/adopted sessions
- [ ] Candidate/unsupported sessions are visible but cannot be armed unattended
- [ ] Logs are append-only and inspectable from the UI

Validation:

```bash
npm run lint
npm test
npm run build
```

Stop condition: Stop if desktop/extension bridge reliability is unclear or if
the UI cannot represent observability levels without confusing the operator.

---

## Chunk Three - Agent Profiles And Signal Detector

Status: planned

Completion target: Task complete

Budget class: Medium

Objective: Implement coder-agnostic profiles and a conservative multi-signal
detector that can classify chunk boundaries, task completion, blocked states,
needs-human states, and uncertain states.

Inputs:

- `docs/domain-language.md`
- Known Claude/Codex transcript samples
- Chunk One terminal output stream

Outputs:

- Agent profile schema
- Built-in Claude profile
- Built-in Codex profile
- Signal detector module
- Fixture-based tests using representative terminal output samples

Acceptance criteria:

- [ ] Profiles define launch command, compact command, resume message, complete signals, blocked signals, and idle rules
- [ ] Detector accepts explicit markers when present
- [ ] Detector can identify likely chunk-boundary closing language only when idle evidence agrees
- [ ] Detector identifies complete/blocked/needs-human states
- [ ] Detector returns `uncertain` instead of guessing when signals conflict
- [ ] Tests cover chunk boundary, active streaming, task complete, blocked, compacting, and false-positive cases

Validation:

```bash
npm run lint
npm test -- signal
```

Stop condition: Stop if real transcript samples are insufficient. Add a manual
sample-capture task before attempting live automation.

---

## Chunk Four - One Managed Compact Cycle

Status: planned

Completion target: Integration complete

Budget class: Medium

Objective: Run one complete compact/resume cycle for one managed Claude or Codex
session inside VS Code, first in dry-run mode, then live after the operator arms
the session.

Inputs:

- Chunk One terminal I/O path
- Chunk Three detector
- One managed test session with a small chunked task

Outputs:

- Session state machine
- Dry-run compact cycle
- Live compact cycle
- Per-session event log
- Operator-visible success/failure state

Acceptance criteria:

- [ ] Dry-run logs "would compact" without sending text
- [ ] Live mode sends the profile compact command only after boundary + idle agreement
- [ ] System waits for compaction to finish before sending resume
- [ ] Resume text is profile-configurable
- [ ] Double-fire protection prevents repeated compacts for the same boundary
- [ ] If task is complete, blocked, or uncertain, no compact command is sent
- [ ] Operator can pause before or during watching

Validation:

```bash
npm run lint
npm test
npm run build
# manual live cycle evidence recorded here
```

Stop condition: Stop after two repeated false positives, missed boundaries, or
unsafe injections. Capture logs and revise detector before continuing.

---

## Chunk Five - Multi-Session Arm/Pause/All Control

Status: planned

Completion target: Integration complete

Budget class: Medium

Objective: Scale from one managed session to multiple VS Code windows/sessions
without losing operator control or log clarity.

Inputs:

- Chunk Four one-session loop
- Desktop session-card UI

Outputs:

- Multi-session scheduler
- Per-session state isolation
- `Arm All Managed` command
- Session-level pause/resume/kill/reset controls
- UI grouping by VS Code window/workspace

Acceptance criteria:

- [ ] App shows multiple detected VS Code windows
- [ ] App shows multiple managed coder sessions
- [ ] Operator can arm one session or all eligible sessions
- [ ] One session entering `Blocked` does not pause unrelated sessions
- [ ] Logs clearly identify session id, workspace, agent, action, and result
- [ ] Session cards show complete, blocked, needs-human, paused, compacting, resuming, and error states
- [ ] No command is sent to candidate/unsupported sessions

Validation:

```bash
npm run lint
npm test
npm run build
# manual two-session run evidence recorded here
```

Stop condition: Stop if multiple sessions cause ambiguous ownership, mixed logs,
or accidental cross-session command sends.

---

## Chunk Six - Windows/Linux Packaging

Status: planned

Completion target: Release ready

Budget class: Large

Objective: Make the app installable and usable on both Windows and Linux with a
clear setup flow for the desktop app and VS Code companion extension.

Inputs:

- Working desktop app
- Working VS Code extension
- `docs/deployment-guide.md`
- `docs/runbook.md`

Outputs:

- Linux installer/package
- Windows installer/package
- VS Code extension package
- First-run setup flow
- Install/uninstall documentation
- Smoke-test checklist for both platforms

Acceptance criteria:

- [ ] Fresh Linux install can launch desktop app and connect to VS Code extension
- [ ] Fresh Windows install can launch desktop app and connect to VS Code extension
- [ ] App can locate or guide installation of the VS Code extension
- [ ] App handles no VS Code windows, no extension, no sessions, and bridge disconnected states
- [ ] Release artifacts do not include secrets
- [ ] Rollback/uninstall path is documented

Validation:

```bash
npm run lint
npm test
npm run build
# platform package build commands once selected
```

Stop condition: Stop if packaging requires a stack decision or code-signing
decision Adam has not made.

---

## Chunk Seven - Public Release Hardening

Status: planned

Completion target: Release ready

Budget class: Medium

Objective: Prepare the public repo so the project is understandable, installable,
and safe for others to try.

Inputs:

- `README.md`
- `docs/manual.md`
- `docs/runbook.md`
- `docs/deployment-guide.md`
- `docs/risks/risk-register.md`
- `docs/CHANGELOG.md`

Outputs:

- Public README with install/use screenshots or recordings
- Operator manual
- Runbook
- Security and limitations notes
- Changelog
- GitHub release draft

Acceptance criteria:

- [ ] README explains what the app does, what it will not do, and how to install it
- [ ] Manual explains session cards, observability levels, arm/pause/all controls, and terminal states
- [ ] Runbook covers disconnected bridge, false boundary, stuck compact, blocked session, and unsafe output
- [ ] Risk register includes command-injection, false-positive, runaway-loop, and unsupported-terminal risks
- [ ] GitHub issue templates or contribution notes exist
- [ ] Release notes state known limitations honestly

Validation:

```bash
bash scripts/governance-preflight.sh
npm run lint
npm test
npm run build
```

Stop condition: Stop if the app is not yet safe enough to publish with honest
limitations.

## Signal Strategy

V1 should not require agents to say `===CHUNK_DONE===`, because real sessions may
use natural closing language instead.

Use a layered detector:

1. Prefer explicit markers when available.
2. Recognize profile-specific closing phrases as boundary candidates.
3. Require idle/input-ready evidence before sending commands.
4. Treat complete, blocked, needs-human, and uncertain states as stop states.
5. Keep dry-run logs for every detector decision.

Recommended explicit markers for future prompts:

```text
===CHUNK_DONE===
===TASK_COMPLETE===
===BLOCKED===
===NEEDS_HUMAN===
```

Natural-language examples are allowed only as boundary candidates, never as the
sole reason to inject text.

## Validation Log

| Timestamp | Command | Result | Notes |
|---|---|---|---|
| 2026-06-29T18:37:53-06:00 | `git status --short` | failed | Directory is not currently a Git repository. |
| 2026-06-29T18:37:53-06:00 | `bash scripts/governance-preflight.sh` | pass | Planning scaffold passes current required-file check. |

## Next Handoff

Next agent should start with Chunk Zero. Do not implement tmux/n8n watcher code
from `PLAN.md` unless Adam explicitly reopens that path. The current goal is a
VS Code-first, cross-platform desktop app plus companion extension.
