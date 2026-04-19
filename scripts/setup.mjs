#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const platform = process.platform;
const binaryName = platform === "win32" ? "skilltree-local.exe" : "skilltree-local";
const pluginId = "skilltree-control";

main().catch((error) => {
  console.error(`\nSetup failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const skipObsidian = args.has("skip-obsidian");
  const vaultPath = resolveVaultPath(args.get("vault"));

  section("SkillTree Local setup");
  log(`Platform: ${platform} ${os.arch()}`);
  log(`Vault: ${vaultPath}`);

  ensureCargo();

  if (!skipObsidian) {
    ensureObsidianInstalled();
  } else {
    log("Skipping Obsidian install/check.");
  }

  const installedBinaryPath = installDesktopBinary();
  installObsidianPlugin(vaultPath, installedBinaryPath);

  section("Done");
  log(`Desktop app: ${installedBinaryPath}`);
  log(`Obsidian plugin: ${path.join(vaultPath, ".obsidian", "plugins", pluginId)}`);
  log("Run `skilltree-local` or open SkillTree Local from your app launcher.");
}

function ensureCargo() {
  section("Rust toolchain");
  if (commandExists("cargo")) {
    run("cargo", ["--version"]);
    return;
  }

  openUrl("https://rustup.rs/");
  throw new Error("Cargo is not installed. Install Rust from https://rustup.rs/ and rerun setup.");
}

function ensureObsidianInstalled() {
  section("Obsidian");
  if (isObsidianInstalled()) {
    log("Obsidian is already installed.");
    return;
  }

  log("Obsidian was not found. Attempting platform install.");

  if (platform === "win32") {
    if (commandExists("winget") && tryRun("winget", ["install", "-e", "--id", "Obsidian.Obsidian", "--accept-package-agreements", "--accept-source-agreements"])) {
      return;
    }
    if (commandExists("choco") && tryRun("choco", ["install", "obsidian", "-y"])) {
      return;
    }
  }

  if (platform === "darwin") {
    if (existsSync("/Applications/Obsidian.app")) {
      return;
    }
    if (commandExists("brew") && tryRun("brew", ["install", "--cask", "obsidian"])) {
      return;
    }
  }

  if (platform === "linux") {
    if (commandExists("flatpak")) {
      tryRun("flatpak", ["remote-add", "--if-not-exists", "flathub", "https://flathub.org/repo/flathub.flatpakrepo"]);
      if (tryRun("flatpak", ["install", "-y", "flathub", "md.obsidian.Obsidian"])) {
        return;
      }
    }
    if (commandExists("snap") && tryRun("snap", ["install", "obsidian", "--classic"])) {
      return;
    }
  }

  openUrl("https://obsidian.md/download");
  throw new Error("Could not install Obsidian automatically. Install it from https://obsidian.md/download and rerun setup.");
}

function installDesktopBinary() {
  section("Desktop app");
  run("cargo", ["build", "-p", "skilltree-local", "--release"], { cwd: repoRoot });

  const sourceBinary = path.join(repoRoot, "target", "release", binaryName);
  if (!existsSync(sourceBinary)) {
    throw new Error(`Release binary was not produced at ${sourceBinary}`);
  }

  if (platform === "win32") {
    const installDir = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Programs", "SkillTree Local");
    mkdirSync(installDir, { recursive: true });
    const target = path.join(installDir, binaryName);
    copyFileSync(sourceBinary, target);
    createWindowsShortcut(target);
    log(`Installed binary to ${target}`);
    return target;
  }

  if (platform === "darwin") {
    const appDir = path.join(os.homedir(), "Applications", "SkillTree Local.app");
    const macosDir = path.join(appDir, "Contents", "MacOS");
    mkdirSync(macosDir, { recursive: true });
    const target = path.join(macosDir, "skilltree-local");
    copyFileSync(sourceBinary, target);
    run("chmod", ["0755", target]);
    writeFileSync(path.join(appDir, "Contents", "Info.plist"), macInfoPlist(), "utf8");
    log(`Installed app bundle to ${appDir}`);
    return target;
  }

  const installDir = path.join(os.homedir(), ".local", "bin");
  mkdirSync(installDir, { recursive: true });
  const target = path.join(installDir, "skilltree-local");
  copyFileSync(sourceBinary, target);
  run("chmod", ["0755", target]);
  createLinuxDesktopFile(target);
  log(`Installed binary to ${target}`);
  return target;
}

function installObsidianPlugin(vaultPath, desktopAppPath) {
  section("Obsidian plugin");
  mkdirSync(path.join(vaultPath, ".obsidian"), { recursive: true });
  run("npm", ["run", "obsidian:build"], { cwd: repoRoot });

  const sourceDir = path.join(repoRoot, "obsidian-plugin", pluginId);
  const targetDir = path.join(vaultPath, ".obsidian", "plugins", pluginId);
  mkdirSync(targetDir, { recursive: true });

  for (const fileName of ["manifest.json", "main.js", "styles.css"]) {
    copyFileSync(path.join(sourceDir, fileName), path.join(targetDir, fileName));
  }

  writeFileSync(
    path.join(targetDir, "data.json"),
    `${JSON.stringify({ rootFolder: "SkillTree", desktopAppPath }, null, 2)}\n`,
    "utf8"
  );

  log(`Installed plugin to ${targetDir}`);
}

function isObsidianInstalled() {
  if (commandExists("obsidian")) return true;
  if (platform === "darwin") return existsSync("/Applications/Obsidian.app");
  if (platform === "win32") {
    return [
      path.join(process.env.LOCALAPPDATA || "", "Obsidian", "Obsidian.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Programs", "Obsidian", "Obsidian.exe"),
      path.join(process.env.ProgramFiles || "", "Obsidian", "Obsidian.exe"),
    ].some((candidate) => candidate && existsSync(candidate));
  }
  if (platform === "linux") {
    return [
      "/usr/bin/obsidian",
      "/usr/local/bin/obsidian",
      "/snap/bin/obsidian",
      "/var/lib/flatpak/app/md.obsidian.Obsidian",
      path.join(os.homedir(), ".local/share/flatpak/app/md.obsidian.Obsidian"),
    ].some((candidate) => existsSync(candidate));
  }
  return false;
}

function resolveVaultPath(explicitVault) {
  if (explicitVault) return path.resolve(expandHome(explicitVault));
  if (process.env.OBSIDIAN_VAULT_PATH) return path.resolve(expandHome(process.env.OBSIDIAN_VAULT_PATH));

  const envLocal = path.join(repoRoot, ".env.local");
  if (existsSync(envLocal)) {
    const raw = readFileSync(envLocal, "utf8");
    const match = raw.match(/^OBSIDIAN_VAULT_PATH=(.+)$/m);
    if (match) return path.resolve(expandHome(match[1].trim().replace(/^"|"$/g, "")));
  }

  const candidates = [
    path.join(os.homedir(), "Documents", "Obsidian Vault"),
    path.join(os.homedir(), "Obsidian Vault"),
    path.join(os.homedir(), "Documents", "SkillTree Vault"),
  ];
  const existing = candidates.find((candidate) => existsSync(candidate));
  const vaultPath = existing || candidates.at(-1);
  mkdirSync(vaultPath, { recursive: true });
  return vaultPath;
}

function createLinuxDesktopFile(binaryPath) {
  const appsDir = path.join(os.homedir(), ".local", "share", "applications");
  mkdirSync(appsDir, { recursive: true });
  writeFileSync(
    path.join(appsDir, "skilltree-local.desktop"),
    [
      "[Desktop Entry]",
      "Type=Application",
      "Name=SkillTree Local",
      "Comment=Local desktop skill tree editor",
      `Exec=${binaryPath}`,
      "Terminal=false",
      "Categories=Office;Education;",
      "",
    ].join("\n"),
    "utf8"
  );
}

function createWindowsShortcut(target) {
  const startMenu = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs");
  mkdirSync(startMenu, { recursive: true });
  const shortcut = path.join(startMenu, "SkillTree Local.lnk");
  const script = `$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${shortcut.replaceAll("'", "''")}'); $Shortcut.TargetPath = '${target.replaceAll("'", "''")}'; $Shortcut.Save()`;
  tryRun("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]);
}

function macInfoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>skilltree-local</string>
  <key>CFBundleIdentifier</key>
  <string>local.skilltree.desktop</string>
  <key>CFBundleName</key>
  <string>SkillTree Local</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
</dict>
</plist>
`;
}

function commandExists(command) {
  const checker = platform === "win32" ? "where" : "which";
  return spawnSync(checker, [command], { stdio: "ignore", shell: platform === "win32" }).status === 0;
}

function run(command, args, options = {}) {
  log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function tryRun(command, args, options = {}) {
  log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: platform === "win32",
    ...options,
  });
  return result.status === 0;
}

function openUrl(url) {
  if (platform === "win32") {
    tryRun("cmd", ["/c", "start", "", url]);
  } else if (platform === "darwin") {
    tryRun("open", [url]);
  } else {
    tryRun("xdg-open", [url]);
  }
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      values.set(key, true);
    }
  }
  return values;
}

function expandHome(value) {
  return value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value;
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

function log(message) {
  console.log(message);
}
