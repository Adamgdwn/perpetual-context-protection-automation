# Deployment Guide

Last updated: 2026-06-29T22:05:13-06:00

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

## Local Linux Setup

Build and install the current Linux launcher:

```bash
npm run desktop:install-linux-launcher
```

Package and install the VS Code companion extension into the normal VS Code
profile:

```bash
npm run vscode:install
```

The VSIX is written to:

```text
dist/vscode/perpetual-context-protection-automation-0.0.1.vsix
```

After install, reload open VS Code windows if heartbeats do not appear within
one heartbeat interval.

## Rollback

- Uninstall or close the desktop app.
- Disable or uninstall the VS Code companion extension.
- Continue sessions manually in VS Code.
- Revert to the previous release artifact if one exists.

Local Linux rollback commands:

```bash
code --uninstall-extension adamgoodwin.perpetual-context-protection-automation
rm -f "$HOME/.local/share/applications/perpetual-context-protection.desktop"
rm -f "$HOME/Desktop/Perpetual Context Protection.desktop"
rm -f "$HOME/.local/share/icons/hicolor/scalable/apps/perpetual-context-protection.svg"
```

## Validation

- Desktop app launches.
- VS Code extension connects to app.
- Managed session card appears.
- Dry-run boundary detection logs a decision.
- Live compact/resume works on a disposable test session.
- Candidate/unsupported sessions cannot be armed unattended.
