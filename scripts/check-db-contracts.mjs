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
      errors.push(`${label} is missing DB contract: ${snippet}`);
    }
  }
}

const schema = read("db/schema.sql");
const server = read("scripts/serve-local-mirror.mjs");

const schemaContracts = [
  "CREATE TABLE IF NOT EXISTS `sports_venue`",
  "`manager_user_id` INT UNSIGNED NULL",
  "`open_slots_json` TEXT NULL",
  "`price_per_hour` DECIMAL(10,2) NOT NULL DEFAULT 0",
  "`contact` VARCHAR(80) NOT NULL DEFAULT ''",
  "CREATE TABLE IF NOT EXISTS `sports_game`",
  "`creator_user_id` INT UNSIGNED NULL",
  "`fee_per_person` DECIMAL(10,2) NOT NULL DEFAULT 0",
  "CREATE TABLE IF NOT EXISTS `sports_signup`",
  "`payment_status` VARCHAR(20) NOT NULL DEFAULT 'paid'",
  "`checked_in` TINYINT NOT NULL DEFAULT 0",
  "`no_show` TINYINT NOT NULL DEFAULT 0",
  "UNIQUE KEY `uk_sports_signup_game_user` (`game_id`, `user_id`)",
  "CREATE TABLE IF NOT EXISTS `sports_order`",
  "`checkin_code` VARCHAR(30) NOT NULL",
  "`booking_start_time` DATETIME NULL",
  "`booking_end_time` DATETIME NULL",
  "`paid_at` DATETIME NULL",
  "`cancelled_at` DATETIME NULL",
  "`checked_in_at` DATETIME NULL",
  "CREATE TABLE IF NOT EXISTS `sports_credit_event`",
  "`score_delta` INT NOT NULL DEFAULT 0",
  "`related_game_id` INT UNSIGNED NULL",
  "CREATE TABLE IF NOT EXISTS `sports_notification`",
  "`related_order_id` INT UNSIGNED NULL",
  "`related_game_id` INT UNSIGNED NULL",
  "`status` VARCHAR(20) NOT NULL DEFAULT 'unread'",
  "CREATE TABLE IF NOT EXISTS `sports_player_peer_rating`",
  "UNIQUE KEY `uk_sports_peer_game_rater_target` (`game_id`, `rater_user_id`, `target_user_id`)",
  "CREATE TABLE IF NOT EXISTS `sports_player_rating_summary`",
  "`composite_score` DECIMAL(3,1) NOT NULL DEFAULT 3.0",
  "`level_label` VARCHAR(20) NOT NULL DEFAULT '进阶'"
];

const serverContracts = [
  "CREATE TABLE IF NOT EXISTS sports_venue",
  "manager_user_id INT UNSIGNED NULL",
  "open_slots_json TEXT NULL",
  "CREATE TABLE IF NOT EXISTS sports_game",
  "CREATE TABLE IF NOT EXISTS sports_signup",
  "payment_status VARCHAR(20) NOT NULL DEFAULT 'paid'",
  "no_show TINYINT NOT NULL DEFAULT 0",
  "CREATE TABLE IF NOT EXISTS sports_order",
  "checkin_code VARCHAR(30) NOT NULL",
  "ALTER TABLE sports_order ADD COLUMN booking_start_time DATETIME NULL",
  "ALTER TABLE sports_order ADD COLUMN booking_end_time DATETIME NULL",
  "ALTER TABLE sports_order ADD COLUMN paid_at DATETIME NULL",
  "ALTER TABLE sports_order ADD COLUMN cancelled_at DATETIME NULL",
  "CREATE TABLE IF NOT EXISTS sports_credit_event",
  "CREATE TABLE IF NOT EXISTS sports_notification",
  "CREATE TABLE IF NOT EXISTS sports_player_rating_summary"
];

requireIncludes(schema, "db/schema.sql", schemaContracts);
requireIncludes(server, "scripts/serve-local-mirror.mjs", serverContracts);

if (errors.length > 0) {
  console.error("DB contract check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("DB contract check passed.");
