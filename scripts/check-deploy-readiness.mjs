import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(file) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing ${file}.`);
    return "";
  }

  return fs.readFileSync(fullPath, "utf8");
}

function requireIncludes(file, snippets) {
  const source = read(file);
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      errors.push(`${file} is missing deployment contract: ${snippet}`);
    }
  }
}

requireIncludes(".gitignore", [
  ".env",
  ".env.server",
]);

requireIncludes(".env.example", [
  "PORT=4174",
  "MYSQL_HOST=127.0.0.1",
  "MYSQL_DATABASE=nyq",
  "OPENAI_MODEL=gpt-5",
]);

requireIncludes(".env.server.example", [
  "NODE_ENV=production",
  "PORT=4174",
  "MYSQL_DATABASE=nyq",
  "MYSQL_USER=nyq",
  "MYSQL_PASSWORD=replace_with_a_strong_app_password",
  "MYSQL_ROOT_PASSWORD=replace_with_a_strong_root_password",
  "WECHAT_APP_ID=replace_with_wechat_mini_program_appid",
  "WECHAT_APP_SECRET=replace_with_wechat_mini_program_appsecret",
  "WECHAT_PAY_MCH_ID=replace_with_merchant_id",
  "PUBLIC_API_BASE_URL=https://api.your-domain.com",
]);

requireIncludes("docker-compose.yml", [
  "MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD",
  "MYSQL_DATABASE: ${MYSQL_DATABASE",
  "MYSQL_USER: ${MYSQL_USER",
  "MYSQL_PASSWORD: ${MYSQL_PASSWORD",
  "PORT: ${PORT",
  "MYSQL_HOST: mysql",
]);

requireIncludes("Dockerfile", [
  "npm ci --omit=dev",
  "EXPOSE 4174",
  "CMD [\"npm\", \"run\", \"mirror\"]",
]);

requireIncludes("docs/server-deploy.md", [
  "cp .env.server.example .env.server",
  "docker compose --env-file .env.server up -d --build",
  "https://api.your-domain.com/api/sports-app/bootstrap",
  "开发管理 -> 开发设置 -> 服务器域名 -> request 合法域名",
  "useMockAuth: false",
]);

requireIncludes("miniprogram/utils/config.js", [
  "apiBaseUrl: \"http://localhost:4174\"",
  "useMockAuth: true",
  "wechatLoginPath",
]);

if (errors.length > 0) {
  console.error("Deployment readiness check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Deployment readiness check passed.");
