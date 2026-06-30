import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const packageJson = JSON.parse(await readFile(join(repoDir, "package.json"), "utf8"));
const vsixPath = join(
  repoDir,
  "dist",
  "vscode",
  `${packageJson.name}-${packageJson.version}.vsix`
);

run("npm", ["run", "vscode:package"]);
await access(vsixPath, constants.R_OK);
run(process.env.VSCODE_CLI ?? "code", [
  "--install-extension",
  vsixPath,
  "--force"
]);

console.log(`Installed ${packageJson.publisher}.${packageJson.name}.`);
console.log("Reload open VS Code windows so the companion can start heartbeating.");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoDir,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
