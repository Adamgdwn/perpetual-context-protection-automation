import * as vscode from "vscode";
import type { BridgeClient } from "./bridgeClient";
import { isDoubleEscape, isEscape } from "../shared/terminalKillChord";

export class BridgeManagedPseudoterminal implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  private readonly closeEmitter = new vscode.EventEmitter<void>();
  private pollHandle: NodeJS.Timeout | undefined;
  private lastOutputLength = 0;
  private lastEscapeAt = 0;
  private disposed = false;

  public readonly onDidWrite = this.writeEmitter.event;
  public readonly onDidClose = this.closeEmitter.event;

  public constructor(
    private readonly client: BridgeClient,
    private readonly sessionId: string
  ) {}

  public open(): void {
    this.writeEmitter.fire("Connected to managed PCPA bridge session.\r\n");
    this.writeEmitter.fire("Press Esc twice to stop this managed session.\r\n");
    this.pollHandle = setInterval(() => {
      void this.pollOutput();
    }, 250);
    void this.pollOutput();
  }

  // Invoked by VS Code when the terminal is closed (e.g. the trash icon). Stop
  // the bridge session so closing the terminal actually ends the session rather
  // than leaving it running headless.
  public close(): void {
    this.dispose(false);
  }

  public handleInput(data: string): void {
    if (isDoubleEscape(data, Date.now(), this.lastEscapeAt)) {
      this.lastEscapeAt = 0;
      this.writeEmitter.fire("\r\nStopping managed session (Esc Esc)...\r\n");
      this.dispose(true);
      return;
    }

    // Record a single Escape so the next one can complete the chord, but still
    // forward it so Esc keeps working as an interrupt inside the agent.
    if (isEscape(data)) {
      this.lastEscapeAt = Date.now();
    }

    void this.client.sendInput(this.sessionId, data).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.writeEmitter.fire(`\r\nBridge input failed: ${message}\r\n`);
    });
  }

  // Stop polling, stop the bridge session once, and (when the terminal is still
  // open) ask VS Code to close it. Guarded so a kill followed by VS Code's own
  // close() call does not stop the session twice.
  private dispose(closeTerminal: boolean): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }

    if (!this.disposed) {
      this.disposed = true;
      void this.client.stopSession(this.sessionId).catch(() => {
        // The bridge may already be gone (crashed or session ended); closing the
        // terminal is still the right outcome, so swallow the error.
      });
    }

    if (closeTerminal) {
      this.closeEmitter.fire();
    }
  }

  private async pollOutput(): Promise<void> {
    const response = await this.client.getOutput(this.sessionId);
    const output = response.output;
    if (output.length <= this.lastOutputLength) {
      return;
    }

    const delta = output.slice(this.lastOutputLength);
    this.lastOutputLength = output.length;
    this.writeEmitter.fire(delta);
  }
}
