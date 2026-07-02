import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireIncludes(source, label, snippets) {
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      errors.push(`${label} is missing seed data contract: ${snippet}`);
    }
  }
}

const server = read("scripts/serve-local-mirror.mjs");

requireIncludes(server, "scripts/serve-local-mirror.mjs", [
  "SELECT COUNT(*) AS count FROM sports_venue",
  "INSERT INTO sports_venue",
  "南师附中江宁分校球场",
  "江宁大学城室内篮球馆",
  "未来科技城五人制足球馆",
  "百家湖运动中心",
  "'approved'",
  "'pending'",
  "open_slots_json",
  "周五 18:00-21:00",
  "周六 18:00-22:00",
  "SELECT COUNT(*) AS count FROM sports_game",
  "INSERT INTO sports_game",
  "周六五人制热身局",
  "南师附中校友半场局",
  "周五晚室内 4v4",
  "DATE_ADD(NOW(), INTERVAL 2 DAY)",
  "DATE_ADD(NOW(), INTERVAL 3 DAY)",
  "DATE_ADD(NOW(), INTERVAL 5 DAY)",
  "SELECT COUNT(*) AS count FROM sports_team",
  "南师附中校友足球队",
  "江宁大学城篮球联队",
  "demo_player"
]);

if (errors.length > 0) {
  console.error("Seed data contract check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Seed data contract check passed.");
