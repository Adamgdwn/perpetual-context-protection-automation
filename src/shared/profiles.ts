import type { AgentProfileId } from "./protocol";

export interface ResolvedAgentProfile {
  id: AgentProfileId;
  displayName: string;
  command: string;
  args: string[];
  compactCommand: string;
  resumeInstruction: string;
  inputLineEnding: "\r" | "\n";
}

export function resolveAgentProfile(
  profileId: AgentProfileId,
  platform: NodeJS.Platform = process.platform
): ResolvedAgentProfile {
  if (profileId === "claude") {
    return {
      id: "claude",
      displayName: "Claude",
      command: "claude",
      args: [],
      compactCommand: "/compact",
      resumeInstruction: "Carry on with the next chunk.",
      inputLineEnding: "\r"
    };
  }

  if (profileId === "codex") {
    return {
      id: "codex",
      displayName: "Codex",
      command: "codex",
      args: [],
      compactCommand: "/compact",
      resumeInstruction: "Carry on with the next chunk.",
      inputLineEnding: "\r"
    };
  }

  if (platform === "win32") {
    return {
      id: "echo-proof",
      displayName: "Echo Proof",
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-Command",
        "$OutputEncoding=[Console]::OutputEncoding; Write-Output 'PCPA_PROOF_READY'; while ($null -ne ($line = [Console]::In.ReadLine())) { Write-Output ('PCPA_PROOF_ECHO:' + $line) }"
      ],
      compactCommand: "/compact",
      resumeInstruction: "Carry on with the next chunk.",
      inputLineEnding: "\r"
    };
  }

  return {
    id: "echo-proof",
    displayName: "Echo Proof",
    command: "/bin/sh",
    args: [
      "-lc",
      "printf 'PCPA_PROOF_READY\\n'; while IFS= read -r line; do printf 'PCPA_PROOF_ECHO:%s\\n' \"$line\"; done"
    ],
    compactCommand: "/compact",
    resumeInstruction: "Carry on with the next chunk.",
    inputLineEnding: "\r"
  };
}
