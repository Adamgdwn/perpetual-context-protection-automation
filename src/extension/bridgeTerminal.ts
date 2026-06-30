import * as vscode from "vscode";
import type { BridgeClient } from "./bridgeClient";

export class BridgeManagedPseudoterminal implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  private readonly closeEmitter = new vscode.EventEmitter<void>();
  private pollHandle: NodeJS.Timeout | undefined;
  private lastOutputLength = 0;

  public readonly onDidWrite = this.writeEmitter.event;
  public readonly onDidClose = this.closeEmitter.event;

  public constructor(
    private readonly client: BridgeClient,
    private readonly sessionId: string
  ) {}

  public open(): void {
    this.writeEmitter.fire("Connected to managed PCPA bridge session.\r\n");
    this.pollHandle = setInterval(() => {
      void this.pollOutput();
    }, 250);
    void this.pollOutput();
  }

  public close(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }
    this.closeEmitter.fire();
  }

  public handleInput(data: string): void {
    void this.client.sendInput(this.sessionId, data).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.writeEmitter.fire(`\r\nBridge input failed: ${message}\r\n`);
    });
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
