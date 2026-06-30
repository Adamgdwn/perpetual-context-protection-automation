# Change Log

## Unreleased

- Implementation not yet started. See `docs/current-build-pathway.md`.

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
