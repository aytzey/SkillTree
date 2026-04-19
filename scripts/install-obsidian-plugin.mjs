import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import os from "node:os";

const repoRoot = process.cwd();
const pluginId = "skilltree-control";
const sourceDir = path.join(repoRoot, "obsidian-plugin", pluginId);
const vaultPath = process.argv[2] || process.env.OBSIDIAN_VAULT_PATH;

if (!vaultPath) {
  console.error("Usage: npm run obsidian:install -- /absolute/path/to/ObsidianVault");
  console.error("Or set OBSIDIAN_VAULT_PATH in the environment.");
  process.exit(1);
}

const targetDir = path.join(vaultPath, ".obsidian", "plugins", pluginId);
await fs.mkdir(targetDir, { recursive: true });

for (const fileName of ["manifest.json", "main.js", "styles.css"]) {
  await fs.copyFile(path.join(sourceDir, fileName), path.join(targetDir, fileName));
}

await fs.writeFile(
  path.join(targetDir, "data.json"),
  `${JSON.stringify({
    rootFolder: process.env.SKILLTREE_OBSIDIAN_ROOT || "SkillTree",
    desktopAppPath: process.env.SKILLTREE_DESKTOP_APP_PATH || defaultDesktopAppPath(),
  }, null, 2)}\n`,
  "utf8"
);

console.log(`Installed ${pluginId} to ${targetDir}`);
console.log("Restart Obsidian or reload plugins, then enable SkillTree Control in Community plugins.");

function defaultDesktopAppPath() {
  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      "Programs",
      "SkillTree Local",
      "skilltree-local.exe"
    );
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Applications", "SkillTree Local.app", "Contents", "MacOS", "skilltree-local");
  }

  return path.join(os.homedir(), ".local", "bin", "skilltree-local");
}
