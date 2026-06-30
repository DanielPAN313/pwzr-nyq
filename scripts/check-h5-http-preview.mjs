import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const root = process.cwd();
const serverScript = path.join(root, "scripts", "serve-local-mirror.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function waitForServer(baseUrl, child, stderr) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      if (child.exitCode != null) {
        clearInterval(timer);
        reject(new Error(`Preview server exited early.\n${stderr.join("")}`.trim()));
        return;
      }
      if (Date.now() - started > 10000) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for preview server.\n${stderr.join("")}`.trim()));
        return;
      }
      try {
        const response = await fetch(`${baseUrl}/`);
        if (response.ok) {
          clearInterval(timer);
          resolve();
        }
      } catch {}
    }, 120);
  });
}

async function readText(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert(response.status === 200, `${pathname} should return HTTP 200, got ${response.status}`);
  return {
    contentType: response.headers.get("content-type") || "",
    body: await response.text(),
  };
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const stderr = [];
const child = spawn(process.execPath, [serverScript], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

child.stderr.on("data", (chunk) => stderr.push(String(chunk)));

try {
  await waitForServer(baseUrl, child, stderr);

  const appPaths = [
    "/",
    "/?page=games",
    "/?path=pages/games/games",
    "/pages/games/games",
    "/pages/orders/orders?scan=NYQ-CHECKIN-DEMO",
  ];

  for (const pathname of appPaths) {
    const { contentType, body } = await readText(baseUrl, pathname);
    assert(contentType.includes("text/html"), `${pathname} should return HTML.`);
    assert(body.includes("/miniapp-bridge.js"), `${pathname} should load miniapp bridge.`);
    assert(body.includes("/sports-app.js"), `${pathname} should load sports app.`);
  }

  const bridge = await readText(baseUrl, "/miniapp-bridge.js");
  assert(bridge.contentType.includes("javascript"), "/miniapp-bridge.js should return JavaScript.");
  assert(bridge.body.includes("window.wx"), "/miniapp-bridge.js should expose wx bridge.");

  const lockCss = await readText(baseUrl, "/mobile-preview-lock.css");
  assert(lockCss.contentType.includes("text/css"), "/mobile-preview-lock.css should return CSS.");
  assert(lockCss.body.includes("Final lock"), "/mobile-preview-lock.css should include final mobile lock.");

  console.log("H5 HTTP preview check passed.");
} finally {
  child.kill();
}
