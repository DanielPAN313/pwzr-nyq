CREATE TABLE IF NOT EXISTS `user` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1 normal, 0 disabled',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_venue` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `area` VARCHAR(80) NOT NULL,
  `address` VARCHAR(255) NOT NULL,
  `lat` DECIMAL(10, 7) NOT NULL DEFAULT 31.9450000,
  `lng` DECIMAL(10, 7) NOT NULL DEFAULT 118.8400000,
  `sports` VARCHAR(80) NOT NULL DEFAULT 'football,basketball',
  `indoor` TINYINT NOT NULL DEFAULT 1,
  `price_per_hour` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `cover_url` VARCHAR(600) NOT NULL DEFAULT '',
  `photos_json` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `contact` VARCHAR(80) NOT NULL DEFAULT '',
  `manager_user_id` INT UNSIGNED NULL,
  `open_slots_json` TEXT NULL,
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sports_venue_status` (`status`),
  KEY `idx_sports_venue_area` (`area`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_game` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sport` VARCHAR(20) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `venue_id` INT UNSIGNED NOT NULL,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME NOT NULL,
  `capacity` INT UNSIGNED NOT NULL DEFAULT 10,
  `fee_per_person` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `notes` VARCHAR(500) NOT NULL DEFAULT '',
  `creator_user_id` INT UNSIGNED NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'open',
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sports_game_time` (`start_time`),
  KEY `idx_sports_game_venue` (`venue_id`),
  CONSTRAINT `fk_sports_game_venue` FOREIGN KEY (`venue_id`) REFERENCES `sports_venue` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_signup` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `payment_status` VARCHAR(20) NOT NULL DEFAULT 'paid',
  `checked_in` TINYINT NOT NULL DEFAULT 0,
  `no_show` TINYINT NOT NULL DEFAULT 0,
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sports_signup_game_user` (`game_id`, `user_id`),
  KEY `idx_sports_signup_user` (`user_id`),
  CONSTRAINT `fk_sports_signup_game` FOREIGN KEY (`game_id`) REFERENCES `sports_game` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_order` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `venue_id` INT UNSIGNED NOT NULL,
  `game_id` INT UNSIGNED NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'paid',
  `checkin_code` VARCHAR(30) NOT NULL,
  `booking_start_time` DATETIME NULL,
  `booking_end_time` DATETIME NULL,
  `paid_at` DATETIME NULL,
  `cancelled_at` DATETIME NULL,
  `checked_in_at` DATETIME NULL,
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sports_order_venue` (`venue_id`),
  KEY `idx_sports_order_game` (`game_id`),
  KEY `idx_sports_order_user` (`user_id`),
  CONSTRAINT `fk_sports_order_venue` FOREIGN KEY (`venue_id`) REFERENCES `sports_venue` (`id`),
  CONSTRAINT `fk_sports_order_game` FOREIGN KEY (`game_id`) REFERENCES `sports_game` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_credit_event` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `event_type` VARCHAR(30) NOT NULL,
  `score_delta` INT NOT NULL DEFAULT 0,
  `note` VARCHAR(255) NOT NULL DEFAULT '',
  `related_game_id` INT UNSIGNED NULL,
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sports_credit_user` (`user_id`),
  KEY `idx_sports_credit_game` (`related_game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_notification` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `type` VARCHAR(40) NOT NULL DEFAULT 'system',
  `title` VARCHAR(120) NOT NULL,
  `body` VARCHAR(500) NOT NULL DEFAULT '',
  `related_order_id` INT UNSIGNED NULL,
  `related_game_id` INT UNSIGNED NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'unread',
  `read_at` DATETIME NULL,
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sports_notification_user` (`user_id`, `status`, `create_time`),
  KEY `idx_sports_notification_order` (`related_order_id`),
  KEY `idx_sports_notification_game` (`related_game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_analytics_event` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NULL,
  `username` VARCHAR(50) NOT NULL DEFAULT '',
  `event_name` VARCHAR(60) NOT NULL,
  `entity_type` VARCHAR(40) NOT NULL DEFAULT '',
  `entity_id` INT UNSIGNED NULL,
  `metadata_json` TEXT NULL,
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sports_analytics_event_name` (`event_name`, `create_time`),
  KEY `idx_sports_analytics_user` (`user_id`, `create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_player_self_rating` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `technique` TINYINT NOT NULL DEFAULT 3,
  `physical` TINYINT NOT NULL DEFAULT 3,
  `tactics` TINYINT NOT NULL DEFAULT 3,
  `defense` TINYINT NOT NULL DEFAULT 3,
  `attitude` TINYINT NOT NULL DEFAULT 3,
  `average_score` DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  `edit_count_window` INT UNSIGNED NOT NULL DEFAULT 0,
  `window_start` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sports_self_rating_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_player_peer_rating` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_id` INT UNSIGNED NOT NULL,
  `rater_user_id` INT UNSIGNED NOT NULL,
  `rater_username` VARCHAR(50) NOT NULL,
  `target_user_id` INT UNSIGNED NOT NULL,
  `target_username` VARCHAR(50) NOT NULL,
  `technique` TINYINT NOT NULL DEFAULT 3,
  `physical` TINYINT NOT NULL DEFAULT 3,
  `tactics` TINYINT NOT NULL DEFAULT 3,
  `defense` TINYINT NOT NULL DEFAULT 3,
  `attitude` TINYINT NOT NULL DEFAULT 3,
  `average_score` DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  `anonymous` TINYINT NOT NULL DEFAULT 1,
  `status` VARCHAR(20) NOT NULL DEFAULT 'valid',
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sports_peer_game_rater_target` (`game_id`, `rater_user_id`, `target_user_id`),
  KEY `idx_sports_peer_target` (`target_user_id`),
  KEY `idx_sports_peer_game_target` (`game_id`, `target_user_id`),
  CONSTRAINT `fk_sports_peer_game` FOREIGN KEY (`game_id`) REFERENCES `sports_game` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_player_rating_summary` (
  `user_id` INT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `self_score` DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  `peer_score` DECIMAL(3,1) NULL,
  `composite_score` DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  `level_label` VARCHAR(20) NOT NULL DEFAULT '进阶',
  `effective_peer_games` INT UNSIGNED NOT NULL DEFAULT 0,
  `peer_rating_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `technique_self` DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  `physical_self` DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  `tactics_self` DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  `defense_self` DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  `attitude_self` DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  `technique_peer` DECIMAL(3,1) NULL,
  `physical_peer` DECIMAL(3,1) NULL,
  `tactics_peer` DECIMAL(3,1) NULL,
  `defense_peer` DECIMAL(3,1) NULL,
  `attitude_peer` DECIMAL(3,1) NULL,
  `trend_json` TEXT NULL,
  `update_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_team` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) NOT NULL,
  `sport` VARCHAR(20) NOT NULL DEFAULT 'football',
  `area` VARCHAR(80) NOT NULL DEFAULT '江宁',
  `description` VARCHAR(500) NOT NULL DEFAULT '',
  `captain_user_id` INT UNSIGNED NOT NULL,
  `captain_username` VARCHAR(50) NOT NULL,
  `member_limit` INT UNSIGNED NOT NULL DEFAULT 20,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sports_team_area` (`area`),
  KEY `idx_sports_team_captain` (`captain_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_team_member` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `team_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'member',
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sports_team_member` (`team_id`, `user_id`),
  KEY `idx_sports_team_member_user` (`user_id`),
  CONSTRAINT `fk_sports_team_member_team` FOREIGN KEY (`team_id`) REFERENCES `sports_team` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_ai_clip_request` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `game_id` INT UNSIGNED NULL,
  `video_url` VARCHAR(600) NOT NULL DEFAULT '',
  `clip_type` VARCHAR(40) NOT NULL DEFAULT 'goal_detection',
  `status` VARCHAR(20) NOT NULL DEFAULT 'queued',
  `demo_result` VARCHAR(500) NOT NULL DEFAULT '',
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sports_clip_user` (`user_id`),
  KEY `idx_sports_clip_game` (`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sports_data_upload` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `data_type` VARCHAR(40) NOT NULL DEFAULT 'egocentric_video',
  `source` VARCHAR(80) NOT NULL DEFAULT '',
  `consent_scope` VARCHAR(120) NOT NULL DEFAULT 'training_anonymized',
  `note` VARCHAR(500) NOT NULL DEFAULT '',
  `quality_score` INT UNSIGNED NOT NULL DEFAULT 0,
  `reward_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `status` VARCHAR(20) NOT NULL DEFAULT 'submitted',
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sports_data_upload_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
