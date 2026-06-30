# Change Log

## Unreleased

- 2026-06-29: Added a desktop operator-guide drawer for Chunk Six polish. The
  drawer explains candidate versus managed cards, companion setup, managed
  Claude/Codex launch commands, dry-run/live mode, arm behavior, and stop
  states; desktop smoke now opens the drawer and verifies the guide content.
- 2026-06-29: Added Chunk Six Linux companion setup proof. The VS Code
  companion can now be packaged and installed with `npm run vscode:package` and
  `npm run vscode:install`; the desktop state reports companion setup status,
  the empty session state distinguishes missing extension versus waiting
  windows, the Linux launcher installs the named infinity icon, and Adam's live
  bridge detected open VS Code windows after extension install.
- 2026-06-29: Completed Chunk Five watched integration evidence. Two managed
  Codex sessions in separate workspace groups passed dry-run and live compact
  cycles independently, candidate/unsupported cards stayed unarmable, pause
  isolation held, `Arm All` did not unpause or re-arm ineligible cards, and the
  disposable sessions were killed through per-card controls after evidence
  capture.
- 2026-06-29: Completed Chunk Four watched integration evidence. The managed
  Codex dry-run/live cycle now keeps idle armed sessions watching, submits Codex
  commands with the required separated encoded Enter sequence, waits for
  post-compact completion or prompt-ready evidence before resume, and prevents
  repeated compacts for the same boundary after command output changes.
- 2026-06-29: Added Chunk Five draft multi-session controls. Workspace-grouped
  session cards now expose arm/resume/pause/reset/kill/dismiss controls,
  `Arm All` only arms idle bridge-managed sessions, candidate/unsupported
  sessions remain non-armable, and event details include session id, card id,
  workspace, agent, action, and result. Also fixed blank Electron launches by
  using relative Vite renderer assets, upgraded desktop smoke to assert rendered
  shell text, refreshed the launcher with an infinity icon, and added
  multi-session unit coverage.
- 2026-06-29: Added Chunk Four implementation checkpoint. Introduced the
  bridge-side compact-cycle automation controller, dry-run/live mode, detector
  evidence in desktop logs, pause-safe compact/resume state handling,
  Linux desktop launcher scripts, and automated coverage for dry-run, live
  compact gating, resume gating, double-fire prevention, stop states, and pause
  behavior. Manual human-observed Claude/Codex live-cycle evidence remains
  pending before Chunk Four is integration complete.
- 2026-06-29: Completed Chunk Three task. Added coder-agnostic agent profile
  schema fields, built-in Claude/Codex signal profiles, conservative
  multi-signal detector, targeted `test:signal` script, and fixture-based
  coverage for boundary, complete, blocked, needs-human, active, compacting,
  conflict, and false-positive cases.
- 2026-06-29: Completed Chunk Two draft desktop shell. Added Electron +
  React/Vite desktop app, bridge desktop state/action endpoints, session cards,
  append-only event log view, profile/settings pane, guarded `Arm All`, and
  Linux Electron smoke validation.
- 2026-06-29: Completed Chunk One draft spike. Added the TypeScript/npm
  scaffold, VS Code companion extension, localhost `node-pty` bridge, managed
  Codex launch proof, bridge-backed read/write proof, and timestamped spike
  notes at `docs/spikes/2026-06-29-1918-vscode-terminal-io-spike-notes.md`.

## 2026-06-29 - Document Control Filename Convention

- Added `docs/standards/document-control-standard.md`.
- Recorded the rule that standalone new or replacement build and information documents should use a local-time filename prefix like `YYYY-MM-DD-HHMM-`.
- Clarified that dependency-bearing documents keep stable filenames and titles, with the last major update timestamp in the document body.
- Linked the new standard from the standards index, context map, and agent instructions.

## 2026-06-29 - Chunk Zero Path Cleanup

- Completed local path cleanup for the corrected `perpetual-context-protection-automation` slug.
- Updated the active pathway so Chunk Zero is complete and Chunk One is the next implementation slice.
- Removed stale notes that said the local directory still needed rename cleanup.
- Re-ran Chunk Zero close-out validation; governance preflight passed with 0 warnings.

## 2026-06-29 - VS Code-First Planning Revision

- Revised product direction from tmux/n8n-first watcher to cross-platform desktop app plus VS Code companion extension.
- Added active spec: `docs/specs/2026-06-29-vscode-first-build-plan.md`.
- Rebuilt `docs/current-build-pathway.md` into token-friendly implementation chunks from repo setup through public release hardening.
- Added session-card, observability-level, agent-profile, and multi-signal detector language.
- Marked `PLAN.md` as superseded research rather than the active implementation route.
- Corrected public repo/product spelling to `perpetual-context-protection-automation`; queued local directory cleanup for Chunk Zero.

## 2026-06-29 - Planning Complete

- Project scaffolded via agentic project setup
- `PLAN.md` written: 13 sections covering full architecture, watcher script, n8n workflow designs, CLAUDE.md sentinel configuration, continuation context strategy, Codex adaptation, edge cases, 5 milestones, and file map
- Two deep research queries run via Perplexity to validate architecture (tmux automation, n8n Docker patterns)
- Key architectural decisions recorded:
  - tmux required for TUI automation (no machine-readable idle API in Claude Code)
  - n8n Docker cannot access host tmux — watcher script is the hands, n8n is the brain
  - Sentinel string (`===CHUNK_DONE===`) via CLAUDE.md is more reliable than TUI heuristics
  - "Carry on with the next chunk" is sufficient continuation (plans are pre-chunked)
  - Codex has `/compact` — same mechanism applies, different session name only
- `docs/architecture.md`, `README.md`, `docs/current-build-pathway.md`, `docs/roadmap.md` filled in
- `START_HERE.md` updated to reflect planning-complete status
