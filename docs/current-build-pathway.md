# Current Build Pathway

Last Updated: 2026-06-29T22:17:36-06:00
Status: Chunk Six operator-guide polish complete - Windows packaging pending
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
| Chunk Two - Desktop shell and session cards | done | 2026-06-29T19:37:10-06:00 | build agent | Electron desktop shell, bridge desktop state, session cards, logs, and guarded operator actions |
| Chunk Three - Agent profiles and signal detector | done | 2026-06-29T20:11:30-06:00 | build agent | Claude/Codex profiles, multi-signal boundary detection |
| Chunk Four - One managed compact cycle | done | 2026-06-29T21:36:33-06:00 | build agent | Watched managed Codex dry-run/live compact cycle passed; compact and resume evidence recorded |
| Chunk Five - Multi-session arm/pause/all control | done | 2026-06-29T21:50:34-06:00 | build agent | Watched two-session Codex dry-run/live pass completed; pause isolation, Arm All safety, and kill cleanup verified |
| Chunk Six - Windows/Linux packaging | active | 2026-06-29T22:05:13-06:00 | build agent | Linux VS Code companion install proof passed; Windows packaging remains |
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

Status: done

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

- [x] Desktop app launches on Linux
- [x] Desktop app receives at least one VS Code extension heartbeat
- [x] Session card displays workspace, agent, observability level, status, last event, and chunk count
- [x] Operator can arm, pause, and dismiss a session card
- [x] `Arm All` applies only to managed/adopted sessions
- [x] Candidate/unsupported sessions are visible but cannot be armed unattended
- [x] Logs are append-only and inspectable from the UI

Validation:

```bash
npm run lint
npm test
npm run build
```

Stop condition: Stop if desktop/extension bridge reliability is unclear or if
the UI cannot represent observability levels without confusing the operator.

Evidence:

- 2026-06-29T19:37:10-06:00: Added Electron + React/Vite desktop shell with a full-window operator surface, session metrics, session cards, event log, and settings/profile pane.
- 2026-06-29T19:37:10-06:00: Added bridge desktop state and action endpoints: `/desktop/state`, `/desktop/arm-all`, `/desktop/cards/:id/arm`, `/desktop/cards/:id/pause`, and `/desktop/cards/:id/dismiss`.
- 2026-06-29T19:37:10-06:00: Added append-only in-memory desktop event log entries for heartbeats, session starts, input sends, arm, pause, dismiss, and arm-all actions.
- 2026-06-29T19:37:10-06:00: Added unit coverage proving managed cards can be armed, candidates stay visible but cannot be armed, `Arm All` only affects managed cards, and dismiss removes a card while preserving event history.
- 2026-06-29T19:37:10-06:00: Updated VS Code extension-host test to assert a VS Code heartbeat appears through `/desktop/state`.
- 2026-06-29T19:37:10-06:00: `npm run lint` passed.
- 2026-06-29T19:37:10-06:00: `npm test` passed with 2 unit tests.
- 2026-06-29T19:37:10-06:00: `npm run build` passed and produced the desktop renderer bundle.
- 2026-06-29T19:37:10-06:00: `npm run test:vscode` passed under `xvfb`; extension heartbeat was visible through desktop state and the managed echo read/write proof still passed.
- 2026-06-29T19:37:10-06:00: `npm run desktop:smoke` passed under `xvfb`; Electron loaded the desktop shell on Linux and exited through the smoke hook.

Close-out state: Draft complete. The first operator surface exists and is wired
to bridge-backed heartbeat/session data. Arm/adoption beyond bridge-managed
sessions remains future work; `Arm All` currently applies only to managed
sessions because no explicit adoption flow exists yet.

Next action: Start Chunk Three and implement the agent profile schema plus the
conservative multi-signal detector.

---

## Chunk Three - Agent Profiles And Signal Detector

Status: done

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

