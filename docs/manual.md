# Manual

Last updated: 2026-06-29T20:44:55-06:00

## What This Project Is

Perpetual Context Protection is an installable desktop app with a VS Code
companion extension. It helps an operator supervise long Claude, Codex, or later
coder-agent sessions while away from the machine.

The app shows detected VS Code windows and coder sessions as session cards. The
operator chooses which sessions to arm. Armed managed sessions can be compacted
and resumed automatically when the detector sees a safe chunk boundary and an
idle/input-ready state.

Candidate or unsupported sessions may be visible, but v1 must not automate them
unless they are adopted through a reliable read/write path.

## How To Work In This Repo

For ordinary scoped work, start lean:

1. Check `git status --short`.
2. Read `START_HERE.md` and the short repo-local agent instructions.
3. Use `docs/context-map.md` to choose only the docs and source areas needed for the task.
4. Review `docs/current-build-pathway.md` for the active chunk, completion target, stop condition, and validation expectations.
5. Run task-relevant validation.

For material or risk-triggering work, add the full governance path:

1. Review `docs/standards/README.md`.
2. Review `docs/standards/engineering-governance-by-use-case.md`.
3. Review `docs/policy/durable-development-engineering-policy.md`.
4. Review `docs/standards/ship-ready-engineering-standard.md`.
5. Run `bash scripts/governance-preflight.sh`.
6. Review `project-control.yaml`.
7. Capture a timestamp with `date -Iseconds`.
8. Confirm the current roadmap and runbook still match reality.
9. Update docs when behavior or operating expectations change.

## Expected Outputs

- working code or deliverables
- current operational documentation
- a maintained roadmap
- timestamped build pathway updates for material work
- scoped context and budget notes for meaningful chunks
- reviewable governance records

## Operator Notes

- Use managed sessions for unattended operation.
- Use `Arm All` for idle managed sessions. It does not unpause sessions that
  were paused intentionally.
- Use per-card Resume, Reset, Kill, Pause, and Dismiss controls when a session
  needs individual attention.
- If a session is marked candidate or unsupported, relaunch it through the VS
  Code extension before leaving.
- Treat `Complete`, `Blocked`, `Needs Human`, and `Uncertain` as stop states.
- Review logs after an unattended run before trusting the result.
