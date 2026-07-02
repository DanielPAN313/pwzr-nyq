import { execFileSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const root = process.cwd();
const baseRef = process.env.UI_BASE_REF || "origin/feature-miniprogram-flow";
const uiRef = process.env.UI_BRANCH_REF || "origin/ui-polish";
const windowsGit = "C:\\Program Files\\Git\\bin\\git.exe";
const gitBin = process.env.GIT_BIN || (fs.existsSync(windowsGit) ? windowsGit : "git");

function git(args) {
  return execFileSync(gitBin, args, { cwd: root, encoding: "utf8" }).trim();
}

function refExists(ref) {
  try {
    git(["rev-parse", "--verify", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function isAllowedUiFile(file) {
  return (
    /^miniprogram\/pages\/.+\.(wxml|wxss)$/.test(file)
    || file === "miniprogram/app.wxss"
    || file === "docs/ui-design-system.md"
  );
}

function isCautiousFile(file) {
  return /^miniprogram\/pages\/.+\.json$/.test(file);
}

function isDangerousFile(file) {
  return (
    /^miniprogram\/pages\/.+\.js$/.test(file)
    || /^miniprogram\/utils\//.test(file)
    || /^scripts\//.test(file)
    || /^db\//.test(file)
    || file === "package.json"
    || file === "package-lock.json"
    || /^\.github\//.test(file)
    || /^docs\/legal\//.test(file)
  );
}

if (!refExists(baseRef)) {
  console.error(`UI branch scope check failed: base ref does not exist: ${baseRef}`);
  console.error("Run: git fetch origin");
  process.exit(1);
}

if (!refExists(uiRef)) {
  console.error(`UI branch scope check failed: UI ref does not exist: ${uiRef}`);
  console.error("Run: git fetch origin ui-polish");
  process.exit(1);
}

const diffOutput = git(["diff", "--name-status", `${baseRef}..${uiRef}`]);
const rows = diffOutput ? diffOutput.split(/\r?\n/) : [];
const allowed = [];
const cautious = [];
const dangerous = [];
const deletions = [];

for (const row of rows) {
  const [status, ...parts] = row.split(/\t/);
  const file = parts[parts.length - 1] || "";
  if (!file) continue;

  if (status.startsWith("D")) {
    deletions.push(`${status} ${file}`);
    continue;
  }

  if (isAllowedUiFile(file)) {
    allowed.push(`${status} ${file}`);
  } else if (isCautiousFile(file)) {
    cautious.push(`${status} ${file}`);
  } else if (isDangerousFile(file)) {
    dangerous.push(`${status} ${file}`);
  } else {
    dangerous.push(`${status} ${file}`);
  }
}

if (deletions.length || dangerous.length) {
  console.error("UI branch scope check failed.");
  console.error(`Compared ${baseRef}..${uiRef}`);

  if (deletions.length) {
    console.error("\nDeleted files are not safe for direct UI merge:");
    for (const item of deletions) console.error(`- ${item}`);
  }

  if (dangerous.length) {
    console.error("\nFiles outside safe UI scope require manual review:");
    for (const item of dangerous) console.error(`- ${item}`);
  }

  if (allowed.length) {
    console.error("\nSafe UI candidates:");
    for (const item of allowed) console.error(`- ${item}`);
  }

  if (cautious.length) {
    console.error("\nCautious UI candidates:");
    for (const item of cautious) console.error(`- ${item}`);
  }

  process.exit(1);
}

console.log(`UI branch scope check passed: ${uiRef} only changes safe UI files relative to ${baseRef}.`);
if (allowed.length) {
  console.log("Safe UI files:");
  for (const item of allowed) console.log(`- ${item}`);
}
if (cautious.length) {
  console.log("Cautious page config files:");
  for (const item of cautious) console.log(`- ${item}`);
}