- [x] Profiles define launch command, compact command, resume message, complete signals, blocked signals, and idle rules
- [x] Detector accepts explicit markers when present
- [x] Detector can identify likely chunk-boundary closing language only when idle evidence agrees
- [x] Detector identifies complete/blocked/needs-human states
- [x] Detector returns `uncertain` instead of guessing when signals conflict
- [x] Tests cover chunk boundary, active streaming, task complete, blocked, compacting, and false-positive cases

Validation:

```bash
npm run lint
npm run test:signal
npm test
npm run build
```

Validation evidence:

- 2026-06-29T20:02:32-06:00: `bash scripts/governance-preflight.sh` passed with 0 warnings before the autonomous signal-detector work.
- 2026-06-29T20:11:30-06:00: Added coder-agnostic profile schema fields for launch commands, compact command, resume instruction, signal patterns, idle rules, and prompt hints.
- 2026-06-29T20:11:30-06:00: Added built-in Claude and Codex profile signals for explicit markers, natural boundary language, complete, blocked, needs-human, compacting, active, input-ready, and conflict guards.
- 2026-06-29T20:11:30-06:00: Added conservative `detectSessionSignal` module that returns `chunk-boundary`, `task-complete`, `blocked`, `needs-human`, `compacting`, `active`, or `uncertain` plus evidence.
- 2026-06-29T20:11:30-06:00: Added representative fixture tests for explicit markers, natural boundary language, active streaming, task complete, blocked, needs-human, compacting, conflict, and false-positive cases.
- 2026-06-29T20:11:30-06:00: `npm run test:signal` passed with 9 detector tests.
- 2026-06-29T20:11:30-06:00: `npm run lint` passed.
- 2026-06-29T20:11:30-06:00: `npm test` passed with 11 unit tests.
- 2026-06-29T20:11:30-06:00: `npm run build` passed.

Close-out state: Task complete. The detector is ready for a dry-run compact
cycle. Full live Claude/Codex transcript samples are still limited; Chunk Four
must capture or review a disposable live-session sample before sending a live
compact command.

---

## Chunk Four - One Managed Compact Cycle

Status: done

Completion target: Integration complete

Budget class: Medium

Objective: Run one complete compact/resume cycle for one managed Claude or Codex
session inside VS Code, first in dry-run mode, then live after the operator arms
the session.

Inputs:

- Chunk One terminal I/O path
- Chunk Three detector
- One managed test session with a small chunked task
- Disposable live Claude/Codex transcript sample captured or reviewed before live compact mode

Outputs:

- Session state machine
- Dry-run compact cycle
- Live compact cycle
- Per-session event log
- Operator-visible success/failure state

Acceptance criteria:

- [x] Dry-run logs "would compact" without sending text
- [x] Live mode sends the profile compact command only after boundary + idle agreement in automated coverage
- [x] System waits for compaction to finish before sending resume
- [x] Resume text is profile-configurable
- [x] Double-fire protection prevents repeated compacts for the same boundary
- [x] If task is complete, blocked, or uncertain, no compact command is sent
- [x] Operator can pause before or during watching
- [x] Manual live managed Claude/Codex cycle is captured while Adam watches

Validation:

```bash
npm run lint
npm test
npm run build
# manual live cycle evidence recorded here
```

Implementation evidence:

