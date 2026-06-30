import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAgentProfile } from "../../src/shared/profiles";
import { detectSessionSignal } from "../../src/shared/signalDetector";
import { signalSamples, signalSampleTimes } from "../fixtures/signal-samples";

void test("built-in coder profiles define launch, compact, resume, signals, and idle rules", () => {
  for (const profileId of ["claude", "codex"] as const) {
    const profile = resolveAgentProfile(profileId);

    assert.equal(profile.launchCommand.command, profileId);
    assert.equal(profile.command, profile.launchCommand.command);
    assert.deepEqual(profile.args, profile.launchCommand.args);
    assert.equal(profile.compactCommand, "/compact");
    assert.match(profile.resumeInstruction, /next chunk/u);
    assert.ok(profile.signals.explicitBoundaryMarkers.includes("===CHUNK_DONE==="));
    assert.ok(profile.signals.explicitCompleteMarkers.includes("===TASK_COMPLETE==="));
    assert.ok(profile.signals.explicitBlockedMarkers.includes("===BLOCKED==="));
    assert.ok(profile.signals.explicitNeedsHumanMarkers.includes("===NEEDS_HUMAN==="));
    assert.ok(profile.signals.boundary.length > 0);
    assert.ok(profile.signals.complete.length > 0);
    assert.ok(profile.signals.blocked.length > 0);
    assert.ok(profile.signals.needsHuman.length > 0);
    assert.ok(profile.idleRules.quietPeriodMs > 0);
    assert.ok(profile.idleRules.recentlySentCommandMs > 0);
  }
});

void test("detector accepts explicit chunk markers when idle evidence agrees", () => {
  const decision = detectSessionSignal({
    profile: "codex",
    output: signalSamples.explicitChunkDone,
    now: signalSampleTimes.now,
    lastOutputAt: signalSampleTimes.idle
  });

  assert.equal(decision.state, "chunk-boundary");
  assert.equal(decision.shouldCompact, true);
  assert.equal(decision.stopAutomation, false);
  assert.ok(
    decision.evidence.some((item) => item.id.includes("===CHUNK_DONE==="))
  );
});

void test("detector accepts natural chunk-boundary language only with idle evidence", () => {
  const idleDecision = detectSessionSignal({
    profile: "claude",
    output: signalSamples.naturalChunkBoundary,
    now: signalSampleTimes.now,
    lastOutputAt: signalSampleTimes.idle
  });

  assert.equal(idleDecision.state, "chunk-boundary");
  assert.equal(idleDecision.shouldCompact, true);

  const activeDecision = detectSessionSignal({
    profile: "claude",
    output: signalSamples.naturalChunkBoundary,
    now: signalSampleTimes.now,
    lastOutputAt: signalSampleTimes.active
  });

  assert.equal(activeDecision.state, "uncertain");
  assert.equal(activeDecision.shouldCompact, false);
  assert.equal(activeDecision.stopAutomation, true);
});

void test("detector identifies active streaming without compacting", () => {
  const decision = detectSessionSignal({
    profile: "codex",
    output: signalSamples.activeStreaming,
    now: signalSampleTimes.now,
    lastOutputAt: signalSampleTimes.active
  });

  assert.equal(decision.state, "active");
  assert.equal(decision.shouldCompact, false);
  assert.equal(decision.stopAutomation, false);
});

void test("detector returns uncertain when boundary and active evidence conflict", () => {
  const decision = detectSessionSignal({
    profile: "codex",
    output: signalSamples.boundaryWhileActive,
    now: signalSampleTimes.now,
    lastOutputAt: signalSampleTimes.active
  });

  assert.equal(decision.state, "uncertain");
  assert.equal(decision.shouldCompact, false);
  assert.equal(decision.stopAutomation, true);
});

void test("detector identifies terminal stop states", () => {
  const complete = detectSessionSignal({
    profile: "codex",
    output: signalSamples.taskComplete
  });
  assert.equal(complete.state, "task-complete");
  assert.equal(complete.shouldCompact, false);
  assert.equal(complete.stopAutomation, true);

  const blocked = detectSessionSignal({
    profile: "claude",
    output: signalSamples.blocked
  });
  assert.equal(blocked.state, "blocked");
  assert.equal(blocked.shouldCompact, false);
  assert.equal(blocked.stopAutomation, true);

  const needsHuman = detectSessionSignal({
    profile: "codex",
    output: signalSamples.needsHuman
  });
  assert.equal(needsHuman.state, "needs-human");
  assert.equal(needsHuman.shouldCompact, false);
  assert.equal(needsHuman.stopAutomation, true);
});

void test("detector suppresses automation during compaction", () => {
  const decision = detectSessionSignal({
    profile: "claude",
    output: signalSamples.compacting,
    now: signalSampleTimes.now,
    lastOutputAt: signalSampleTimes.active
  });

  assert.equal(decision.state, "compacting");
  assert.equal(decision.shouldCompact, false);
  assert.equal(decision.stopAutomation, true);
});

void test("detector returns uncertain for false positives and conflicting stop markers", () => {
  const falsePositive = detectSessionSignal({
    profile: "codex",
    output: signalSamples.falsePositiveBoundary,
    now: signalSampleTimes.now,
    lastOutputAt: signalSampleTimes.idle
  });
  assert.equal(falsePositive.state, "uncertain");
  assert.equal(falsePositive.shouldCompact, false);
  assert.equal(falsePositive.stopAutomation, true);

  const conflicting = detectSessionSignal({
    profile: "claude",
    output: signalSamples.conflictingStopStates
  });
  assert.equal(conflicting.state, "uncertain");
  assert.equal(conflicting.shouldCompact, false);
  assert.equal(conflicting.stopAutomation, true);
});

void test("echo-proof profile keeps proof readiness separate from coder completion", () => {
  const decision = detectSessionSignal({
    profile: "echo-proof",
    output: signalSamples.echoProofReady
  });

  assert.equal(decision.state, "uncertain");
  assert.equal(decision.shouldCompact, false);
  assert.equal(decision.stopAutomation, true);
});
