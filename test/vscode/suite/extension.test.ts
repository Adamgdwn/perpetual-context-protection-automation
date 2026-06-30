import assert from "node:assert/strict";
import * as vscode from "vscode";
import { startBridgeServer, type BridgeRuntime } from "../../../src/bridge/bridgeServer";
import type {
  BridgeSessionSummary,
  DesktopStateResponse
} from "../../../src/shared/protocol";

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

    const desktopStateResponse = await fetch(`${runtime.url}/desktop/state`);
    assert.equal(desktopStateResponse.ok, true);
    const desktopState =
      (await desktopStateResponse.json()) as DesktopStateResponse;
    assert.equal(desktopState.connection.heartbeatCount, 1);
    assert.ok(
      desktopState.cards.some((card) => card.workspaceName === "untitled-vscode-window")
    );

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