- 2026-06-29T20:18:41-06:00: `bash scripts/governance-preflight.sh` passed with 0 warnings before Chunk Four autonomous-session work.
- 2026-06-29T20:29:52-06:00: Added bridge-side automation state machine with explicit dry-run/live mode, watching, compacting, resuming, stop states, detector evidence, and per-session chunk counts.
- 2026-06-29T20:29:52-06:00: Added automated coverage for dry-run "would compact" logging, live compact command gating, quiet-period resume gating, double-fire prevention, terminal stop states, and pause-before/pause-during behavior.
- 2026-06-29T20:29:52-06:00: Desktop cards now show automation mode and last detector decision; event log entries include detector evidence details.
- 2026-06-29T20:29:52-06:00: Added Linux launcher scripts and installed a desktop icon at `/home/adamgoodwin/Desktop/Perpetual Context Protection.desktop`.
- 2026-06-29T20:44:55-06:00: Changed the installed launcher and in-app brand mark to an infinity symbol, fixed Electron `file://` renderer asset loading by using a relative Vite base, and upgraded `desktop:smoke` to fail if the app shell text does not render.
- 2026-06-29T20:44:55-06:00: Refreshed the Linux desktop launcher at `/home/adamgoodwin/Desktop/Perpetual Context Protection.desktop`.
- 2026-06-29T21:36:33-06:00: Live watched Codex cycle exposed and fixed three real integration issues before acceptance: idle armed sessions now keep watching without boundary evidence, Codex uses a separated encoded submit sequence, and resume waits for post-compact completion/prompt-ready evidence instead of only a quiet timer.
- 2026-06-29T21:36:33-06:00: Manual watched managed Codex run passed in the rebuilt desktop app. Dry-run logged `Codex dry run: would compact at detected boundary` at `2026-06-30T03:33:51.018Z`; live mode sent `/compact` at `2026-06-30T03:34:47.042Z`; live resume sent `Carry on with the next chunk.` at `2026-06-30T03:35:30.055Z`; card returned to `watching` with `chunkCount=1`.
- 2026-06-29T20:29:52-06:00: `npm test` passed with 15 unit tests.
- 2026-06-29T20:29:52-06:00: `npm run lint` passed.
- 2026-06-29T20:29:52-06:00: `npm run build` passed.
- 2026-06-29T20:29:52-06:00: `npm run desktop:smoke` passed under `xvfb`; Electron emitted headless DBus warnings but exited successfully.
- 2026-06-29T20:29:52-06:00: `npm run test:vscode` passed under `xvfb`; extension-host managed-session proof remains healthy.

Close-out state: Integration complete for the Chunk Four one-session managed
Codex dry-run/live compact cycle. Remaining integration evidence belongs to
Chunk Five multi-session validation.

Stop condition: Stop after two repeated false positives, missed boundaries, or
unsafe injections. Capture logs and revise detector before continuing.

---

## Chunk Five - Multi-Session Arm/Pause/All Control

Status: done

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

- [x] App shows multiple detected VS Code windows
- [x] App shows multiple managed coder sessions
- [x] Operator can arm one session or all eligible sessions
- [x] One session entering `Blocked` does not pause unrelated sessions
- [x] Logs clearly identify session id, workspace, agent, action, and result
- [x] Session cards show complete, blocked, needs-human, paused, compacting, resuming, and error states
- [x] No command is sent to candidate/unsupported sessions
- [x] Manual two-session run evidence is recorded while Adam watches

Validation:

```bash
npm run lint
npm test
npm run build
# manual two-session run evidence recorded here
```

Implementation evidence:

- 2026-06-29T20:44:55-06:00: Added workspace-grouped session cards so multiple VS Code windows and sessions are easier to follow.
- 2026-06-29T20:44:55-06:00: Added explicit per-card resume, reset, kill, pause, dismiss, and arm controls. `Arm All` now only arms idle bridge-managed sessions and does not silently unpause paused sessions.
- 2026-06-29T20:44:55-06:00: Added bridge action routes for resume/reset/kill and reverse managed-card session lookup so kill targets only one managed PTY.
- 2026-06-29T20:44:55-06:00: Event details now include session id, card id, workspace, agent, action, and result for managed-session actions and automation events.
- 2026-06-29T20:44:55-06:00: Added automated multi-session coverage for two VS Code windows, two managed sessions, `Arm All`, pause/resume/reset/kill, candidate/unsupported safety, identity-rich logs, and blocked-session isolation.
- 2026-06-29T20:44:55-06:00: `npm test` passed with 17 unit tests.
- 2026-06-29T20:44:55-06:00: `npm run lint` passed.
- 2026-06-29T20:44:55-06:00: `npm run build` passed.
- 2026-06-29T20:44:55-06:00: `npm run desktop:smoke` passed under `xvfb`; the smoke hook now verifies rendered desktop shell text. Headless DBus warnings only.
- 2026-06-29T20:44:55-06:00: `npm run test:vscode` passed under `xvfb`; extension-host managed-session proof remains healthy.
- 2026-06-29T21:50:34-06:00: Manual watched two-session Codex run passed. Two workspace heartbeats produced separate workspace groups plus candidate/unsupported cards; `Arm All` armed only managed cards `09eb7e64-f02e-4273-b06f-ed7ada55ef8c` and `b4e16712-1eae-4a0b-8ddd-453728563b5d`.
- 2026-06-29T21:50:34-06:00: Dry-run logged separate `automation-dry-run` events for both sessions at `2026-06-30T03:47:45.285Z` and `2026-06-30T03:47:51.286Z`.
- 2026-06-29T21:50:34-06:00: Live mode sent compact to both sessions at `2026-06-30T03:48:21.308Z`, then resume to Workspace One at `2026-06-30T03:48:54.320Z` and Workspace Two at `2026-06-30T03:49:00.324Z`.
- 2026-06-29T21:50:34-06:00: Both cards settled back to `watching` with `chunkCount=1`, no second compact fired, candidate/unsupported cards stayed idle and unarmable, pausing Workspace One left Workspace Two watching, and `Arm All` affected zero cards while none were eligible.
- 2026-06-29T21:50:34-06:00: Disposable managed Codex sessions were killed through per-card controls after evidence capture.

