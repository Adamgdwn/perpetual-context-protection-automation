import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const packageJson = JSON.parse(await readFile(join(repoDir, "package.json"), "utf8"));
const outDir = join(repoDir, "dist", "vscode");
const outPath = join(outDir, `${packageJson.name}-${packageJson.version}.vsix`);

await mkdir(outDir, { recursive: true });
run("npm", ["run", "compile"]);
run(resolveBin("vsce"), ["package", "--out", outPath, "--no-dependencies"]);

console.log(outPath);

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

function resolveBin(name) {
  const suffix = process.platform === "win32" ? ".cmd" : "";
  return join(repoDir, "node_modules", ".bin", `${name}${suffix}`);
}
