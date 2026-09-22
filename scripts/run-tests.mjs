/**
 * Bundles the workflow tests and runs them against the database in .env.
 * esbuild is used only to strip the types and resolve the @srv alias.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "node_modules", ".test-build");
const outFile = join(outDir, "workflows.mjs");

mkdirSync(outDir, { recursive: true });

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });

try {
  run("npx", [
    "esbuild",
    "tests/workflows.test.ts",
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--external:pg",
    "--external:nodemailer",
    `--alias:@srv=${join(root, "src", "server")}`,
    `--outfile=${outFile}`,
    "--log-level=warning",
  ]);
  run("node", ["--env-file-if-exists=.env", outFile]);
} catch (error) {
  process.exitCode = error.status ?? 1;
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
