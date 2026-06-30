# Document Control Standard

Document type: document-control standard
Status: active
Owner: Project owner or human technical lead
Audience: coding agents, human coders, reviewers, project owners, and release reviewers
Last Major Update: 2026-06-29T18:59:59-06:00

## Purpose

Keep build documents and information documents easy to identify, compare, and
resume from during agent-assisted work.

The repository should make the current working document obvious from its file
name when the document is standalone and not depended on by tooling, indexes,
startup instructions, code, or stable links.

## Dependency Rule

Only timestamp filenames for documents without dependencies.

If another file, tool, workflow, checklist, script, startup instruction, index,
or external reference depends on a document path or title, keep the existing
filename and title stable. Record the last major update in the document body
instead.

Dependency-bearing documents include:

- startup files
- required governance files
- standards linked from the standards index
- active pathway files
- runbooks linked by operators
- docs referenced by scripts, tests, configuration, code, or external systems
- docs with links that would be painful or error-prone to update everywhere

Do not rename dependency-bearing documents just to add a timestamp.

## Timestamped Filename Rule

When creating a standalone build document or information document, prefix the
filename with the local date and time of the last major update:

```text
YYYY-MM-DD-HHMM-document-slug.md
```

Use local workstation time unless a project-specific standard says otherwise.
Avoid colons in filenames so the convention works on Windows and Linux.

Examples:

- `2026-06-29-1859-vscode-integration-spike-notes.md`
- `2026-06-29-1859-terminal-observability-matrix.md`
- `2026-06-29-1859-release-readiness-notes.md`

If two major updates happen in the same minute and the distinction matters, add
seconds:

```text
YYYY-MM-DD-HHMMSS-document-slug.md
```

## Major Update Definition

A major update is a change that materially alters the document's decision,
direction, scope, status, or evidence. Examples include:

- replacing a build plan or spike plan
- changing architecture direction
- adding validation evidence that changes completion status
- promoting a draft into the current working reference
- superseding an older information document
- rewriting a runbook, standard, handoff, or audit record

Small typo fixes, link repairs, formatting cleanup, or minor clarifications do
not require a filename change.

## Applying The Rule

For a new standalone document, create it with the timestamped filename from the
start.

For a major update to a timestamped standalone document, either rename the
document with a new prefix or create a new timestamped replacement, then update
the index, handoff, or active plan that points to the current document.

For dependency-bearing files and canonical control files, keep the stable
filename and title, then put the full update timestamp in the document body.
Common dependency-bearing files include:

- `README.md`
- `START_HERE.md`
- `AGENTS.md`
- `project-control.yaml`
- `docs/current-build-pathway.md`
- `docs/context-map.md`
- `docs/CHANGELOG.md`
- files listed in `project-control.yaml`
- files linked from `docs/standards/README.md`

Rename dependency-bearing documents only when the owner explicitly asks,
because broken links and missed startup files are more harmful than the tracking
benefit.

## Current Working Document Pointers

When multiple timestamped documents exist for the same topic, the current one
must be discoverable from at least one stable pointer:

- `START_HERE.md`
- `docs/current-build-pathway.md`
- `docs/context-map.md`
- a README in the containing folder
- a changelog entry

Do not rely on chat memory to tell future agents which timestamped document is
current.
