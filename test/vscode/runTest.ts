import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../../..");
  const extensionTestsPath = path.resolve(__dirname, "suite");
  const testDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "pcpa-vscode-"));

  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        "--disable-extensions",
        "--user-data-dir",
        path.join(testDataPath, "user-data"),
        "--extensions-dir",
        path.join(testDataPath, "extensions")
      ]
    });
  } finally {
    fs.rmSync(testDataPath, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
