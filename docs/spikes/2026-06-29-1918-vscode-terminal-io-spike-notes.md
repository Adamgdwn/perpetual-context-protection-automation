# 2026-06-29 1918 VS Code Terminal I/O Spike Notes

Status: Draft complete
Last Major Update: 2026-06-29T19:18:45-06:00
Owner: build agent

## Purpose

Record the Chunk One integration result for the VS Code companion extension and
managed terminal I/O path.

## Decision

Use a localhost bridge that owns managed `node-pty` sessions. The VS Code
extension reports window/workspace heartbeat data, asks the bridge to start
managed sessions, and displays bridge-owned sessions through an extension-owned
`Pseudoterminal`.

This is the current reliable path for unattended automation because the bridge
can read PTY output and write input for sessions it starts. Existing arbitrary VS
Code terminals are still classified as `candidate` until a reliable output stream
is proven for them.

## Paths Tested

| Path | Result | Notes |
|---|---|---|
| VS Code extension activation | pass | `npm run test:vscode` launched an extension host under `xvfb`. |
| Extension heartbeat to bridge | pass | Extension command `pcpa.sendHeartbeat` posted workspace/window identity to the local bridge. |
| Managed Codex launch | pass | Extension command `pcpa.startManagedCodex` created a bridge-managed Codex PTY session. |
| Managed output read | pass | Bridge unit test and VS Code host test both observed `PCPA_PROOF_READY` and echo output. |
| Managed input write | pass | Bridge unit test and VS Code host test sent text into the managed echo PTY and observed the echoed response. |
| Arbitrary existing VS Code terminal adoption | deferred | Extension currently reports unmanaged terminals as `candidate`, not armable managed sessions. |
| Windows validation | handoff recorded | Bridge uses `node-pty`, localhost HTTP, and a Windows `powershell.exe` echo-proof profile, but Windows execution still needs to be run on the Windows laptop. |

## Observability Matrix

| Platform | Profile | Launch | Read output | Send input | Observability | Evidence |
|---|---|---:|---:|---:|---|---|
| Linux | Codex | pass | not fully exercised against live Codex output | not sent to live Codex | managed | `npm run test:vscode` executed `pcpa.startManagedCodex`; no Codex command input was sent. |
| Linux | Echo proof | pass | pass | pass | managed | `npm test` and `npm run test:vscode`. |
| Linux | Claude | implemented, not run | not run | not run | managed when launched | Same bridge profile path as Codex; live Claude spawn remains optional manual verification. |
| Windows | Codex | not run | not run | not run | expected managed | Handoff needed on Windows with Node dependencies installed. |
| Windows | Claude | not run | not run | not run | expected managed | Handoff needed on Windows with Node dependencies installed. |
| Windows | Echo proof | not run | not run | not run | expected managed | `echo-proof` profile resolves to `powershell.exe`; needs Windows execution. |
| Any | Arbitrary existing terminal | detected only | not proven | not allowed unattended | candidate | Extension deliberately marks unmanaged VS Code terminals as `candidate`. |

## Validation

Run from the repository root with Node activated through nvm:

```bash
source /home/adamgoodwin/.nvm/nvm.sh
nvm use --silent
npm audit
npm run lint
npm test
npm run test:vscode
```

Results recorded on 2026-06-29T19:18:45-06:00:

- `npm audit`: pass, 0 vulnerabilities.
- `npm run lint`: pass.
- `npm test`: pass, bridge heartbeat plus managed echo PTY read/write.
- `npm run test:vscode`: pass, VS Code extension host activation, heartbeat,
  managed Codex launch, managed echo PTY read/write.

## Known Gaps

- Windows execution is not locally proven in this Linux session.
- Live Claude launch was implemented but not run in the automated test.
- Live Codex was launched as a managed PTY, but no `/compact`, resume text, or
  other Codex command input was sent in this chunk.
- Existing arbitrary VS Code terminals remain candidates until a reliable output
  stream is proven or an explicit adoption path is designed.

## References

- VS Code API reference: https://code.visualstudio.com/api/references/vscode-api
- VS Code terminal APIs used in this spike include extension-controlled
  terminals through `Pseudoterminal`, `window.createTerminal`, and shell
  integration APIs whose own docs warn that fallback `sendText` cannot prove
  command completion without shell integration.

## Next Action

Start Chunk Two with the bridge-backed session data as the source for the
desktop shell and session cards. Keep the managed/candidate distinction visible
in the UI from the first screen.
