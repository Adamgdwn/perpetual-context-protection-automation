import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { DesktopSetupSummary } from "../shared/protocol";

const EXTENSION_ID = "adamgoodwin.perpetual-context-protection-automation";
const EXTENSION_NAME = "perpetual-context-protection-automation";
const EXTENSION_VERSION = "0.0.2";

export function createDesktopSetupSummary(): DesktopSetupSummary {
  const checkedLocations = candidateExtensionDirectories();
  const installedLocation = checkedLocations.find(hasCompanionExtension);

  return {
    vscodeExtension: {
      extensionId: EXTENSION_ID,
      expectedVersion: EXTENSION_VERSION,
      installed: Boolean(installedLocation),
      installedLocation,
      checkedLocations,
      installCommand: "npm run vscode:install",
      reloadHint: "Reload open VS Code windows after installing the companion extension."
    }
  };
}

function candidateExtensionDirectories(): string[] {
  const home = homedir();
  if (process.platform === "win32") {
    const userProfile = process.env.USERPROFILE ?? home;
    return [
      join(userProfile, ".vscode", "extensions"),
      join(userProfile, ".vscode-insiders", "extensions")
    ];
  }

  return [
    join(home, ".vscode", "extensions"),
    join(home, ".vscode-insiders", "extensions")
  ];
}

function hasCompanionExtension(extensionsDir: string): boolean {
  if (!existsSync(extensionsDir)) {
    return false;
  }

  return readdirSync(extensionsDir).some(
    (entry) =>
      entry === EXTENSION_ID ||
      entry.startsWith(`${EXTENSION_ID}-`) ||
      entry === EXTENSION_NAME ||
      entry.startsWith(`${EXTENSION_NAME}-`)
  );
}