Close-out state: Integration complete for Chunk Five multi-session controls.
Remaining integration evidence belongs to Chunk Six packaging and setup.

Stop condition: Stop if multiple sessions cause ambiguous ownership, mixed logs,
or accidental cross-session command sends.

---

## Chunk Six - Windows/Linux Packaging

Status: active

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
- [x] App can locate or guide installation of the VS Code extension
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

Implementation evidence:

- 2026-06-29T22:05:13-06:00: Added repeatable VS Code companion packaging and install commands: `npm run vscode:package` and `npm run vscode:install`.
- 2026-06-29T22:05:13-06:00: Packaged `dist/vscode/perpetual-context-protection-automation-0.0.1.vsix`; the VSIX contains only package metadata, README, compiled extension code, and compiled shared protocol/profile code.
- 2026-06-29T22:05:13-06:00: Installed the companion extension into Adam's normal VS Code profile. The live bridge changed from zero heartbeats to four detected VS Code windows, including `perpetual-context-protection-automation`, `agentic-multi-agent-agent-builder`, `the-freedom-engine-os`, and one untitled VS Code window.
- 2026-06-29T22:05:13-06:00: Added bridge-side setup detection for the local VS Code companion extension and a desktop empty state that distinguishes missing companion extension, waiting VS Code windows, and bridge offline states.
- 2026-06-29T22:05:13-06:00: Refreshed the Linux launcher install path so the infinity icon is installed into the user icon theme as `perpetual-context-protection`.
- 2026-06-29T22:17:36-06:00: Added a desktop operator-guide drawer that explains candidate versus managed cards, companion setup, managed Claude/Codex launch commands, dry-run/live mode, arm behavior, and automation stop states.
- 2026-06-29T22:17:36-06:00: Extended desktop smoke validation so it opens the operator-guide drawer and requires the `Operator Guide` content before passing.

