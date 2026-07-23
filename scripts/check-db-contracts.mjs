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
  "`temporary_closed` TINYINT NOT NULL DEFAULT 0",
  "`price_per_hour` DECIMAL(10,2) NOT NULL DEFAULT 0",
  "`contact` VARCHAR(80) NOT NULL DEFAULT ''",
  "CREATE TABLE IF NOT EXISTS `sports_game`",
  "`creator_user_id` INT UNSIGNED NULL",
  "`fee_per_person` DECIMAL(10,2) NOT NULL DEFAULT 0",
  "`match_type` VARCHAR(20) NOT NULL DEFAULT 'casual'",
  "`format` VARCHAR(20) NOT NULL DEFAULT '5v5'",
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
  "`cancel_note` VARCHAR(255) NOT NULL DEFAULT ''",
  "`cancel_penalty` INT NOT NULL DEFAULT 0",
  "`refund_source` VARCHAR(30) NOT NULL DEFAULT ''",
  "`refund_percent` INT NOT NULL DEFAULT 0",
  "`refund_requested_at` DATETIME NULL",
  "`refunded_at` DATETIME NULL",
  "`checked_in_at` DATETIME NULL",
  "CREATE TABLE IF NOT EXISTS `sports_auth_session`",
  "`token_hash` CHAR(64) NOT NULL",
  "CREATE TABLE IF NOT EXISTS `sports_venue_manager`",
  "CREATE TABLE IF NOT EXISTS `sports_refund_request`",
  "`requested_amount` DECIMAL(10,2) NOT NULL DEFAULT 0",
  "CREATE TABLE IF NOT EXISTS `sports_platform_admin`",
  "CREATE TABLE IF NOT EXISTS `sports_admin_session`",
  "CREATE TABLE IF NOT EXISTS `sports_admin_audit`",
  "CREATE TABLE IF NOT EXISTS `sports_upload_grant`",
  "CREATE TABLE IF NOT EXISTS `sports_credit_event`",
  "CREATE TABLE IF NOT EXISTS `sports_checkin_makeup`",
  "`handled_by` INT UNSIGNED NULL",
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
  "`level_label` VARCHAR(20) NOT NULL DEFAULT '进阶'",
  "CREATE TABLE IF NOT EXISTS `sports_player_profile`",
  "`speed` TINYINT UNSIGNED NOT NULL DEFAULT 50",
  "`preferred_positions_json` TEXT NULL",
  "`last_profile_edit_at` DATETIME NULL",
  "CREATE TABLE IF NOT EXISTS `sports_team`",
  "`home_venue_name` VARCHAR(120) NOT NULL DEFAULT ''",
  "`requires_approval` TINYINT NOT NULL DEFAULT 1",
  "CREATE TABLE IF NOT EXISTS `sports_team_game`",
  "`type` VARCHAR(20) NOT NULL DEFAULT 'training'",
  "CREATE TABLE IF NOT EXISTS `sports_team_game_signup`",
  "UNIQUE KEY `uk_sports_team_game_signup` (`team_game_id`, `user_id`)"
];

