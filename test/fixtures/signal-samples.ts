export const signalSampleTimes = {
  now: Date.parse("2026-06-29T20:10:00-06:00"),
  idle: Date.parse("2026-06-29T20:09:20-06:00"),
  active: Date.parse("2026-06-29T20:09:59-06:00"),
  recentCommand: Date.parse("2026-06-29T20:09:50-06:00")
};

export const signalSamples = {
  explicitChunkDone: [
    "Validation passed.",
    "===CHUNK_DONE===",
    "$"
  ].join("\n"),

  naturalChunkBoundary: [
    "Status: Draft complete.",
    "Chunk Three draft complete.",
    "Next action: start the next chunk."
  ].join("\n"),

  activeStreaming: [
    "Running npm test command now.",
    "The test process is still streaming output."
  ].join("\n"),

  boundaryWhileActive: [
    "Chunk Three draft complete.",
    "Running npm test command now."
  ].join("\n"),

  taskComplete: [
    "The requested task is complete.",
    "No required work remains."
  ].join("\n"),

  blocked: "Blocked: need access to the Windows laptop before proceeding.",

  needsHuman: "Please confirm whether to proceed with this risky action.",

  compacting: [
    "/compact",
    "Compacting context and summarizing the current work packet..."
  ].join("\n"),

  falsePositiveBoundary: [
    "This is not ready for the next chunk.",
    "Do not compact yet."
  ].join("\n"),

  conflictingStopStates: [
    "===TASK_COMPLETE===",
    "===BLOCKED==="
  ].join("\n"),

  echoProofReady: "PCPA_PROOF_READY"
};
