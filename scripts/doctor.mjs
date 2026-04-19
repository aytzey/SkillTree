#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const platform = process.platform;
const vaultPath = process.env.OBSIDIAN_VAULT_PATH || path.join(os.homedir(), "Documents", "Obsidian Vault");
const skipObsidian = process.argv.includes("--skip-obsidian") || process.env.SKILLTREE_DOCTOR_SKIP_OBSIDIAN === "1";

const checks = [
  ["Rust cargo", () => commandExists("cargo")],
  ["Rust app compiles", () => runQuiet("cargo", ["check", "-p", "skilltree-local"], repoRoot)],
  ["Obsidian app", () => skipObsidian || obsidianExists()],
  ["Obsidian vault folder", () => existsSync(vaultPath)],
  ["Obsidian plugin bundle", () => existsSync(path.join(repoRoot, "obsidian-plugin", "skilltree-control", "main.js"))],
  ["Installed desktop binary", () => installedBinaryExists()],
];

let failed = 0;
console.log("SkillTree Local doctor\n");
for (const [name, check] of checks) {
  const ok = Boolean(check());
  console.log(`${ok ? "OK " : "ERR"} ${name}`);
  if (!ok) failed += 1;
}

if (failed > 0) {
  console.log(`\n${failed} check(s) failed. Run: npm run setup`);
  process.exit(1);
}

console.log("\nAll checks passed.");

function commandExists(command) {
  const checker = platform === "win32" ? "where" : "which";
  return spawnSync(checker, [command], { stdio: "ignore", shell: platform === "win32" }).status === 0;
}

function runQuiet(command, args, cwd) {
  return spawnSync(command, args, { cwd, stdio: "ignore", shell: platform === "win32" }).status === 0;
}

function obsidianExists() {
  if (commandExists("obsidian")) return true;
  if (platform === "darwin") return existsSync("/Applications/Obsidian.app");
  if (platform === "win32") {
    return [
      path.join(process.env.LOCALAPPDATA || "", "Obsidian", "Obsidian.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Programs", "Obsidian", "Obsidian.exe"),
      path.join(process.env.ProgramFiles || "", "Obsidian", "Obsidian.exe"),
    ].some((candidate) => candidate && existsSync(candidate));
  }
  return [
    "/usr/bin/obsidian",
    "/usr/local/bin/obsidian",
    "/snap/bin/obsidian",
    "/var/lib/flatpak/app/md.obsidian.Obsidian",
    path.join(os.homedir(), ".local/share/flatpak/app/md.obsidian.Obsidian"),
  ].some((candidate) => existsSync(candidate));
}

function installedBinaryExists() {
  if (platform === "win32") {
    return existsSync(path.join(process.env.LOCALAPPDATA || "", "Programs", "SkillTree Local", "skilltree-local.exe"));
  }
  if (platform === "darwin") {
    return existsSync(path.join(os.homedir(), "Applications", "SkillTree Local.app", "Contents", "MacOS", "skilltree-local"));
  }
  return existsSync(path.join(os.homedir(), ".local", "bin", "skilltree-local"));
}
