import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function gitBinary() {
  const candidates = [
    process.env.GIT_BIN,
    "git",
    "C:\\Program Files\\Git\\bin\\git.exe",
    "C:\\Program Files\\Git\\cmd\\git.exe",
    "C:\\Program Files (x86)\\Git\\bin\\git.exe"
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });
      return candidate;
    } catch (error) {
      // Try the next known Git location.
    }
  }

  throw new Error("Git executable was not found. Install Git or set GIT_BIN to the git executable path.");
}

const gitExe = gitBinary();

function git(args) {
  return execFileSync(gitExe, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).split(/\r?\n/).filter(Boolean);
}

function normalize(file) {
  return file.replaceAll("\\", "/");
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(file);
    return file === pattern || file.startsWith(`${pattern}/`);
  });
}

const trackedFiles = git(["ls-files"]).map(normalize);
const forbiddenTracked = [
  ".env",
  ".env.server",
  "node_modules",
  "miniprogram/project.private.config.json",
  "miniprogram/miniprogram_npm",
  "miniprogram/.cache",
  "miniprogram/.temp",
  /^.*\.apk$/i,
  /^.*\.log$/i,
  /^.*\.zip$/i,
  /^nyq-.*\.png$/i,
  /^tmp_.*\.(js|cjs)$/i,
  /^cloudflare-.*$/i,
  /^mobile-.*$/i,
  /^tunnel.*$/i
];

for (const file of trackedFiles) {
  if (matchesAny(file, forbiddenTracked)) {
    errors.push(`Forbidden generated/local file is tracked: ${file}`);
  }
}

const gitignorePath = path.join(root, ".gitignore");
const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";
const requiredIgnoreSnippets = [
  "node_modules/",
  ".env",
  ".env.server",
  "*.apk",
  "*.zip",
  "*.log",
  "nyq-*.png",
  "tmp_*.js",
  "tmp_*.cjs",
  "miniprogram/project.private.config.json"
];

for (const snippet of requiredIgnoreSnippets) {
  if (!gitignore.includes(snippet)) {
    errors.push(`.gitignore is missing required local artifact rule: ${snippet}`);
  }
}

if (errors.length > 0) {
  console.error("Repository hygiene check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Repository hygiene check passed.");
