import assert from "node:assert/strict";
import * as vscode from "vscode";
import { startBridgeServer, type BridgeRuntime } from "../../../src/bridge/bridgeServer";
import type { BridgeSessionSummary } from "../../../src/shared/protocol";

export async function runExtensionCompanionTest(): Promise<void> {
  let runtime: BridgeRuntime | undefined;

  try {
    runtime = await startBridgeServer({ port: 0 });
    await vscode.workspace
      .getConfiguration("pcpa")
      .update("bridgeUrl", runtime.url, vscode.ConfigurationTarget.Global);

    const extension = vscode.extensions.getExtension(
      "adamgoodwin.perpetual-context-protection-automation"
    );
    assert.ok(extension);
    await extension.activate();

    const heartbeat = await vscode.commands.executeCommand("pcpa.sendHeartbeat");
    assert.ok(heartbeat);

    const codexSession = await vscode.commands.executeCommand<BridgeSessionSummary>(
      "pcpa.startManagedCodex"
    );
    assert.equal(codexSession.profileId, "codex");
    assert.equal(codexSession.observability, "managed");

    const proof = await vscode.commands.executeCommand<{
      ok: boolean;
      observedOutput: string;
    }>("pcpa.runManagedIoProof", "from-vscode-test");

    assert.equal(proof.ok, true);
    assert.match(proof.observedOutput, /PCPA_PROOF_ECHO:from-vscode-test/u);
  } finally {
    if (runtime) {
      await runtime.close();
    }
  }
}