const serverContracts = [
  "CREATE TABLE IF NOT EXISTS sports_venue",
  "manager_user_id INT UNSIGNED NULL",
  "open_slots_json TEXT NULL",
  "temporary_closed TINYINT NOT NULL DEFAULT 0",
  "CREATE TABLE IF NOT EXISTS sports_game",
  "match_type VARCHAR(20) NOT NULL DEFAULT 'casual'",
  "format VARCHAR(20) NOT NULL DEFAULT '5v5'",
  "CREATE TABLE IF NOT EXISTS sports_signup",
  "payment_status VARCHAR(20) NOT NULL DEFAULT 'paid'",
  "no_show TINYINT NOT NULL DEFAULT 0",
  "CREATE TABLE IF NOT EXISTS sports_order",
  "CREATE TABLE IF NOT EXISTS sports_auth_session",
  "CREATE TABLE IF NOT EXISTS sports_venue_manager",
  "CREATE TABLE IF NOT EXISTS sports_refund_request",
  "CREATE TABLE IF NOT EXISTS sports_platform_admin",
  "CREATE TABLE IF NOT EXISTS sports_admin_session",
  "CREATE TABLE IF NOT EXISTS sports_admin_audit",
  "CREATE TABLE IF NOT EXISTS sports_upload_grant",
  "checkin_code VARCHAR(30) NOT NULL",
  "ALTER TABLE sports_order ADD COLUMN booking_start_time DATETIME NULL",
  "ALTER TABLE sports_order ADD COLUMN booking_end_time DATETIME NULL",
  "ALTER TABLE sports_order ADD COLUMN paid_at DATETIME NULL",
  "ALTER TABLE sports_order ADD COLUMN cancelled_at DATETIME NULL",
  "ALTER TABLE sports_order ADD COLUMN cancel_note VARCHAR(255) NOT NULL DEFAULT \"\"",
  "ALTER TABLE sports_order ADD COLUMN cancel_penalty INT NOT NULL DEFAULT 0",
  "ALTER TABLE sports_order ADD COLUMN refund_source VARCHAR(30) NOT NULL DEFAULT \"\"",
  "ALTER TABLE sports_order ADD COLUMN refund_percent INT NOT NULL DEFAULT 0",
  "ALTER TABLE sports_order ADD COLUMN refund_requested_at DATETIME NULL",
  "ALTER TABLE sports_order ADD COLUMN refunded_at DATETIME NULL",
  "CREATE TABLE IF NOT EXISTS sports_credit_event",
  "CREATE TABLE IF NOT EXISTS sports_checkin_makeup",
  "/api/sports-app/venue-admin/checkin-code/lookup",
  "/api/sports-app/venue-admin/checkin-makeups",
  "requestMakeupMatch",
  "venue_cancel_mock",
  "team-balance",
  "autoProcessMockRefunds",
  "requestRefundMatch",
  "venueRefundMatch",
  "authenticateSportsRequest",
  "venueScopeSql",
  "ensureRefundRequest",
  "/api/admin/v1/auth/login",
  "/api/admin/v1/refunds",
  "/api/admin/v1/uploads/sign",
  "recordAdminAudit",
  "paymentQueryMatch",
  "mock_auto_48h",
  "status = \"pending_verify\"",
  "status = \"verified\"",
  "CREATE TABLE IF NOT EXISTS sports_notification",
  "CREATE TABLE IF NOT EXISTS sports_player_rating_summary",
  "CREATE TABLE IF NOT EXISTS sports_player_profile",
  "const playerProfileReviews",
  "/api/sports-app/player-profile/reviews",
  "event_type: 'peer_complaint'",
  "score_delta: -5",
  "const CREDIT_PUBLIC_JOIN_MIN = 60",
  "const CREDIT_ACTION_MIN = 80",
  "const CREDIT_NO_SHOW_PENALTY = -15",
  "const recordCreditEvent",
  "const recordCheckinCredit",
  "syncAutomaticAttendanceForUser",
  "syncMissedReviewsForUser",
  "LEAST(100, GREATEST(0",
  "first_edit_at IS NOT NULL",
  "CREATE TABLE IF NOT EXISTS sports_team",
  "ALTER TABLE sports_team ADD COLUMN home_venue_name VARCHAR(120) NOT NULL DEFAULT ''",
  "ALTER TABLE sports_team ADD COLUMN requires_approval TINYINT NOT NULL DEFAULT 1",
  "CREATE TABLE IF NOT EXISTS sports_team_game",
  "CREATE TABLE IF NOT EXISTS sports_team_game_signup",
  "const teamDetailForUser",
  "const teamGamesForUser",
  "team_join_requested",
  "team_game_created",
  "team_game_joined"
];

requireIncludes(schema, "db/schema.sql", schemaContracts);
requireIncludes(server, "scripts/serve-local-mirror.mjs", serverContracts);

for (const forbidden of ["CREDIT_RECOVERY_PER_WEEK", "信用分自动恢复", "信用分 -20", "event_type: 'peer_praise'"]) {
  if (server.includes(forbidden)) errors.push(`scripts/serve-local-mirror.mjs must not retain forbidden credit behavior: ${forbidden}`);
}

if (errors.length > 0) {
  console.error("DB contract check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("DB contract check passed.");
