# Start Here

Last Updated: 2026-06-29T21:53:25-06:00
Status: Chunk Five integration complete - Chunk Six packaging pending
Owner: Adam Goodwin

## 2026-06-29 Chunk Zero Completion Handoff

The local folder rename cleanup is complete. Use the corrected local folder and
public GitHub repo:

```text
/home/adamgoodwin/code/Applications/perpetual-context-protection-automation
https://github.com/Adamgdwn/perpetual-context-protection-automation
```

Resume rule for the next implementation session:

1. Start in the corrected folder path.
2. Run `git status --short`.
3. Read this file and `docs/current-build-pathway.md`.
4. Do not restart from the superseded tmux/n8n plan in `PLAN.md`.
5. Continue with Chunk Six Windows/Linux packaging.

Most important product decision:

- V1 is a cross-platform desktop app plus VS Code companion extension.
- V1 must work on Windows and Linux.
- V1 must show a full window UI with session cards and logs.
- The operator opens the app before stepping away, sees detected VS Code windows
  and coder sessions, and arms one session or all eligible managed sessions.
- Claude and Codex are the first supported coder profiles.
- The design must stay coder agnostic so later coding CLIs can be added through
  profiles.
- Do not build a standalone tmux watcher as v1. tmux/n8n may become optional
  adapters later.

Important safety/product rules:

- Avoid screen scraping and blind keystroke injection.
- Every detected session has an observability level: managed, adoptable,
  candidate, or unsupported.
- Only managed or explicitly adopted sessions can be armed for unattended
  automation.
- Candidate/unsupported terminals may be shown in the UI, but v1 must not send
  commands into them unattended.
- Pause detection must be layered. Do not require a magic `===CHUNK_DONE===`
  phrase from the agent. Prefer explicit markers when available, but also use
  natural closing language, quiet period, prompt/input-ready evidence, and
  complete/blocked/needs-human stop signals.
- Prefer false negatives over unsafe false positives. If uncertain, stop and
  ask for human attention rather than compacting.
- The app must stop on complete, blocked, needs-human, error, or uncertain
  states instead of looping forever.

Files updated in the planning revision:

- `README.md`
- `START_HERE.md`
- `INITIAL_SCOPE.md`
- `project-control.yaml`
- `PLAN.md`
- `docs/architecture.md`
- `docs/current-build-pathway.md`
- `docs/specs/2026-06-29-vscode-first-build-plan.md`
- `docs/roadmap.md`
- `docs/domain-language.md`
- `docs/manual.md`
- `docs/runbook.md`
- `docs/deployment-guide.md`
- `docs/CHANGELOG.md`
- `docs/risks/risk-register.md`

Validation already run:

```bash
bash scripts/governance-preflight.sh
```

Result: pass with 0 warnings.

Committed and pushed state:

- GitHub CLI is installed and authenticated as `Adamgdwn`.
- Local Git repository has been initialized on `main`.
- Public GitHub repo has been created under Adam's account:
  `https://github.com/Adamgdwn/perpetual-context-protection-automation`.
- `origin` points to
  `https://github.com/Adamgdwn/perpetual-context-protection-automation.git`.
- Initial planning scaffold commit before this turnover correction:
  `32637f0 Initial VS Code-first planning scaffold`.
- Main has been pushed and tracks `origin/main`.

Chunk Zero cleanup completed:

- Confirmed `pwd` is
  `/home/adamgoodwin/code/Applications/perpetual-context-protection-automation`.
- Confirmed `origin` points to Adam's public GitHub repo.
- Updated durable path references that still mentioned the temporary typo path.
- Updated `docs/current-build-pathway.md` so Chunk One is the active next slice.
- Close-out validation is recorded in `docs/current-build-pathway.md`.

## Current Plan

Planning has been revised. The active product direction is a cross-platform
desktop app plus VS Code companion extension. The tool shows session cards for
detected VS Code windows and coder sessions, lets the operator arm selected
sessions, then compacts and resumes Claude/Codex sessions at safe boundaries.

`docs/current-build-pathway.md` is the live chunk-by-chunk implementation plan.
`docs/specs/2026-06-29-vscode-first-build-plan.md` captures the current product
and architecture plan. `PLAN.md` is retained as superseded tmux/n8n research.

Current priorities:

- **Package the app for real use** - Chunk Five's watched two-session Codex pass is complete, so continue with Chunk Six Windows/Linux packaging and setup flow
- Build VS Code-first, coder-agnostic behavior before optional tmux or n8n adapters
- Treat terminal observability as explicit session metadata: managed, adoptable, candidate, or unsupported
- Use multi-signal pause detection, not a single required `===CHUNK_DONE===` phrase
- Capture or review a disposable live Claude/Codex transcript sample before or during live compact mode
- Apply `docs/policy/durable-development-engineering-policy.md` during implementation
- Apply `docs/standards/ship-ready-engineering-standard.md` before declaring any chunk complete
- Use `docs/context-map.md` as the routing map for task-specific context loads
- Keep work in context-window-friendly chunks; each chunk has one objective and explicit validation

## Current Build Pathway

Default live build route: [docs/current-build-pathway.md](docs/current-build-pathway.md).

If this project later promotes a different active plan, name it here and route
agents there instead of rereading archived pathway history.

For ordinary scoped work:

1. Run `git status --short`.
2. Read the repo-local agent instructions.
3. Use `docs/context-map.md` when context routing is unclear.
4. Inspect the specific files, errors, or docs needed for the task.
5. Run targeted validation after the change.

For material or risk-triggering changes:

1. Run `bash scripts/governance-preflight.sh`.
2. Review `docs/standards/README.md`.
3. Review `docs/standards/engineering-governance-by-use-case.md`.
4. Review `docs/policy/durable-development-engineering-policy.md`.
5. Review `docs/standards/ship-ready-engineering-standard.md`.
6. Review `project-control.yaml`.
7. Check `exceptions` in `project-control.yaml` and any exception records.
8. For broad source exploration, architecture analysis, dependency tracing, or cross-repo planning, use the Graphify policy at `/home/adamgoodwin/code/Tools/graphify/docs/agent-governance.md` before reading raw source broadly. Reference `/home/adamgoodwin/code/Tools/graphify/workspace/out/graph.json` for cross-repo routing, set up repo-local Graphify when a new repo becomes active, run `/graphify /path/to/repo` from Claude Code for full semantic repo graphs on heavy active repos, and update the relevant graph after code changes.
9. Capture the work timestamp with `date -Iseconds`.
10. Work in the smallest complete chunk that can be reviewed safely.

Risk-triggering work includes production, deployment, authentication, authorization, payments, secrets, sensitive data, database migrations, customer communications, external side effects, infrastructure or provider settings, destructive actions, autonomous tool use, risk classification, governance policy changes, or release readiness.

## Agent Handoff

Update this file only when the top-level plan or handoff point changes. Put detailed step-by-step progress in the active plan named above.

After compaction or a context clear, restart from the latest handoff/work packet,
then run `git status --short`, read the short repo-local instructions, and open
only the active plan and files needed for the next objective.
