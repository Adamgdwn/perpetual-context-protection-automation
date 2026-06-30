import type { IPty } from "node-pty";
import * as pty from "node-pty";
import { randomUUID } from "node:crypto";
import type {
  AgentProfileId,
  BridgeSessionSummary,
  WorkspaceIdentity
} from "../shared/protocol";
import { resolveAgentProfile } from "../shared/profiles";

type PtyExitEvent = { exitCode: number; signal?: number };

export interface ManagedPtySessionOptions {
  profileId: AgentProfileId;
  workspace: WorkspaceIdentity;
  cwd?: string;
  cols?: number;
  rows?: number;
  env?: NodeJS.ProcessEnv;
}

export class ManagedPtySession {
  public readonly id = randomUUID();
  public readonly profile;
  public readonly startedAt = new Date().toISOString();
  public status: "starting" | "running" | "exited" = "starting";
  public exitCode: number | undefined;

  private readonly options: ManagedPtySessionOptions;
  private readonly outputChunks: string[] = [];
  private readonly outputListeners = new Set<(data: string) => void>();
  private readonly exitListeners = new Set<(event: PtyExitEvent) => void>();
  private process: IPty | undefined;

  public constructor(options: ManagedPtySessionOptions) {
    this.options = options;
    this.profile = resolveAgentProfile(options.profileId);
  }

  public start(): void {
    if (this.process) {
      return;
    }

    this.status = "running";
    this.process = pty.spawn(this.profile.command, this.profile.args, {
      name: "xterm-256color",
      cols: this.options.cols ?? 100,
      rows: this.options.rows ?? 30,
      cwd: this.options.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ...this.options.env
      }
    });

    this.process.onData((data) => {
      this.outputChunks.push(data);
      for (const listener of this.outputListeners) {
        listener(data);
      }
    });

    this.process.onExit((event) => {
      this.status = "exited";
      this.exitCode = event.exitCode;
      for (const listener of this.exitListeners) {
        listener(event);
      }
    });
  }

  public write(data: string): void {
    if (!this.process || this.status === "exited") {
      throw new Error(`Managed session ${this.id} is not running`);
    }

    this.process.write(data);
  }

  public sendLine(text: string): void {
    this.write(`${text}${this.profile.inputLineEnding}`);
  }

  public getOutput(): string {
    return this.outputChunks.join("");
  }

  public onOutput(listener: (data: string) => void): () => void {
    this.outputListeners.add(listener);
    return () => this.outputListeners.delete(listener);
  }

  public onExit(listener: (event: PtyExitEvent) => void): () => void {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  public stop(): void {
    if (this.process && this.status !== "exited") {
      this.process.kill();
    }
  }

  public summary(): BridgeSessionSummary {
    return {
      id: this.id,
      profileId: this.profile.id,
      workspaceId: this.options.workspace.id,
      workspaceName: this.options.workspace.name,
      observability: "managed",
      startedAt: this.startedAt,
      status: this.status,
      command: [this.profile.command, ...this.profile.args].join(" "),
      outputLength: this.getOutput().length,
      exitCode: this.exitCode
    };
  }
}
