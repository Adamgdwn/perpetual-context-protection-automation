import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AutomationController,
  type AutomatableSession
} from "../../src/bridge/automationController";
import { managedCardId } from "../../src/bridge/cardIds";
import { resolveAgentProfile, type ResolvedAgentProfile } from "../../src/shared/profiles";
import type { BridgeSessionSummary } from "../../src/shared/protocol";
import { signalSamples, signalSampleTimes } from "../fixtures/signal-samples";

void test("dry-run logs would compact without sending text and does not double fire", () => {
  const controller = new AutomationController();
  const session = new FakeSession(signalSamples.explicitChunkDone);
  controller.armCard(managedCardId(session.id));

  const events = controller.evaluateSessions([session], signalSampleTimes.now);

  assert.equal(session.sentLines.length, 0);
  assert.equal(events.some((event) => event.kind === "automation-dry-run"), true);
  assert.match(events.map((event) => event.message).join("\n"), /would compact/u);
  assert.ok(
    events
      .flatMap((event) => event.details ?? [])
      .some((detail) => detail.includes("evidence:explicit-marker"))
  );
  assert.equal(controller.getSnapshot(managedCardId(session.id)).state, "dry-run-ready");

  const repeated = controller.evaluateSessions([session], signalSampleTimes.now + 1000);
  assert.deepEqual(repeated, []);
  assert.equal(session.sentLines.length, 0);
});

void test("live mode sends compact after boundary and waits for quiet before resume", () => {
  const controller = new AutomationController();
  const session = new FakeSession(signalSamples.explicitChunkDone);
  controller.setMode("live");
  controller.armCard(managedCardId(session.id));

  const compactEvents = controller.evaluateSessions([session], signalSampleTimes.now);

  assert.deepEqual(session.sentLines, [session.profile.compactCommand]);
  assert.equal(
    compactEvents.some((event) => event.kind === "automation-compact"),
    true
  );
  assert.equal(controller.getSnapshot(managedCardId(session.id)).state, "compacting");

  session.output += "\nCompacting context...";
  session.lastOutputAt = new Date(signalSampleTimes.now).toISOString();
  const tooSoon = controller.evaluateSessions([session], signalSampleTimes.now + 10_000);
  assert.deepEqual(tooSoon, []);
  assert.deepEqual(session.sentLines, [session.profile.compactCommand]);

  const resumeEvents = controller.evaluateSessions(
    [session],
    signalSampleTimes.now + 31_000
  );
  assert.deepEqual(session.sentLines, [
    session.profile.compactCommand,
    session.profile.resumeInstruction
  ]);
  assert.equal(
    resumeEvents.some((event) => event.kind === "automation-resume"),
    true
  );
  assert.equal(controller.getSnapshot(managedCardId(session.id)).state, "resuming");
  assert.equal(controller.getSnapshot(managedCardId(session.id)).chunkCount, 1);

  controller.evaluateSessions([session], signalSampleTimes.now + 47_000);
  assert.equal(controller.getSnapshot(managedCardId(session.id)).state, "watching");
});

void test("terminal stop states do not send compact commands", () => {
  const controller = new AutomationController();
  const session = new FakeSession(signalSamples.taskComplete);
  controller.setMode("live");
  controller.armCard(managedCardId(session.id));

  const events = controller.evaluateSessions([session], signalSampleTimes.now);

  assert.equal(session.sentLines.length, 0);
  assert.equal(controller.getSnapshot(managedCardId(session.id)).state, "complete");
  assert.equal(events.some((event) => event.kind === "automation-stop"), true);
});

void test("pause suppresses watching and compact-resume sends", () => {
  const controller = new AutomationController();
  const session = new FakeSession(signalSamples.explicitChunkDone);
  controller.setMode("live");

  controller.armCard(managedCardId(session.id));
  controller.pauseCard(managedCardId(session.id));
  assert.deepEqual(controller.evaluateSessions([session], signalSampleTimes.now), []);
  assert.equal(session.sentLines.length, 0);

  controller.armCard(managedCardId(session.id));
  controller.evaluateSessions([session], signalSampleTimes.now);
  assert.deepEqual(session.sentLines, [session.profile.compactCommand]);

  controller.pauseCard(managedCardId(session.id));
  session.lastOutputAt = new Date(signalSampleTimes.now).toISOString();
  assert.deepEqual(
    controller.evaluateSessions([session], signalSampleTimes.now + 31_000),
    []
  );
  assert.deepEqual(session.sentLines, [session.profile.compactCommand]);

  controller.armCard(managedCardId(session.id));
  controller.evaluateSessions([session], signalSampleTimes.now + 31_000);
  assert.deepEqual(session.sentLines, [
    session.profile.compactCommand,
    session.profile.resumeInstruction
  ]);
});

class FakeSession implements AutomatableSession {
  public readonly id = "fake-session";
  public readonly profile: ResolvedAgentProfile = resolveAgentProfile("codex");
  public status: BridgeSessionSummary["status"] = "running";
  public output: string;
  public lastOutputAt: string | undefined = new Date(signalSampleTimes.idle).toISOString();
  public readonly sentLines: string[] = [];

  public constructor(output: string) {
    this.output = output;
  }

  public getOutput(): string {
    return this.output;
  }

  public sendLine(text: string): void {
    this.sentLines.push(text);
  }

  public summary(): BridgeSessionSummary {
    return {
      id: this.id,
      profileId: this.profile.id,
      workspaceId: "automation-workspace",
      workspaceName: "Automation Workspace",
      observability: "managed",
      startedAt: "2026-06-29T20:18:41-06:00",
      status: this.status,
      command: this.profile.command,
      outputLength: this.output.length,
      lastOutputAt: this.lastOutputAt
    };
  }
}
