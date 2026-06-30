# Deployment Guide

## Environments

- `dev`: local source checkout, VS Code extension development host, unpackaged desktop app.
- `staging`: packaged desktop app and packaged VS Code extension installed locally for smoke testing.
- `prod`: public release artifacts from the GitHub repository.

## Deployment Steps

1. Run lint, tests, and build checks.
2. Package desktop app for Linux and Windows.
3. Package VS Code extension.
4. Run smoke tests on Linux and Windows.
5. Update changelog, manual, runbook, and known limitations.
6. Create GitHub release draft.
7. Publish only after release evidence is reviewed.

## Rollback

- Uninstall or close the desktop app.
- Disable or uninstall the VS Code companion extension.
- Continue sessions manually in VS Code.
- Revert to the previous release artifact if one exists.

## Validation

- Desktop app launches.
- VS Code extension connects to app.
- Managed session card appears.
- Dry-run boundary detection logs a decision.
- Live compact/resume works on a disposable test session.
- Candidate/unsupported sessions cannot be armed unattended.