Close-out state: Task complete for the Linux companion install/setup slice.
Chunk Six remains active for Windows packaging, desktop app packaging format,
fresh-platform smoke evidence, and final uninstall documentation.

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
| 2026-06-29T20:18:41-06:00 | `bash scripts/governance-preflight.sh` | pass | Chunk Four autonomous-session work passed preflight with 0 warnings. |
| 2026-06-29T20:29:52-06:00 | `npm test` | pass | 15 unit tests, including compact-cycle automation controller coverage. |
| 2026-06-29T20:29:52-06:00 | `npm run lint` | pass | ESLint passed for source, tests, and Vite config. |
| 2026-06-29T20:29:52-06:00 | `npm run build` | pass | TypeScript compile and desktop renderer production build passed. |
| 2026-06-29T20:29:52-06:00 | `npm run desktop:smoke` | pass | Electron loaded under `xvfb`; headless DBus warnings only. |
| 2026-06-29T20:29:52-06:00 | `npm run test:vscode` | pass | VS Code extension-host test passed under `xvfb`. |
| 2026-06-29T20:44:55-06:00 | `npm test` | pass | 17 unit tests, including multi-session operator controls and blocked-session isolation. |
| 2026-06-29T20:44:55-06:00 | `npm run lint` | pass | ESLint passed for source, tests, and Vite config. |
| 2026-06-29T20:44:55-06:00 | `npm run build` | pass | TypeScript compile and desktop renderer production build passed with relative Electron asset paths. |
| 2026-06-29T20:44:55-06:00 | `npm run desktop:smoke` | pass | Electron rendered the desktop shell text under `xvfb`; headless DBus warnings only. |
| 2026-06-29T20:44:55-06:00 | `npm run test:vscode` | pass | VS Code extension-host test passed under `xvfb`; headless DBus warnings only. |
| 2026-06-29T20:44:55-06:00 | `npm run desktop:install-linux-launcher` | pass | Desktop launcher refreshed at `/home/adamgoodwin/Desktop/Perpetual Context Protection.desktop`. |
| 2026-06-29T21:13:51-06:00 | `bash scripts/governance-preflight.sh` | pass | Live validation fix work passed preflight with 0 warnings. |
| 2026-06-29T21:36:33-06:00 | `npm test` | pass | 21 unit tests, including Codex submit sequence, idle-watch behavior, compact-complete gating, and repeated-boundary protection. |
| 2026-06-29T21:36:33-06:00 | manual watched Codex dry-run/live cycle | pass | Desktop event log showed dry-run would compact, live compact send, compact-complete wait, live resume send, and return to watching with `chunkCount=1`. |
| 2026-06-29T21:36:33-06:00 | `npm run lint` | pass | ESLint passed for source, tests, and Vite config. |
| 2026-06-29T21:36:33-06:00 | `npm run build` | pass | TypeScript compile and desktop renderer production build passed. |
| 2026-06-29T21:36:33-06:00 | `npm run desktop:smoke` | pass | Electron smoke rendered app under `xvfb`; headless DBus warnings and one transient desktop-state fetch reset only, exit code 0. |
| 2026-06-29T21:36:33-06:00 | `npm run test:vscode` | pass | VS Code extension-host test passed under `xvfb`; headless warnings only. |
| 2026-06-29T21:41:07-06:00 | `git diff --check` | pass | No whitespace errors in the final diff. |
| 2026-06-29T21:41:07-06:00 | `graphify update . --no-cluster` | pass | Repo graph refreshed without clustering; 699 nodes and 6959 edges. |
| 2026-06-29T21:44:10-06:00 | `bash scripts/governance-preflight.sh` | pass | Chunk Five watched two-session validation passed preflight with 0 warnings. |
| 2026-06-29T21:50:34-06:00 | `npm run build` | pass | TypeScript compile and desktop renderer production build passed before launching the watched desktop run. |
| 2026-06-29T21:50:34-06:00 | manual watched two-session Codex dry-run/live cycle | pass | Two managed Codex cards in separate workspace groups dry-ran, compacted live, resumed independently, returned to watching with `chunkCount=1`, and were killed through card controls. |
| 2026-06-29T21:52:38-06:00 | `npm run lint` | pass | ESLint passed for source, tests, and Vite config. |
| 2026-06-29T21:52:38-06:00 | `npm test` | pass | 21 unit tests passed, including multi-session controls, blocked-session isolation, and compact-cycle gating. |
| 2026-06-29T21:52:38-06:00 | `npm run build` | pass | TypeScript compile and desktop renderer production build passed. |
| 2026-06-29T21:52:38-06:00 | `npm run desktop:smoke` | pass | Electron smoke rendered under `xvfb`; headless DBus warnings and one transient desktop-state fetch reset only, exit code 0. |
| 2026-06-29T21:52:38-06:00 | `npm run test:vscode` | pass | VS Code extension-host test passed under `xvfb`; headless DBus/GPU/WebGL warnings only. |
| 2026-06-29T21:53:25-06:00 | `git diff --check` | pass | No whitespace errors in the final doc diff. |
| 2026-06-29T21:53:25-06:00 | `graphify update . --no-cluster` | pass | Repo graph refresh completed without clustering; 699 nodes and 7972 edges. |
| 2026-06-29T21:57:46-06:00 | `bash scripts/governance-preflight.sh` | pass | Chunk Six Linux companion setup work passed preflight with 0 warnings. |
| 2026-06-29T22:05:13-06:00 | `npm run desktop:install-linux-launcher` | pass | Linux launcher refreshed with named infinity icon at the desktop and application-menu paths. |
| 2026-06-29T22:05:13-06:00 | `npm run vscode:install` | pass | VS Code companion VSIX packaged and installed into Adam's normal VS Code profile. |
| 2026-06-29T22:05:13-06:00 | live bridge check | pass | Bridge reported four VS Code heartbeats and four candidate/workspace cards after companion install. |
| 2026-06-29T22:05:13-06:00 | `npm run lint` | pass | ESLint passed for source, tests, and Vite config. |
| 2026-06-29T22:05:13-06:00 | `node --check scripts/package-vscode-extension.mjs && node --check scripts/install-vscode-extension.mjs` | pass | VS Code package/install scripts parse successfully. |
| 2026-06-29T22:05:13-06:00 | `npm test` | pass | 21 unit tests passed, including desktop setup guidance in the bridge state contract. |
| 2026-06-29T22:05:13-06:00 | `npm run build` | pass | TypeScript compile and desktop renderer production build passed. |
| 2026-06-29T22:05:13-06:00 | `npm run desktop:smoke` | pass | Electron smoke rendered under `xvfb` against the already-running bridge; headless DBus warnings only. |
| 2026-06-29T22:05:13-06:00 | `npm run test:vscode` | pass | VS Code extension-host test passed under `xvfb`; headless DBus/GPU/WebGL warnings only. |
| 2026-06-29T22:05:13-06:00 | `npm run vscode:package` | pass | Final VSIX contains 10 files, 13.54 KB, with no Graphify cache, desktop build output, or node modules. |
| 2026-06-29T22:07:04-06:00 | `git diff --check` | pass | No whitespace errors in the final diff. |
| 2026-06-29T22:07:04-06:00 | `graphify update . --no-cluster` | pass | Repo graph refresh completed without clustering; 726 nodes and 9029 edges. |
| 2026-06-29T22:14:04-06:00 | `bash scripts/governance-preflight.sh` | pass | Operator-guide polish passed preflight with 0 warnings. |
| 2026-06-29T22:17:36-06:00 | `npm run lint` | pass | ESLint passed for source, tests, and Vite config. |
| 2026-06-29T22:17:36-06:00 | `npm run build` | pass | TypeScript compile and desktop renderer production build passed. |
| 2026-06-29T22:17:36-06:00 | `npm test` | pass | 21 unit tests passed. |
| 2026-06-29T22:17:36-06:00 | `npm run desktop:smoke` | pass | Electron smoke opened the operator-guide drawer and confirmed `Operator Guide` content; headless DBus warnings only. |
| 2026-06-29T22:18:35-06:00 | `git diff --check` | pass | No whitespace errors in the final diff. |
| 2026-06-29T22:18:35-06:00 | `graphify update . --no-cluster` | pass | Repo graph refresh completed without clustering; 728 nodes and 10075 edges. |

## Next Handoff

Continue with the remaining Chunk Six packaging work: Windows install/smoke,
desktop app package format, fresh-platform evidence, and final uninstall notes.
The VS Code companion extension is installed in Adam's normal VS Code profile,
and the live bridge detected four VS Code windows after install. Existing
unmanaged terminals are correctly shown as candidate cards and remain unarmable.
The desktop app now includes an operator-guide drawer for in-app instructions.
The desktop launcher was refreshed at `/home/adamgoodwin/Desktop/Perpetual
Context Protection.desktop` with the named infinity icon.
