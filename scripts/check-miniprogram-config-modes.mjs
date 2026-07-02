import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "check-miniprogram.mjs");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nyq-miniprogram-config-"));

function write(file, source) {
  const fullPath = path.join(tempRoot, file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, source, "utf8");
}

function projectConfig(appid, urlCheck, miniprogramRoot) {
  return JSON.stringify({
    description: "宁约球微信小程序",
    miniprogramRoot,
    compileType: "miniprogram",
    appid,
    projectname: "nyq-miniprogram",
    setting: {
      urlCheck,
      es6: true,
      enhance: true,
      postcss: true,
      minified: true
    }
  }, null, 2);
}

function writeFixture(appid, urlCheck) {
  write("project.config.json", projectConfig(appid, urlCheck, "miniprogram/"));
  write("miniprogram/project.config.json", projectConfig(appid, urlCheck, "./"));
  write("miniprogram/sitemap.json", JSON.stringify({ rules: [{ action: "allow", page: "*" }] }, null, 2));
  write("miniprogram/app.json", JSON.stringify({
    pages: ["pages/home/home", "pages/me/me"],
    window: {
      navigationBarTitleText: "宁约球",
      navigationBarBackgroundColor: "#0b6b3e",
      navigationBarTextStyle: "white",
      backgroundColor: "#f4f7f2"
    },
    tabBar: {
      color: "#6f7c72",
      selectedColor: "#0b6b3e",
      backgroundColor: "#ffffff",
      list: [
        { pagePath: "pages/home/home", text: "首页" },
        { pagePath: "pages/me/me", text: "我的" }
      ]
    }
  }, null, 2));
  write("miniprogram/app.js", "App({ globalData: {} });\n");

  for (const page of ["home", "me"]) {
    write(`miniprogram/pages/${page}/${page}.json`, JSON.stringify({ navigationBarTitleText: page === "home" ? "首页" : "我的" }, null, 2));
    write(`miniprogram/pages/${page}/${page}.js`, "Page({});\n");
    write(`miniprogram/pages/${page}/${page}.wxml`, '<view class="page"><view class="section"><text>宁约球</text></view></view>\n');
    write(`miniprogram/pages/${page}/${page}.wxss`, ".page {}\n.section {}\n");
  }
}

function runCheck() {
  return execFileSync(process.execPath, [scriptPath], {
    cwd: tempRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

try {
  writeFixture("touristappid", false);
  if (!runCheck().includes("Mini Program check passed.")) {
    throw new Error("Expected local touristappid fixture to pass.");
  }

  writeFixture("wx1234567890abcdef", true);
  if (!runCheck().includes("Mini Program check passed.")) {
    throw new Error("Expected real AppID release fixture to pass.");
  }

  writeFixture("wx1234567890abcdef", false);
  let failedAsExpected = false;
  try {
    runCheck();
  } catch (error) {
    failedAsExpected = true;
    const output = `${error.stdout || ""}\n${error.stderr || ""}`;
    if (!output.includes("setting.urlCheck must not stay false")) {
      throw new Error("Real AppID fixture with urlCheck=false did not report the expected error.");
    }
  }

  if (!failedAsExpected) {
    throw new Error("Expected real AppID fixture with urlCheck=false to fail.");
  }

  console.log("Mini Program config mode self-test passed.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
