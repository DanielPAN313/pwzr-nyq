import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', 'site')
const modulePartsRoot = path.resolve(__dirname, '..', 'modules')
const modulesRoot = path.resolve(__dirname, '..', 'modules', 'web')
const dataDir = path.resolve(__dirname, '..', 'data')
const localEnvFile = path.resolve(__dirname, '..', '.env')
const vibeResearchRoot = '/gpfs/users/liujinxiu/research/viberesearch'
const globalEnvFile = '/gpfs/users/liujinxiu/.env'
const agentsFile = path.join(dataDir, 'uploaded-agents.json')
const moduleAgentsFile = path.join(dataDir, 'module-agent-launch-agents.json')
const moduleSkillDir = path.join(dataDir, 'agent-skills')
const avatarProfilesFile = path.join(dataDir, 'module-avatar-profiles.json')
const socialConversationsFile = path.join(dataDir, 'module-social-conversations.json')
const port = Number(process.env.PORT || 4174)

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Username',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
}

const json = (res, body, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders })
  res.end(JSON.stringify(body))
  return true
}

const readJsonBody = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '').trim()
  return raw ? JSON.parse(raw) : {}
}

const text = (value, max = 500) => String(value || '').trim().slice(0, max)

let dbPoolPromise = null

const readRuntimeEnv = async () => ({
  ...await readDotEnv(globalEnvFile),
  ...await readDotEnv(localEnvFile),
  ...process.env,
})

const getDbPool = async () => {
  if (dbPoolPromise) return dbPoolPromise
  dbPoolPromise = (async () => {
    const env = await readRuntimeEnv()
    const database = env.MYSQL_DATABASE || env.DB_NAME
    const user = env.MYSQL_USER || env.DB_USER
    if (!database || !user) {
      throw new Error('MySQL is not configured. Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE in .env.')
    }
    const pool = mysql.createPool({
      host: env.MYSQL_HOST || env.DB_HOST || '127.0.0.1',
      port: Number(env.MYSQL_PORT || env.DB_PORT || 3306),
      user,
      password: env.MYSQL_PASSWORD || env.DB_PASSWORD || '',
      database,
      waitForConnections: true,
      connectionLimit: Number(env.MYSQL_CONNECTION_LIMIT || 10),
      namedPlaceholders: true,
    })
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS \`user\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`username\` VARCHAR(50) NOT NULL,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`create_time\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`status\` TINYINT NOT NULL DEFAULT 1 COMMENT '1 normal, 0 disabled',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_user_username\` (\`username\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    return pool
  })()
  return dbPoolPromise
}

const makeAuthToken = (user) => `db_user_${user.id}_${crypto.randomUUID()}`

const publicAuthUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.username,
  email: user.username,
  role: 'player',
  token: makeAuthToken(user),
})

const publicSportsAuthUser = (user) => ({
  id: Number(user.id),
  username: user.username,
  nickName: user.username,
  avatarUrl: '',
  creditScore: 100,
})

const stableDevWechatOpenid = (code = '') => {
  const seed = code ? String(code) : 'local-dev'
  return `dev_${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 12)}`
}

const resolveWechatOpenid = async (code) => {
  const appId = process.env.WECHAT_APP_ID || process.env.WX_APP_ID
  const appSecret = process.env.WECHAT_APP_SECRET || process.env.WX_APP_SECRET

  if (!appId || !appSecret) {
    return stableDevWechatOpenid(code)
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', appId)
  url.searchParams.set('secret', appSecret)
  url.searchParams.set('js_code', code)
  url.searchParams.set('grant_type', 'authorization_code')

  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok || data.errcode || !data.openid) {
    const message = data.errmsg || `wechat session failed: ${response.status}`
    const error = new Error(message)
    error.statusCode = 401
    throw error
  }

  return data.openid
}

const ensureWechatUser = async (pool, openid) => {
  const username = text(`wx_${openid}`, 50)
  const [[existing]] = await pool.execute('SELECT id, username FROM `user` WHERE username = ? LIMIT 1', [username])
  if (existing) return existing

  const passwordHash = `wechat:${crypto.randomUUID()}`
  const [result] = await pool.execute(
    'INSERT INTO `user` (username, password_hash, status) VALUES (?, ?, 1)',
    [username, passwordHash],
  )

  return { id: result.insertId, username }
}

let sportsSchemaPromise = null

const CREDIT_PUBLIC_JOIN_MIN = 80
const CREDIT_ACTION_MIN = 60
const CREDIT_RECOVERY_TARGET = 60
const CREDIT_RECOVERY_PER_WEEK = 5
const CREDIT_LATE_CANCEL_24H = -5
const CREDIT_LATE_CANCEL_1H = -20
const CREDIT_NO_SHOW_PENALTY = -20
const CREDIT_EVENT_WINDOW = 7 * 24 * 60 * 60 * 1000
const ratingDimensions = ['technique', 'physical', 'tactics', 'defense', 'attitude']
const ratingPresets = {
  beginner: 1,
  casual: 2,
  advanced: 3,
  expert: 4,
  master: 5,
}

const clampRating = (value) => Math.max(1, Math.min(5, Number(value || 1)))

const normalizeRatingBody = (body) => {
  const presetScore = ratingPresets[text(body.preset, 20)] || null
  const rating = {}
  for (const key of ratingDimensions) {
    rating[key] = clampRating(body[key] ?? presetScore ?? 3)
  }
  return rating
}

const averageRating = (rating) => {
  const total = ratingDimensions.reduce((sum, key) => sum + clampRating(rating[key]), 0)
  return Math.round((total / ratingDimensions.length) * 10) / 10
}

const ratingLabel = (score) => {
  const value = Number(score || 0)
  if (value >= 4.6) return '大神'
  if (value >= 4.0) return '高手'
  if (value >= 3.0) return '进阶'
  if (value >= 2.0) return '业余'
  return '入门'
}

const ensureSportsSchema = async () => {
  if (sportsSchemaPromise) return sportsSchemaPromise
  sportsSchemaPromise = (async () => {
    const pool = await getDbPool()
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_venue (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        area VARCHAR(80) NOT NULL,
        address VARCHAR(255) NOT NULL,
        lat DECIMAL(10, 7) NOT NULL DEFAULT 31.9450000,
        lng DECIMAL(10, 7) NOT NULL DEFAULT 118.8400000,
        sports VARCHAR(80) NOT NULL DEFAULT 'football,basketball',
        indoor TINYINT NOT NULL DEFAULT 1,
        price_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0,
        cover_url VARCHAR(600) NOT NULL DEFAULT '',
        photos_json TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        contact VARCHAR(80) NOT NULL DEFAULT '',
        manager_user_id INT UNSIGNED NULL,
        open_slots_json TEXT NULL,
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sports_venue_status (status),
        KEY idx_sports_venue_area (area)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_game (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        sport VARCHAR(20) NOT NULL,
        title VARCHAR(120) NOT NULL,
        venue_id INT UNSIGNED NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        capacity INT UNSIGNED NOT NULL DEFAULT 10,
        fee_per_person DECIMAL(10,2) NOT NULL DEFAULT 0,
        notes VARCHAR(500) NOT NULL DEFAULT '',
        creator_user_id INT UNSIGNED NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sports_game_time (start_time),
        KEY idx_sports_game_venue (venue_id),
        CONSTRAINT fk_sports_game_venue FOREIGN KEY (venue_id) REFERENCES sports_venue(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_signup (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        game_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        username VARCHAR(50) NOT NULL,
        paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        payment_status VARCHAR(20) NOT NULL DEFAULT 'paid',
        checked_in TINYINT NOT NULL DEFAULT 0,
        no_show TINYINT NOT NULL DEFAULT 0,
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_sports_signup_game_user (game_id, user_id),
        KEY idx_sports_signup_user (user_id),
        CONSTRAINT fk_sports_signup_game FOREIGN KEY (game_id) REFERENCES sports_game(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_order (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        venue_id INT UNSIGNED NOT NULL,
        game_id INT UNSIGNED NULL,
        user_id INT UNSIGNED NOT NULL,
        username VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'paid',
        checkin_code VARCHAR(30) NOT NULL,
        booking_start_time DATETIME NULL,
        booking_end_time DATETIME NULL,
        checked_in_at DATETIME NULL,
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sports_order_venue (venue_id),
        KEY idx_sports_order_game (game_id),
        KEY idx_sports_order_user (user_id),
        CONSTRAINT fk_sports_order_venue FOREIGN KEY (venue_id) REFERENCES sports_venue(id),
        CONSTRAINT fk_sports_order_game FOREIGN KEY (game_id) REFERENCES sports_game(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_credit_event (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        username VARCHAR(50) NOT NULL,
        event_type VARCHAR(30) NOT NULL,
        score_delta INT NOT NULL DEFAULT 0,
        note VARCHAR(255) NOT NULL DEFAULT '',
        related_game_id INT UNSIGNED NULL,
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sports_credit_user (user_id),
        KEY idx_sports_credit_game (related_game_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_notification (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        username VARCHAR(50) NOT NULL,
        type VARCHAR(40) NOT NULL DEFAULT 'system',
        title VARCHAR(120) NOT NULL,
        body VARCHAR(500) NOT NULL DEFAULT '',
        related_order_id INT UNSIGNED NULL,
        related_game_id INT UNSIGNED NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'unread',
        read_at DATETIME NULL,
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sports_notification_user (user_id, status, create_time),
        KEY idx_sports_notification_order (related_order_id),
        KEY idx_sports_notification_game (related_game_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_analytics_event (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NULL,
        username VARCHAR(50) NOT NULL DEFAULT '',
        event_name VARCHAR(60) NOT NULL,
        entity_type VARCHAR(40) NOT NULL DEFAULT '',
        entity_id INT UNSIGNED NULL,
        metadata_json TEXT NULL,
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sports_analytics_event_name (event_name, create_time),
        KEY idx_sports_analytics_user (user_id, create_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute('ALTER TABLE sports_order ADD COLUMN booking_start_time DATETIME NULL').catch((error) => {
      if (error?.code !== 'ER_DUP_FIELDNAME') throw error
    })
    await pool.execute('ALTER TABLE sports_order ADD COLUMN booking_end_time DATETIME NULL').catch((error) => {
      if (error?.code !== 'ER_DUP_FIELDNAME') throw error
    })
    await pool.execute('ALTER TABLE sports_order ADD COLUMN paid_at DATETIME NULL').catch((error) => {
      if (error?.code !== 'ER_DUP_FIELDNAME') throw error
    })
    await pool.execute('ALTER TABLE sports_order ADD COLUMN cancelled_at DATETIME NULL').catch((error) => {
      if (error?.code !== 'ER_DUP_FIELDNAME') throw error
    })
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_player_self_rating (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        username VARCHAR(50) NOT NULL,
        technique TINYINT NOT NULL DEFAULT 3,
        physical TINYINT NOT NULL DEFAULT 3,
        tactics TINYINT NOT NULL DEFAULT 3,
        defense TINYINT NOT NULL DEFAULT 3,
        attitude TINYINT NOT NULL DEFAULT 3,
        average_score DECIMAL(3,1) NOT NULL DEFAULT 3.0,
        edit_count_window INT UNSIGNED NOT NULL DEFAULT 0,
        window_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_sports_self_rating_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_player_peer_rating (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        game_id INT UNSIGNED NOT NULL,
        rater_user_id INT UNSIGNED NOT NULL,
        rater_username VARCHAR(50) NOT NULL,
        target_user_id INT UNSIGNED NOT NULL,
        target_username VARCHAR(50) NOT NULL,
        technique TINYINT NOT NULL DEFAULT 3,
        physical TINYINT NOT NULL DEFAULT 3,
        tactics TINYINT NOT NULL DEFAULT 3,
        defense TINYINT NOT NULL DEFAULT 3,
        attitude TINYINT NOT NULL DEFAULT 3,
        average_score DECIMAL(3,1) NOT NULL DEFAULT 3.0,
        anonymous TINYINT NOT NULL DEFAULT 1,
        status VARCHAR(20) NOT NULL DEFAULT 'valid',
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_sports_peer_game_rater_target (game_id, rater_user_id, target_user_id),
        KEY idx_sports_peer_target (target_user_id),
        KEY idx_sports_peer_game_target (game_id, target_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_player_rating_summary (
        user_id INT UNSIGNED NOT NULL,
        username VARCHAR(50) NOT NULL,
        self_score DECIMAL(3,1) NOT NULL DEFAULT 3.0,
        peer_score DECIMAL(3,1) NULL,
        composite_score DECIMAL(3,1) NOT NULL DEFAULT 3.0,
        level_label VARCHAR(20) NOT NULL DEFAULT '进阶',
        effective_peer_games INT UNSIGNED NOT NULL DEFAULT 0,
        peer_rating_count INT UNSIGNED NOT NULL DEFAULT 0,
        technique_self DECIMAL(3,1) NOT NULL DEFAULT 3.0,
        physical_self DECIMAL(3,1) NOT NULL DEFAULT 3.0,
        tactics_self DECIMAL(3,1) NOT NULL DEFAULT 3.0,
        defense_self DECIMAL(3,1) NOT NULL DEFAULT 3.0,
        attitude_self DECIMAL(3,1) NOT NULL DEFAULT 3.0,
        technique_peer DECIMAL(3,1) NULL,
        physical_peer DECIMAL(3,1) NULL,
        tactics_peer DECIMAL(3,1) NULL,
        defense_peer DECIMAL(3,1) NULL,
        attitude_peer DECIMAL(3,1) NULL,
        trend_json TEXT NULL,
        update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_team (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(80) NOT NULL,
        sport VARCHAR(20) NOT NULL DEFAULT 'football',
        area VARCHAR(80) NOT NULL DEFAULT '江宁',
        description VARCHAR(500) NOT NULL DEFAULT '',
        captain_user_id INT UNSIGNED NOT NULL,
        captain_username VARCHAR(50) NOT NULL,
        member_limit INT UNSIGNED NOT NULL DEFAULT 20,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sports_team_area (area),
        KEY idx_sports_team_captain (captain_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_team_member (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        team_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        username VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_sports_team_member (team_id, user_id),
        KEY idx_sports_team_member_user (user_id),
        CONSTRAINT fk_sports_team_member_team FOREIGN KEY (team_id) REFERENCES sports_team(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_ai_clip_request (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        username VARCHAR(50) NOT NULL,
        game_id INT UNSIGNED NULL,
        video_url VARCHAR(600) NOT NULL DEFAULT '',
        clip_type VARCHAR(40) NOT NULL DEFAULT 'goal_detection',
        status VARCHAR(20) NOT NULL DEFAULT 'queued',
        demo_result VARCHAR(500) NOT NULL DEFAULT '',
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sports_clip_user (user_id),
        KEY idx_sports_clip_game (game_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sports_data_upload (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        username VARCHAR(50) NOT NULL,
        data_type VARCHAR(40) NOT NULL DEFAULT 'egocentric_video',
        source VARCHAR(80) NOT NULL DEFAULT '',
        consent_scope VARCHAR(120) NOT NULL DEFAULT 'training_anonymized',
        note VARCHAR(500) NOT NULL DEFAULT '',
        quality_score INT UNSIGNED NOT NULL DEFAULT 0,
        reward_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        status VARCHAR(20) NOT NULL DEFAULT 'submitted',
        create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sports_data_upload_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    const [venueRows] = await pool.execute('SELECT COUNT(*) AS count FROM sports_venue')
    if (Number(venueRows[0]?.count || 0) === 0) {
      const venues = [
        ['南师附中江宁分校球场', '南师附中江宁分校', '南京市江宁区吉印大道1999号', 31.8745600, 118.8282300, 'football,basketball', 0, 220, 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80', '["周五 18:00-21:00","周六 09:00-12:00","周日 15:00-18:00"]', 'approved', '校队 / 王老师'],
        ['江宁大学城室内篮球馆', '江宁大学城', '南京市江宁区弘景大道大学城片区', 31.9159200, 118.9023500, 'basketball', 1, 180, 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80', '["周一至周五 19:00-22:00","周六 10:00-22:00"]', 'approved', '李经理'],
        ['未来科技城五人制足球馆', '江宁开发区', '南京市江宁区秣周东路12号', 31.8469200, 118.7832100, 'football', 1, 260, 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80', '["周三 20:00-22:00","周六 18:00-22:00","周日 09:00-12:00"]', 'approved', '赵经理'],
        ['百家湖运动中心', '百家湖', '南京市江宁区双龙大道1688号', 31.9296500, 118.8212400, 'football,basketball', 1, 200, 'https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1200&q=80', '["工作日 18:00-22:00","周末 08:00-22:00"]', 'pending', '待审核'],
      ]
      for (const venue of venues) {
        await pool.execute(
          'INSERT INTO sports_venue (name, area, address, lat, lng, sports, indoor, price_per_hour, cover_url, open_slots_json, status, contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          venue,
        )
      }
    }

    const [gameRows] = await pool.execute('SELECT COUNT(*) AS count FROM sports_game')
    if (Number(gameRows[0]?.count || 0) === 0) {
      await pool.execute(`
        INSERT INTO sports_game (sport, title, venue_id, start_time, end_time, capacity, fee_per_person, notes, status)
        SELECT 'football', '周六五人制热身局', id, DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 2 DAY), INTERVAL 2 HOUR), 10, 36, '江宁大学城社团优先，缺前锋和门将。', 'open'
        FROM sports_venue WHERE name = '未来科技城五人制足球馆' LIMIT 1
      `)
      await pool.execute(`
        INSERT INTO sports_game (sport, title, venue_id, start_time, end_time, capacity, fee_per_person, notes, status)
        SELECT 'basketball', '南师附中校友半场局', id, DATE_ADD(NOW(), INTERVAL 3 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 3 DAY), INTERVAL 90 MINUTE), 12, 25, '强度中等，先付后打，迟到请提前说。', 'open'
        FROM sports_venue WHERE name = '南师附中江宁分校球场' LIMIT 1
      `)
      await pool.execute(`
        INSERT INTO sports_game (sport, title, venue_id, start_time, end_time, capacity, fee_per_person, notes, status)
        SELECT 'basketball', '周五晚室内 4v4', id, DATE_ADD(NOW(), INTERVAL 5 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 5 DAY), INTERVAL 2 HOUR), 8, 32, '室内空调，AA 包场。', 'open'
        FROM sports_venue WHERE name = '江宁大学城室内篮球馆' LIMIT 1
      `)
    }
    const [teamRows] = await pool.execute('SELECT COUNT(*) AS count FROM sports_team')
    if (Number(teamRows[0]?.count || 0) === 0) {
      const teams = [
        ['南师附中校友足球队', 'football', '南师附中江宁分校', '每周固定训练，优先招中后场和门将。', 1, 'demo_player', 18],
        ['江宁大学城篮球联队', 'basketball', '江宁大学城', '高校社团混合队，周五晚室内 4v4。', 1, 'demo_player', 16],
      ]
      for (const team of teams) {
        const [result] = await pool.execute(
          'INSERT INTO sports_team (name, sport, area, description, captain_user_id, captain_username, member_limit) VALUES (?, ?, ?, ?, ?, ?, ?)',
          team,
        )
        await pool.execute(
          'INSERT IGNORE INTO sports_team_member (team_id, user_id, username, role) VALUES (?, ?, ?, "captain")',
          [result.insertId, team[4], team[5]],
        )
      }
    }
    return pool
  })()
  return sportsSchemaPromise
}

const parseJsonList = (value) => {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const pad2 = (value) => String(value).padStart(2, '0')

const formatDateOnly = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

const formatTimeOnly = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

const combineDateTime = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null
  const directValue = String(timeValue).trim().replace(' ', 'T')
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(directValue)) {
    const directDate = new Date(directValue)
    return Number.isNaN(directDate.getTime()) ? null : directDate
  }
  const [year, month, day] = String(dateValue).split('-').map((item) => Number(item))
  const timeMatch = String(timeValue).match(/(\d{1,2}):(\d{2})/)
  const hour = timeMatch ? Number(timeMatch[1]) : NaN
  const minute = timeMatch ? Number(timeMatch[2]) : NaN
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

const overlapsRange = (startA, endA, startB, endB) => {
  const aStart = new Date(startA).getTime()
  const aEnd = new Date(endA).getTime()
  const bStart = new Date(startB).getTime()
  const bEnd = new Date(endB).getTime()
  if ([aStart, aEnd, bStart, bEnd].some((value) => Number.isNaN(value))) return false
  return aStart < bEnd && aEnd > bStart
}

const bookingRangeLabel = (start, end) => `${formatTimeOnly(start)}-${formatTimeOnly(end)}`

const requestUser = (req) => ({
  id: Number(req.headers['x-user-id'] || 1) || 1,
  username: text(req.headers['x-username'] || 'demo_player', 50) || 'demo_player',
})

const resolveUserMeta = (userOrId, username = '') => {
  if (typeof userOrId === 'object' && userOrId) {
    return {
      id: Number(userOrId.id),
      username: text(userOrId.username || username, 50),
    }
  }
  return {
    id: Number(userOrId),
    username: text(username, 50),
  }
}

const creditTotalForUser = async (pool, userId) => {
  const [[row]] = await pool.execute(
    'SELECT COALESCE(SUM(score_delta), 0) AS score, MAX(create_time) AS last_event_at FROM sports_credit_event WHERE user_id = ?',
    [userId],
  )
  return {
    score: 100 + Number(row?.score || 0),
    lastEventAt: row?.last_event_at ? new Date(row.last_event_at) : null,
  }
}

const syncOverdueNoShowsForUser = async (pool, userId, username = '') => {
  const [rows] = await pool.execute(
    `SELECT s.game_id, s.user_id, s.username, g.title, g.start_time
     FROM sports_signup s
     JOIN sports_game g ON g.id = s.game_id
     WHERE s.user_id = ?
       AND s.payment_status = 'paid'
       AND s.checked_in = 0
       AND s.no_show = 0
       AND DATE_ADD(g.start_time, INTERVAL 1 HOUR) <= NOW()
     ORDER BY g.start_time ASC`,
    [userId],
  )
  for (const row of rows) {
    const [result] = await pool.execute(
      'UPDATE sports_signup SET no_show = 1 WHERE game_id = ? AND user_id = ? AND no_show = 0',
      [row.game_id, row.user_id],
    )
    if (Number(result.affectedRows || 0) > 0) {
      await pool.execute(
        'INSERT INTO sports_credit_event (user_id, username, event_type, score_delta, note, related_game_id) VALUES (?, ?, "no_show", ?, "无故缺席，信用分 -20", ?)',
        [row.user_id, row.username || username || '', CREDIT_NO_SHOW_PENALTY, row.game_id],
      )
    }
  }
}

const refreshCreditState = async (pool, userOrId, username = '') => {
  const user = resolveUserMeta(userOrId, username)
  if (!user.id) return 100
  await syncOverdueNoShowsForUser(pool, user.id, user.username)
  const total = await creditTotalForUser(pool, user.id)
  let score = Number(total.score || 100)
  const lastEventAt = total.lastEventAt
  if (score < CREDIT_RECOVERY_TARGET && lastEventAt) {
    const weeks = Math.floor((Date.now() - lastEventAt.getTime()) / CREDIT_EVENT_WINDOW)
    const recovery = Math.min(CREDIT_RECOVERY_TARGET - score, weeks * CREDIT_RECOVERY_PER_WEEK)
    if (recovery > 0) {
      await pool.execute(
        'INSERT INTO sports_credit_event (user_id, username, event_type, score_delta, note) VALUES (?, ?, "auto_recovery", ?, ?)',
        [user.id, user.username, recovery, `信用分自动恢复 +${recovery}`],
      )
      score += recovery
    }
  }
  return score
}

const userCreditScore = async (pool, userOrId, username = '') => refreshCreditState(pool, userOrId, username)

const requireCreditAtLeast = async (pool, user, minimum, actionLabel) => {
  const credit = await userCreditScore(pool, user)
  if (credit < minimum) {
    const error = new Error(`信用分 ${credit} 低于 ${minimum}，暂不能${actionLabel}。`)
    error.statusCode = 403
    throw error
  }
  return credit
}

const requirePublicJoinCredit = async (pool, user) => requireCreditAtLeast(pool, user, CREDIT_PUBLIC_JOIN_MIN, '参与公开局')

const requireAllActionCredit = async (pool, user, actionLabel = '发局、订场或创建球局') => requireCreditAtLeast(pool, user, CREDIT_ACTION_MIN, actionLabel)

const gameLifecycleStatus = (game, joinedCount = 0, paidCount = 0, checkedInCount = 0) => {
  if (game.status === 'cancelled') return 'cancelled'
  const now = Date.now()
  const startAt = new Date(game.start_time).getTime()
  const endAt = new Date(game.end_time).getTime()
  if (!Number.isNaN(endAt) && now > endAt + 24 * 60 * 60 * 1000) return 'completed'
  if (!Number.isNaN(endAt) && now >= endAt) return 'review_open'
  if (!Number.isNaN(startAt) && now >= startAt - 30 * 60 * 1000) return checkedInCount > 0 ? 'checked_in' : 'pending_checkin'
  if (Number(paidCount || joinedCount) >= Number(game.capacity || 0)) return 'locked'
  if (Number(joinedCount) === 0) return 'forming'
  return 'open'
}

const serializeVenue = (venue) => ({
  ...venue,
  lat: Number(venue.lat),
  lng: Number(venue.lng),
  indoor: Boolean(venue.indoor),
  price_per_hour: Number(venue.price_per_hour),
  sports: String(venue.sports || '').split(',').filter(Boolean),
  open_slots: parseJsonList(venue.open_slots_json),
  open_slot_ranges: parseJsonList(venue.open_slots_json).map((item) => {
    const value = String(item || '')
    const match = value.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
    return {
      label: value,
      start: match ? `${pad2(match[1])}:${match[2]}` : '',
      end: match ? `${pad2(match[3])}:${match[4]}` : '',
    }
  }),
  photos: parseJsonList(venue.photos_json),
})

const serializeGame = (game) => {
  const joinedCount = Number(game.joined_count || 0)
  const paidCount = Number(game.paid_count || 0)
  const checkedInCount = Number(game.checked_in_count || 0)
  return {
    ...game,
    status: gameLifecycleStatus(game, joinedCount, paidCount, checkedInCount),
    raw_status: game.status,
    capacity: Number(game.capacity),
    fee_per_person: Number(game.fee_per_person),
    joined_count: joinedCount,
    paid_count: paidCount,
    checked_in_count: checkedInCount,
    average_rating: game.average_rating == null ? null : Number(game.average_rating),
    players: parseJsonList(game.players_json)
      .filter(Boolean)
      .map((player) => ({
        ...player,
        composite_score: Number(player.composite_score || 3),
      })),
    is_joined: Boolean(game.is_joined),
  }
}

const serializeOrder = (order) => {
  const checkinWindow = orderCheckinWindow(order)
  return {
    ...order,
    amount: Number(order.amount || 0),
    can_pay: order.status === 'pending_payment',
    can_checkin: checkinWindow.ok,
    checkin_hint: checkinWindow.reason,
  }
}

const createNotification = async (pool, user, payload) => {
  if (!user?.id) return
  await pool.execute(
    `INSERT INTO sports_notification
      (user_id, username, type, title, body, related_order_id, related_game_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.username || '',
      text(payload.type, 40) || 'system',
      text(payload.title, 120),
      text(payload.body, 500),
      payload.order_id ? Number(payload.order_id) : null,
      payload.game_id ? Number(payload.game_id) : null,
    ],
  )
}

const sportsNotificationsForUser = async (pool, user) => {
  const [rows] = await pool.execute(
    `SELECT *
     FROM sports_notification
     WHERE user_id = ?
     ORDER BY create_time DESC
     LIMIT 80`,
    [user.id],
  )
  return rows
}

const orderPlayableStart = (order) => order.start_time || order.booking_start_time || order.create_time
const orderPlayableEnd = (order) => order.end_time || order.booking_end_time || order.start_time || order.booking_start_time || order.create_time
const orderCheckinWindow = (order, now = Date.now()) => {
  if (order.status !== 'paid') return { ok: false, reason: '订单未支付' }
  const startAt = new Date(orderPlayableStart(order)).getTime()
  const endAtRaw = new Date(orderPlayableEnd(order)).getTime()
  if (Number.isNaN(startAt)) return { ok: true, reason: '可核销' }
  const endAt = Number.isNaN(endAtRaw) || endAtRaw < startAt ? startAt : endAtRaw
  if (now < startAt - 30 * 60 * 1000) return { ok: false, reason: '未到核销时间' }
  if (now > endAt + 60 * 60 * 1000) return { ok: false, reason: '核销已超时' }
  return { ok: true, reason: '可核销' }
}

const canCancelOrder = (order) => {
  if (order.status === 'pending_payment') {
    return { ok: true, nextStatus: 'cancelled', penalty: 0, note: '未支付订单可直接取消' }
  }
  if (order.status !== 'paid') return { ok: false, error: '订单当前状态不能取消' }
  const startAt = new Date(orderPlayableStart(order)).getTime()
  if (Number.isNaN(startAt)) {
    return { ok: true, nextStatus: 'refunded', penalty: 0, note: '订单已取消' }
  }
  const diff = startAt - Date.now()
  if (diff <= 60 * 60 * 1000) {
    return { ok: true, nextStatus: 'refunded', penalty: CREDIT_LATE_CANCEL_1H, note: '开场/预订前 1 小时内取消，信用分 -20' }
  }
  if (diff <= 24 * 60 * 60 * 1000) {
    return { ok: true, nextStatus: 'refunded', penalty: CREDIT_LATE_CANCEL_24H, note: '开局/预订前 24 小时内取消，信用分 -5' }
  }
  return { ok: true, nextStatus: 'refunded', penalty: 0, note: '订单已取消' }
}

const createMockPrepay = (order) => ({
  ok: true,
  provider: 'mock',
  order_id: Number(order.id),
  amount: Number(order.amount || 0),
  out_trade_no: `NYQ${order.id}-${Date.now()}`,
  pay_params: {
    timeStamp: String(Math.floor(Date.now() / 1000)),
    nonceStr: crypto.randomUUID().replaceAll('-', ''),
    package: `prepay_id=mock_${order.id}`,
    signType: 'RSA',
    paySign: 'mock-signature',
  },
})

const markSportsOrderPaid = async (pool, user, order, source = 'mock') => {
  if (!order) {
    const error = new Error('order not found')
    error.statusCode = 404
    throw error
  }
  if (Number(order.user_id) !== Number(user.id)) {
    const error = new Error('只能支付自己的订单')
    error.statusCode = 403
    throw error
  }
  if (order.status !== 'pending_payment') {
    const error = new Error('订单当前状态不能支付')
    error.statusCode = 409
    throw error
  }
  if (order.game_id) {
    await requirePublicJoinCredit(pool, user)
  } else {
    await requireAllActionCredit(pool, user, '订场支付')
  }
  if (order.game_id) {
    const [[game]] = await pool.execute(
      `SELECT g.*, SUM(CASE WHEN s.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count
       FROM sports_game g
       LEFT JOIN sports_signup s ON s.game_id = g.id
       WHERE g.id = ?
       GROUP BY g.id
       LIMIT 1`,
      [order.game_id],
    )
    if (!game || game.status === 'cancelled') {
      const error = new Error('球局已取消')
      error.statusCode = 409
      throw error
    }
    if (Number(game.paid_count || 0) >= Number(game.capacity || 0)) {
      const error = new Error('球局已满员，支付失败')
      error.statusCode = 409
      throw error
    }
    await pool.execute(
      `INSERT INTO sports_signup (game_id, user_id, username, paid_amount, payment_status)
       VALUES (?, ?, ?, ?, 'paid')
       ON DUPLICATE KEY UPDATE paid_amount = VALUES(paid_amount), payment_status = 'paid'`,
      [order.game_id, order.user_id, order.username, Number(order.amount || 0)],
    )
    await pool.execute(
      'INSERT INTO sports_credit_event (user_id, username, event_type, score_delta, note, related_game_id) VALUES (?, ?, "paid_signup", 0, "报名并完成支付", ?)',
      [order.user_id, order.username, order.game_id],
    )
  }
  await pool.execute('UPDATE sports_order SET status = "paid", paid_at = NOW() WHERE id = ?', [order.id])
  await trackEvent(pool, user, 'payment_success', {
    entity_type: order.game_id ? 'game' : 'venue',
    entity_id: order.game_id || order.venue_id,
    metadata: { order_id: order.id, amount: Number(order.amount || 0), source },
  })
  await createNotification(pool, user, {
    type: 'payment_success',
    title: '支付成功',
    body: `订单 #${order.id} 已支付成功，请到场后使用核销码 ${order.checkin_code}。`,
    order_id: order.id,
    game_id: order.game_id,
  })
  return { ok: true, order_id: order.id, checkin_code: order.checkin_code, status: 'paid' }
}

const sportsVenueAdminDashboard = async (pool, user) => {
  const [ownedVenues] = await pool.execute(
    `SELECT *
     FROM sports_venue
     WHERE manager_user_id = ?
     ORDER BY create_time DESC
     LIMIT 20`,
    [user.id],
  )
  const hasOwnedVenues = ownedVenues.length > 0
  const [demoVenues] = hasOwnedVenues ? [ownedVenues] : await pool.execute(
    `SELECT *
     FROM sports_venue
     WHERE status = 'approved'
     ORDER BY create_time DESC
     LIMIT 20`,
  )
  const venueWhere = hasOwnedVenues ? 'v.manager_user_id = ?' : 'v.status = "approved"'
  const venueParams = hasOwnedVenues ? [user.id] : []
  const [orders] = await pool.execute(
    `SELECT o.*, g.title, g.start_time, g.end_time, v.name AS venue_name, v.area
     FROM sports_order o
     LEFT JOIN sports_game g ON g.id = o.game_id
     JOIN sports_venue v ON v.id = o.venue_id
     WHERE ${venueWhere}
     ORDER BY
       CASE o.status
         WHEN 'paid' THEN 0
         WHEN 'pending_payment' THEN 1
         WHEN 'checked_in' THEN 2
         ELSE 3
       END,
       o.create_time DESC
     LIMIT 100`,
    venueParams,
  )
  const [[summary]] = await pool.execute(
    `SELECT
       COUNT(CASE WHEN DATE(o.create_time) = CURRENT_DATE() THEN 1 END) AS today_orders,
       COUNT(CASE WHEN o.status = 'paid' THEN 1 END) AS pending_checkins,
       COUNT(CASE WHEN o.status = 'checked_in' THEN 1 END) AS checked_in_orders,
       COALESCE(SUM(CASE WHEN o.status IN ('paid', 'checked_in') THEN o.amount ELSE 0 END), 0) AS revenue
     FROM sports_order o
     JOIN sports_venue v ON v.id = o.venue_id
     WHERE ${venueWhere}`,
    venueParams,
  )
  const normalizedSummary = {
    today_orders: Number(summary.today_orders || 0),
    pending_checkins: Number(summary.pending_checkins || 0),
    checked_in_orders: Number(summary.checked_in_orders || 0),
    revenue: Number(summary.revenue || 0),
  }

  return {
    summary: normalizedSummary,
    metrics: [
      { label: '今日订单', value: normalizedSummary.today_orders },
      { label: '待核销', value: normalizedSummary.pending_checkins },
      { label: '已核销', value: normalizedSummary.checked_in_orders },
      { label: '收入', value: `¥${normalizedSummary.revenue.toFixed(0)}` },
    ],
    scope: hasOwnedVenues ? 'owned' : 'demo',
    venues: demoVenues.map(serializeVenue),
    orders: orders.map((order) => {
      const serialized = serializeOrder(order)
      return {
        ...serialized,
        can_checkin: hasOwnedVenues && serialized.can_checkin,
      }
    }),
  }
}

const venueAdminCheckinOrder = async (pool, user, order) => {
  if (!order) {
    const error = new Error('order not found')
    error.statusCode = 404
    throw error
  }
  if (Number(order.manager_user_id || 0) !== Number(user.id)) {
    const error = new Error('only the venue owner can check in this order')
    error.statusCode = 403
    throw error
  }
  if (order.status === 'checked_in') {
    return {
      ok: true,
      order_id: order.id,
      checkin_code: order.checkin_code,
      status: 'checked_in',
      already_checked_in: true,
    }
  }
  if (order.status !== 'paid') {
    const error = new Error('只有已支付订单可以核销')
    error.statusCode = 409
    throw error
  }

  await pool.execute('UPDATE sports_order SET status = "checked_in", checked_in_at = NOW() WHERE id = ?', [order.id])
  if (order.game_id) {
    await pool.execute('UPDATE sports_signup SET checked_in = 1 WHERE game_id = ? AND user_id = ?', [order.game_id, order.user_id])
    await pool.execute(
      'INSERT INTO sports_credit_event (user_id, username, event_type, score_delta, note, related_game_id) VALUES (?, ?, "checkin", 3, "场馆端到场核销", ?)',
      [order.user_id, order.username, order.game_id],
    )
  }
  await trackEvent(pool, { id: order.user_id, username: order.username }, 'checkin_success', { entity_type: order.game_id ? 'game' : 'venue', entity_id: order.game_id || order.venue_id, metadata: { order_id: order.id, source: 'venue_admin' } })
  await createNotification(pool, { id: order.user_id, username: order.username }, {
    type: 'checkin_success',
    title: '核销成功',
    body: `订单 #${order.id} 已由场馆确认到场。`,
    order_id: order.id,
    game_id: order.game_id,
  })
  return { ok: true, order_id: order.id, checkin_code: order.checkin_code, status: 'checked_in' }
}

const trackEvent = async (pool, user, eventName, payload = {}) => {
  await pool.execute(
    `INSERT INTO sports_analytics_event
      (user_id, username, event_name, entity_type, entity_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      user?.id || null,
      user?.username || '',
      text(eventName, 60),
      text(payload.entity_type, 40),
      payload.entity_id ? Number(payload.entity_id) : null,
      JSON.stringify(payload.metadata || {}),
    ],
  )
}

const analyticsFunnel = async (pool) => {
  const [events] = await pool.execute(`
    SELECT event_name, COUNT(*) AS count
    FROM sports_analytics_event
    WHERE create_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY event_name
  `)
  const counts = Object.fromEntries(events.map((item) => [item.event_name, Number(item.count || 0)]))
  const steps = [
    ['访问首页', 'home_view'],
    ['点击订场', 'venue_book_open'],
    ['生成订单', 'order_created'],
    ['支付成功', 'payment_success'],
    ['发起球局', 'game_created'],
    ['核销到场', 'checkin_success'],
    ['提交互评', 'review_submitted'],
    ['提交集锦', 'clip_submitted'],
  ].map(([label, key]) => ({ label, key, count: counts[key] || 0 }))
  const max = Math.max(1, ...steps.map((item) => item.count))
  return steps.map((item) => ({
    ...item,
    rate: Math.round((item.count / max) * 100),
  }))
}

const resetDemoAccount = async (pool, user) => {
  await pool.execute('DELETE FROM sports_credit_event WHERE user_id = ?', [user.id])
  await pool.execute('DELETE FROM sports_order WHERE user_id = ?', [user.id])
  await pool.execute('DELETE FROM sports_signup WHERE user_id = ?', [user.id])
  await pool.execute('DELETE FROM sports_notification WHERE user_id = ?', [user.id])
  await pool.execute('DELETE FROM sports_ai_clip_request WHERE user_id = ?', [user.id])
  await pool.execute('DELETE FROM sports_data_upload WHERE user_id = ?', [user.id])
  await pool.execute('DELETE FROM sports_analytics_event WHERE user_id = ?', [user.id])
}

const cleanupSportsDemoText = async (pool) => {
  await pool.execute(`DELETE FROM sports_credit_event WHERE event_type = 'demo_reset'`)
  await pool.execute(`DELETE FROM sports_notification WHERE type = 'demo_reset'`)
  await pool.execute(`DELETE FROM sports_venue WHERE status = 'pending' AND manager_user_id IS NOT NULL`)
  const seedGames = [
    ['周六五人制热身局', 2, 2],
    ['南师附中校友半场局', 3, 1.5],
    ['周五晚室内 4v4', 5, 2],
  ]
  for (const [title, dayOffset, hours] of seedGames) {
    const startAt = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000)
    const endAt = new Date(startAt.getTime() + hours * 60 * 60 * 1000)
    await pool.execute(
      `UPDATE sports_game
       SET start_time = ?, end_time = ?, status = 'open'
       WHERE title = ? AND start_time < DATE_ADD(NOW(), INTERVAL 1 DAY)`,
      [startAt, endAt, title],
    )
  }
  await pool.execute(`UPDATE sports_data_upload SET source = '手机/运动相机' WHERE source LIKE '%?%' OR source = ''`)
  await pool.execute(`UPDATE sports_data_upload SET note = '5 人制足球，包含奔跑、急停、变向和对抗片段。' WHERE note LIKE '%?%' OR note = ''`)
}

const ensureRatingSummary = async (pool, user) => {
  const [[summary]] = await pool.execute(
    'SELECT * FROM sports_player_rating_summary WHERE user_id = ? LIMIT 1',
    [user.id],
  )
  if (summary) return summary
  await pool.execute(
    `INSERT INTO sports_player_rating_summary
      (user_id, username, self_score, composite_score, level_label, technique_self, physical_self, tactics_self, defense_self, attitude_self)
     VALUES (?, ?, 3.0, 3.0, '进阶', 3, 3, 3, 3, 3)`,
    [user.id, user.username],
  )
  const [[created]] = await pool.execute('SELECT * FROM sports_player_rating_summary WHERE user_id = ? LIMIT 1', [user.id])
  return created
}

const recalculatePlayerRating = async (pool, userId, username) => {
  const [[self]] = await pool.execute(
    'SELECT * FROM sports_player_self_rating WHERE user_id = ? LIMIT 1',
    [userId],
  )
  const selfRating = self || {
    technique: 3,
    physical: 3,
    tactics: 3,
    defense: 3,
    attitude: 3,
    average_score: 3,
  }
  const [gameRows] = await pool.execute(
    `SELECT game_id, COUNT(*) AS rating_count
     FROM sports_player_peer_rating
     WHERE target_user_id = ? AND status = 'valid'
     GROUP BY game_id
     HAVING COUNT(*) >= 3`,
    [userId],
  )
  const gameIds = gameRows.map((row) => Number(row.game_id))
  let peerStats = null
  let trend = []
  let peerRatingCount = 0

  if (gameIds.length) {
    const placeholders = gameIds.map(() => '?').join(',')
    const [peerRows] = await pool.execute(
      `SELECT * FROM sports_player_peer_rating
       WHERE target_user_id = ? AND status = 'valid' AND game_id IN (${placeholders})
       ORDER BY game_id, create_time`,
      [userId, ...gameIds],
    )
    const byGame = new Map()
    for (const row of peerRows) {
      if (!byGame.has(row.game_id)) byGame.set(row.game_id, [])
      byGame.get(row.game_id).push(row)
    }
    const trimmedRows = []
    for (const [gameId, rows] of byGame.entries()) {
      const sorted = [...rows].sort((a, b) => Number(a.average_score) - Number(b.average_score))
      const effective = sorted.length > 2 ? sorted.slice(1, -1) : sorted
      trimmedRows.push(...effective)
      const avg = effective.reduce((sum, item) => sum + Number(item.average_score), 0) / effective.length
      trend.push({ game_id: gameId, score: Math.round(avg * 10) / 10 })
    }
    peerRatingCount = peerRows.length
    if (trimmedRows.length) {
      peerStats = Object.fromEntries(ratingDimensions.map((key) => [
        key,
        Math.round((trimmedRows.reduce((sum, item) => sum + Number(item[key]), 0) / trimmedRows.length) * 10) / 10,
      ]))
      peerStats.average = Math.round((trimmedRows.reduce((sum, item) => sum + Number(item.average_score), 0) / trimmedRows.length) * 10) / 10
    }
  }

  const selfScore = Number(selfRating.average_score || averageRating(selfRating))
  const effectiveGames = gameIds.length
  const peerWeight = peerStats ? Math.min(0.8, 0.7 + Math.max(0, effectiveGames - 10) * 0.01) : 0
  const composite = peerStats
    ? Math.round((selfScore * (1 - peerWeight) + peerStats.average * peerWeight) * 10) / 10
    : selfScore
  const level = ratingLabel(composite)

  await pool.execute(
    `INSERT INTO sports_player_rating_summary
      (user_id, username, self_score, peer_score, composite_score, level_label, effective_peer_games, peer_rating_count,
       technique_self, physical_self, tactics_self, defense_self, attitude_self,
       technique_peer, physical_peer, tactics_peer, defense_peer, attitude_peer, trend_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       username = VALUES(username),
       self_score = VALUES(self_score),
       peer_score = VALUES(peer_score),
       composite_score = VALUES(composite_score),
       level_label = VALUES(level_label),
       effective_peer_games = VALUES(effective_peer_games),
       peer_rating_count = VALUES(peer_rating_count),
       technique_self = VALUES(technique_self),
       physical_self = VALUES(physical_self),
       tactics_self = VALUES(tactics_self),
       defense_self = VALUES(defense_self),
       attitude_self = VALUES(attitude_self),
       technique_peer = VALUES(technique_peer),
       physical_peer = VALUES(physical_peer),
       tactics_peer = VALUES(tactics_peer),
       defense_peer = VALUES(defense_peer),
       attitude_peer = VALUES(attitude_peer),
       trend_json = VALUES(trend_json)`,
    [
      userId,
      username,
      selfScore,
      peerStats?.average ?? null,
      composite,
      level,
      effectiveGames,
      peerRatingCount,
      selfRating.technique,
      selfRating.physical,
      selfRating.tactics,
      selfRating.defense,
      selfRating.attitude,
      peerStats?.technique ?? null,
      peerStats?.physical ?? null,
      peerStats?.tactics ?? null,
      peerStats?.defense ?? null,
      peerStats?.attitude ?? null,
      JSON.stringify(trend.slice(-10)),
    ],
  )
  const [[summary]] = await pool.execute('SELECT * FROM sports_player_rating_summary WHERE user_id = ? LIMIT 1', [userId])
  return summary
}

const sportsSummaryForUser = async (pool, user) => {
  const [records] = await pool.execute(
    `SELECT
      COUNT(*) AS played,
      SUM(CASE WHEN no_show = 1 THEN 1 ELSE 0 END) AS no_shows,
      SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) AS checked_in
    FROM sports_signup WHERE user_id = ? AND payment_status = 'paid'`,
    [user.id],
  )
  return {
    username: user.username,
    played: Number(records[0]?.played || 0),
    checked_in: Number(records[0]?.checked_in || 0),
    no_shows: Number(records[0]?.no_shows || 0),
    credit_score: await userCreditScore(pool, user),
  }
}

const sportsProfileForUser = async (pool, user) => {
  const rating = await ensureRatingSummary(pool, user)
  const [orders] = await pool.execute(
    `SELECT o.*, g.title, g.start_time, v.name AS venue_name
     FROM sports_order o
     LEFT JOIN sports_game g ON g.id = o.game_id
     JOIN sports_venue v ON v.id = o.venue_id
     WHERE o.user_id = ?
     ORDER BY o.create_time DESC
     LIMIT 50`,
    [user.id],
  )
  const [credit] = await pool.execute(
    'SELECT * FROM sports_credit_event WHERE user_id = ? ORDER BY create_time DESC LIMIT 30',
    [user.id],
  )
  return {
    summary: await sportsSummaryForUser(pool, user),
    rating,
    orders: orders.map(serializeOrder),
    credit,
  }
}

const sportsTeamsForUser = async (pool, user) => {
  const [teams] = await pool.execute(
    `SELECT t.*,
      COUNT(m.id) AS member_count,
      MAX(CASE WHEN m.user_id = ? THEN 1 ELSE 0 END) AS is_member
     FROM sports_team t
     LEFT JOIN sports_team_member m ON m.team_id = t.id AND m.status = 'active'
     WHERE t.status = 'active'
     GROUP BY t.id
     ORDER BY t.create_time DESC`,
    [user.id],
  )
  return teams.map((team) => ({
    ...team,
    member_count: Number(team.member_count || 0),
    member_limit: Number(team.member_limit || 0),
    is_member: Boolean(team.is_member),
  }))
}

const sportsClipsForUser = async (pool, user) => {
  const [clips] = await pool.execute(
    `SELECT c.*, g.title AS game_title
     FROM sports_ai_clip_request c
     LEFT JOIN sports_game g ON g.id = c.game_id
     WHERE c.user_id = ?
     ORDER BY c.create_time DESC
     LIMIT 20`,
    [user.id],
  )
  return clips
}

const sportsUploadsForUser = async (pool, user) => {
  const [uploads] = await pool.execute(
    `SELECT *
     FROM sports_data_upload
     WHERE user_id = ?
     ORDER BY create_time DESC
     LIMIT 20`,
    [user.id],
  )
  return uploads
}

const publicPlayerProfile = async (pool, userId, viewer) => {
  const [[account]] = await pool.execute('SELECT id, username FROM `user` WHERE id = ? LIMIT 1', [userId])
  const [[signupName]] = account ? [[]] : await pool.execute(
    'SELECT user_id AS id, username FROM sports_signup WHERE user_id = ? ORDER BY create_time DESC LIMIT 1',
    [userId],
  )
  const player = account || signupName
  if (!player) return null
  const rating = await ensureRatingSummary(pool, { id: Number(player.id), username: player.username })
  const [records] = await pool.execute(
    `SELECT
      COUNT(*) AS played,
      SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) AS checked_in,
      SUM(CASE WHEN no_show = 1 THEN 1 ELSE 0 END) AS no_shows
     FROM sports_signup WHERE user_id = ? AND payment_status = 'paid'`,
    [userId],
  )
  const isSelf = Number(viewer.id) === Number(userId)
  return {
    user_id: Number(userId),
    username: player.username,
    played: Number(records[0]?.played || 0),
    checked_in: Number(records[0]?.checked_in || 0),
    no_shows: Number(records[0]?.no_shows || 0),
    is_self: isSelf,
    rating: isSelf ? rating : {
      user_id: rating.user_id,
      username: rating.username,
      self_score: rating.self_score,
      peer_score: rating.peer_score,
      composite_score: rating.composite_score,
      level_label: rating.level_label,
      effective_peer_games: rating.effective_peer_games,
      peer_rating_count: rating.peer_rating_count,
      update_time: rating.update_time,
    },
  }
}

const gameRatingContext = async (pool, gameId, user) => {
  const [[game]] = await pool.execute(
    `SELECT g.*, v.name AS venue_name, v.area, v.address
     FROM sports_game g
     JOIN sports_venue v ON v.id = g.venue_id
     WHERE g.id = ? LIMIT 1`,
    [gameId],
  )
  if (!game) return null
  const [players] = await pool.execute(
    `SELECT s.user_id, s.username, s.checked_in, r.composite_score, r.level_label, r.peer_rating_count
     FROM sports_signup s
     LEFT JOIN sports_player_rating_summary r ON r.user_id = s.user_id
     WHERE s.game_id = ? AND s.payment_status = 'paid'
     ORDER BY s.create_time ASC`,
    [gameId],
  )
  const [[mySignup]] = await pool.execute(
    'SELECT * FROM sports_signup WHERE game_id = ? AND user_id = ? AND payment_status = "paid" LIMIT 1',
    [gameId, user.id],
  )
  const now = Date.now()
  const endAt = new Date(game.end_time).getTime()
  const reviewOpen = Boolean(mySignup?.checked_in) && now >= endAt && now <= endAt + 24 * 60 * 60 * 1000
  const [existing] = await pool.execute(
    'SELECT target_user_id FROM sports_player_peer_rating WHERE game_id = ? AND rater_user_id = ?',
    [gameId, user.id],
  )
  return {
    game,
    players: players.map((player) => ({
      ...player,
      composite_score: Number(player.composite_score || 3),
      level_label: player.level_label || '进阶',
      peer_rating_count: Number(player.peer_rating_count || 0),
    })),
    review_open: reviewOpen,
    reviewed_target_ids: existing.map((item) => Number(item.target_user_id)),
  }
}

const venueAvailability = async (pool, venueId, dateValue) => {
  const [[venue]] = await pool.execute('SELECT * FROM sports_venue WHERE id = ? LIMIT 1', [venueId])
  if (!venue) return null
  const openSlots = parseJsonList(venue.open_slots_json)
  const day = dateValue ? new Date(dateValue) : new Date()
  if (Number.isNaN(day.getTime())) return null
  const dayLabel = formatDateOnly(day)
  const [orders] = await pool.execute(
    `SELECT o.*, g.start_time, g.end_time
     FROM sports_order o
     LEFT JOIN sports_game g ON g.id = o.game_id
     WHERE o.venue_id = ? AND o.status IN ('pending_payment', 'paid', 'checked_in')
       AND (DATE(o.booking_start_time) = ? OR DATE(g.start_time) = ?)`,
    [venueId, dayLabel, dayLabel],
  )
  return {
    venue: serializeVenue(venue),
    date: dayLabel,
    slots: openSlots.map((slot, index) => {
      const match = String(slot || '').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
      const start = match ? combineDateTime(dayLabel, `${pad2(match[1])}:${match[2]}`) : null
      const end = match ? combineDateTime(dayLabel, `${pad2(match[3])}:${match[4]}`) : null
      const occupied = start && end
        ? orders.some((order) => {
            const orderStart = order.start_time || order.booking_start_time
            const orderEnd = order.end_time || order.booking_end_time
            return orderStart && orderEnd && overlapsRange(start, end, orderStart, orderEnd)
          })
        : false
      return {
        id: `${venueId}-${index}`,
        label: String(slot || '').trim(),
        start: start ? `${formatTimeOnly(start)}` : '',
        end: end ? `${formatTimeOnly(end)}` : '',
        occupied,
      }
    }),
  }
}

const sportsMetrics = async (pool) => {
  const [[daily]] = await pool.execute(`
    SELECT
      (SELECT COUNT(*) FROM sports_order WHERE DATE(create_time) = CURRENT_DATE()) AS today_orders,
      (SELECT COALESCE(SUM(amount), 0) FROM sports_order WHERE DATE(create_time) = CURRENT_DATE()) AS today_income,
      (SELECT COUNT(*) FROM sports_game WHERE DATE(create_time) = CURRENT_DATE()) AS today_games,
      (SELECT COUNT(DISTINCT user_id) FROM sports_signup WHERE create_time >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND payment_status = 'paid') AS wau,
      (SELECT COUNT(*) FROM sports_game) AS total_games,
      (SELECT COALESCE(SUM(amount), 0) FROM sports_order) AS gmv,
      (SELECT COUNT(*) FROM sports_venue WHERE status = 'approved') AS approved_venues,
      (SELECT COUNT(*) FROM sports_signup WHERE no_show = 1 AND payment_status = 'paid') AS no_show_count,
      (SELECT COUNT(*) FROM sports_signup WHERE payment_status = 'paid') AS signup_count
  `)
  const signups = Number(daily.signup_count || 0)
  return {
    today_orders: Number(daily.today_orders || 0),
    today_income: Number(daily.today_income || 0),
    today_games: Number(daily.today_games || 0),
    wau: Number(daily.wau || 0),
    total_games: Number(daily.total_games || 0),
    gmv: Number(daily.gmv || 0),
    approved_venues: Number(daily.approved_venues || 0),
    no_show_rate: signups ? Math.round(Number(daily.no_show_count || 0) / signups * 1000) / 10 : 0,
  }
}

const handleSportsApi = async (req, res, requestUrl) => {
  const pathName = requestUrl.pathname
  if (!pathName.startsWith('/api/sports-app/')) return false
  try {
    const pool = await ensureSportsSchema()
    await cleanupSportsDemoText(pool)

    if (pathName === '/api/sports-app/auth/wechat-login' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const code = text(body.code, 200)
      if (!code) return json(res, { ok: false, error: 'wx.login code is required' }, 400)

      const openid = await resolveWechatOpenid(code)
      const authUser = await ensureWechatUser(pool, openid)
      const token = makeAuthToken(authUser)

      return json(res, {
        ok: true,
        token,
        user: publicSportsAuthUser(authUser),
      })
    }

    const user = requestUser(req)

    if (pathName === '/api/sports-app/venues' && req.method === 'GET') {
      await trackEvent(pool, user, 'venue_list_view')
      const [rows] = await pool.execute('SELECT * FROM sports_venue ORDER BY status = "approved" DESC, create_time DESC')
      return json(res, rows.map(serializeVenue))
    }

    if (pathName === '/api/sports-app/teams' && req.method === 'GET') {
      return json(res, await sportsTeamsForUser(pool, user))
    }

    if (pathName === '/api/sports-app/teams' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const [result] = await pool.execute(
        `INSERT INTO sports_team
          (name, sport, area, description, captain_user_id, captain_username, member_limit)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          text(body.name, 80) || `${user.username} 的球队`,
          text(body.sport, 20) || 'football',
          text(body.area, 80) || '江宁大学城',
          text(body.description, 500) || '固定约球训练，欢迎同水平球友加入。',
          user.id,
          user.username,
          Number(body.member_limit || 20),
        ],
      )
      await pool.execute(
        'INSERT INTO sports_team_member (team_id, user_id, username, role) VALUES (?, ?, ?, "captain")',
        [result.insertId, user.id, user.username],
      )
      return json(res, { ok: true, id: result.insertId }, 201)
    }

    const joinTeamMatch = pathName.match(/^\/api\/sports-app\/teams\/(\d+)\/join$/)
    if (joinTeamMatch && req.method === 'POST') {
      const teamId = Number(joinTeamMatch[1])
      const [[team]] = await pool.execute(
        `SELECT t.*, COUNT(m.id) AS member_count
         FROM sports_team t
         LEFT JOIN sports_team_member m ON m.team_id = t.id AND m.status = 'active'
         WHERE t.id = ? AND t.status = 'active'
         GROUP BY t.id
         LIMIT 1`,
        [teamId],
      )
      if (!team) return json(res, { ok: false, error: 'team not found' }, 404)
      if (Number(team.member_count || 0) >= Number(team.member_limit || 0)) {
        return json(res, { ok: false, error: '球队已满员' }, 409)
      }
      await pool.execute(
        'INSERT IGNORE INTO sports_team_member (team_id, user_id, username, role) VALUES (?, ?, ?, "member")',
        [teamId, user.id, user.username],
      )
      return json(res, { ok: true })
    }

    if (pathName === '/api/sports-app/ai-clips' && req.method === 'GET') {
      return json(res, await sportsClipsForUser(pool, user))
    }

    if (pathName === '/api/sports-app/ai-clips' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const demoResult = 'Demo 队列已生成：进球识别、出界片段、高光封面会在样板场馆摄像头接入后自动替换为真实结果。'
      const [result] = await pool.execute(
        `INSERT INTO sports_ai_clip_request
          (user_id, username, game_id, video_url, clip_type, status, demo_result)
         VALUES (?, ?, ?, ?, ?, 'queued', ?)`,
        [
          user.id,
          user.username,
          body.game_id ? Number(body.game_id) : null,
          text(body.video_url, 600),
          text(body.clip_type, 40) || 'goal_detection',
          demoResult,
        ],
      )
      await trackEvent(pool, user, 'clip_submitted', { entity_type: 'game', entity_id: body.game_id || null })
      await createNotification(pool, user, {
        type: 'clip_generated',
        title: '集锦任务已生成',
        body: demoResult,
        game_id: body.game_id ? Number(body.game_id) : null,
      })
      return json(res, { ok: true, id: result.insertId, demo_result: demoResult }, 201)
    }

    if (pathName === '/api/sports-app/data-uploads' && req.method === 'GET') {
      return json(res, await sportsUploadsForUser(pool, user))
    }

    if (pathName === '/api/sports-app/data-uploads' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const note = text(body.note, 500)
      const qualityScore = Math.min(95, Math.max(60, 70 + Math.round(note.length / 12)))
      const [result] = await pool.execute(
        `INSERT INTO sports_data_upload
          (user_id, username, data_type, source, consent_scope, note, quality_score)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.username,
          text(body.data_type, 40) || 'egocentric_video',
          text(body.source, 80) || '手机/运动相机',
          text(body.consent_scope, 120) || 'training_anonymized',
          note,
          qualityScore,
        ],
      )
      return json(res, { ok: true, id: result.insertId, quality_score: qualityScore }, 201)
    }

    if (pathName === '/api/sports-app/rating/self' && req.method === 'GET') {
      return json(res, await ensureRatingSummary(pool, user))
    }

    if (pathName === '/api/sports-app/rating/self' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const rating = normalizeRatingBody(body)
      const average = averageRating(rating)
      const [[existing]] = await pool.execute('SELECT * FROM sports_player_self_rating WHERE user_id = ? LIMIT 1', [user.id])
      if (existing) {
        const windowStart = new Date(existing.window_start).getTime()
        const inWindow = Date.now() - windowStart < 7 * 24 * 60 * 60 * 1000
        if (inWindow && Number(existing.edit_count_window || 0) >= 1) {
          return json(res, { ok: false, error: '自评提交后 7 天内仅可修改 1 次' }, 429)
        }
        await pool.execute(
          `UPDATE sports_player_self_rating SET
            username = ?, technique = ?, physical = ?, tactics = ?, defense = ?, attitude = ?, average_score = ?,
            edit_count_window = ?, window_start = ?
           WHERE user_id = ?`,
          [
            user.username,
            rating.technique,
            rating.physical,
            rating.tactics,
            rating.defense,
            rating.attitude,
            average,
            inWindow ? Number(existing.edit_count_window || 0) + 1 : 0,
            inWindow ? existing.window_start : new Date(),
            user.id,
          ],
        )
      } else {
        await pool.execute(
          `INSERT INTO sports_player_self_rating
            (user_id, username, technique, physical, tactics, defense, attitude, average_score, edit_count_window)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [user.id, user.username, rating.technique, rating.physical, rating.tactics, rating.defense, rating.attitude, average],
        )
      }
      const summary = await recalculatePlayerRating(pool, user.id, user.username)
      return json(res, { ok: true, summary })
    }

    const playerProfileMatch = pathName.match(/^\/api\/sports-app\/players\/(\d+)$/)
    if (playerProfileMatch && req.method === 'GET') {
      const profile = await publicPlayerProfile(pool, Number(playerProfileMatch[1]), user)
      if (!profile) return json(res, { ok: false, error: 'player not found' }, 404)
      return json(res, profile)
    }

    if (pathName === '/api/sports-app/venues' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const sports = Array.isArray(body.sports) ? body.sports.join(',') : text(body.sports, 80)
      const [result] = await pool.execute(
        `INSERT INTO sports_venue
          (name, area, address, lat, lng, sports, indoor, price_per_hour, cover_url, open_slots_json, status, contact, manager_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          text(body.name, 100),
          text(body.area, 80) || '江宁',
          text(body.address, 255),
          Number(body.lat || 31.91),
          Number(body.lng || 118.84),
          sports || 'football,basketball',
          body.indoor ? 1 : 0,
          Number(body.price_per_hour || 0),
          text(body.cover_url, 600),
          JSON.stringify(Array.isArray(body.open_slots) ? body.open_slots : []),
          text(body.contact, 80) || user.username,
          user.id,
        ],
      )
      return json(res, { ok: true, id: result.insertId }, 201)
    }

    const venueAvailabilityMatch = pathName.match(/^\/api\/sports-app\/venues\/(\d+)\/availability$/)
    if (venueAvailabilityMatch && req.method === 'GET') {
      const availability = await venueAvailability(pool, Number(venueAvailabilityMatch[1]), requestUrl.searchParams.get('date'))
      if (!availability) return json(res, { ok: false, error: 'venue not found or invalid date' }, 404)
      return json(res, availability)
    }

    const venueBookMatch = pathName.match(/^\/api\/sports-app\/venues\/(\d+)\/book$/)
    if (venueBookMatch && req.method === 'POST') {
      const body = await readJsonBody(req)
      const venueId = Number(venueBookMatch[1])
      await requireAllActionCredit(pool, user, '订场')
      const [[venue]] = await pool.execute('SELECT * FROM sports_venue WHERE id = ? LIMIT 1', [venueId])
      if (!venue) return json(res, { ok: false, error: 'venue not found' }, 404)
      const bookingDate = text(body.booking_date, 20)
      const bookingStartTime = text(body.booking_start_time, 40)
      const bookingEndTime = text(body.booking_end_time, 40)
      const bookingStart = combineDateTime(bookingDate, bookingStartTime)
      const bookingEnd = combineDateTime(bookingDate, bookingEndTime)
      if (!bookingStart || !bookingEnd || bookingEnd <= bookingStart) {
        return json(res, { ok: false, error: '请选择有效的日期和时段' }, 400)
      }
      const bookingLabel = bookingRangeLabel(bookingStart, bookingEnd)
      const [conflicts] = await pool.execute(
        `SELECT o.id, o.game_id, o.create_time, o.booking_start_time, o.booking_end_time, g.start_time, g.end_time
         FROM sports_order o
         LEFT JOIN sports_game g ON g.id = o.game_id
         WHERE o.venue_id = ? AND o.status NOT IN ('cancelled', 'refunded')`,
        [venueId],
      )
      const hasConflict = conflicts.some((order) => {
        const existingStart = order.game_id && order.start_time ? order.start_time : null
        const existingEnd = order.game_id && order.end_time ? order.end_time : null
        const orderStart = existingStart || order.booking_start_time || order.create_time
        const orderEnd = existingEnd || order.booking_end_time || new Date(new Date(order.create_time).getTime() + 60 * 60 * 1000)
        return overlapsRange(bookingStart, bookingEnd, orderStart, orderEnd)
      })
      if (hasConflict) {
        return json(res, { ok: false, error: '该时段已被占用，请换一个时间段' }, 409)
      }
      const amountHours = Math.max(1, Math.round((bookingEnd - bookingStart) / (60 * 60 * 1000)))
      const amount = Number(venue.price_per_hour || 0) * amountHours
      const checkinCode = String(100000 + Math.floor(Math.random() * 900000))
      const [result] = await pool.execute(
        'INSERT INTO sports_order (venue_id, game_id, user_id, username, amount, status, checkin_code, booking_start_time, booking_end_time) VALUES (?, NULL, ?, ?, ?, "pending_payment", ?, ?, ?)',
        [venueId, user.id, user.username, amount, checkinCode, bookingStart, bookingEnd],
      )
      await createNotification(pool, user, {
        type: 'payment_required',
        title: '场地订单待支付',
        body: `${venue.name} ${bookingLabel} 已锁定，请尽快完成支付。`,
        order_id: result.insertId,
      })
      return json(res, {
        ok: true,
        order_id: result.insertId,
        checkin_code: checkinCode,
        status: 'pending_payment',
        amount,
        booking_range: bookingLabel,
        booking_date: bookingDate,
        booking_start_time: bookingStartTime,
        booking_end_time: bookingEndTime,
      }, 201)
    }

    const venueMatch = pathName.match(/^\/api\/sports-app\/venues\/(\d+)$/)
    if (venueMatch && req.method === 'PATCH') {
      const body = await readJsonBody(req)
      await pool.execute(
        `UPDATE sports_venue SET
          name = COALESCE(NULLIF(?, ''), name),
          area = COALESCE(NULLIF(?, ''), area),
          address = COALESCE(NULLIF(?, ''), address),
          price_per_hour = COALESCE(?, price_per_hour),
          status = COALESCE(NULLIF(?, ''), status),
          contact = COALESCE(NULLIF(?, ''), contact)
         WHERE id = ?`,
        [
          text(body.name, 100),
          text(body.area, 80),
          text(body.address, 255),
          body.price_per_hour === undefined ? null : Number(body.price_per_hour),
          text(body.status, 20),
          text(body.contact, 80),
          Number(venueMatch[1]),
        ],
      )
      return json(res, { ok: true })
    }

    if (pathName === '/api/sports-app/games' && req.method === 'GET') {
      await trackEvent(pool, user, 'game_list_view')
      const [rows] = await pool.execute(
        `SELECT g.*, v.name AS venue_name, v.area, v.address, v.cover_url,
          SUM(CASE WHEN s.payment_status = 'paid' THEN 1 ELSE 0 END) AS joined_count,
          SUM(CASE WHEN s.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
          SUM(CASE WHEN s.checked_in = 1 THEN 1 ELSE 0 END) AS checked_in_count,
          MAX(CASE WHEN s.user_id = ? THEN 1 ELSE 0 END) AS is_joined,
          ROUND(AVG(rs.composite_score), 1) AS average_rating,
          COALESCE(JSON_ARRAYAGG(
            CASE WHEN s.id IS NULL THEN NULL ELSE JSON_OBJECT(
              'user_id', s.user_id,
              'username', s.username,
              'level_label', COALESCE(rs.level_label, '进阶'),
              'composite_score', COALESCE(rs.composite_score, 3.0)
            ) END
          ), JSON_ARRAY()) AS players_json
         FROM sports_game g
         JOIN sports_venue v ON v.id = g.venue_id
         LEFT JOIN sports_signup s ON s.game_id = g.id AND s.payment_status = 'paid'
         LEFT JOIN sports_player_rating_summary rs ON rs.user_id = s.user_id
         WHERE g.status <> 'cancelled'
         GROUP BY g.id
         ORDER BY g.start_time ASC`,
        [user.id],
      )
      return json(res, rows.map(serializeGame))
    }

    if (pathName === '/api/sports-app/games' && req.method === 'POST') {
      const body = await readJsonBody(req)
      await requireAllActionCredit(pool, user, '发起球局')
      const startTime = text(body.start_time, 40)
      const endTime = text(body.end_time, 40)
      if (!startTime || !endTime || Number.isNaN(new Date(startTime).getTime()) || Number.isNaN(new Date(endTime).getTime())) {
        return json(res, { ok: false, error: '请选择有效的开始时间和结束时间' }, 400)
      }
      if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
        return json(res, { ok: false, error: '结束时间必须晚于开始时间' }, 400)
      }
      const [result] = await pool.execute(
        `INSERT INTO sports_game
          (sport, title, venue_id, start_time, end_time, capacity, fee_per_person, notes, creator_user_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
        [
          text(body.sport, 20) || 'football',
          text(body.title, 120) || '南京同城约球',
          Number(body.venue_id),
          startTime,
          endTime,
          Number(body.capacity || 10),
          Number(body.fee_per_person || 0),
          text(body.notes, 500),
          user.id,
        ],
      )
      await pool.execute(
        'INSERT INTO sports_credit_event (user_id, username, event_type, score_delta, note, related_game_id) VALUES (?, ?, "create_game", 2, "发起真实球局", ?)',
        [user.id, user.username, result.insertId],
      )
      await trackEvent(pool, user, 'game_created', { entity_type: 'game', entity_id: result.insertId })
      return json(res, { ok: true, id: result.insertId }, 201)
    }

    const joinMatch = pathName.match(/^\/api\/sports-app\/games\/(\d+)\/join$/)
    if (joinMatch && req.method === 'POST') {
      const gameId = Number(joinMatch[1])
      await requirePublicJoinCredit(pool, user)
      const [[game]] = await pool.execute(
        `SELECT g.*, v.id AS venue_id,
          SUM(CASE WHEN s.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
          MAX(CASE WHEN s.user_id = ? AND s.payment_status = 'paid' THEN 1 ELSE 0 END) AS is_joined
         FROM sports_game g
         JOIN sports_venue v ON v.id = g.venue_id
         LEFT JOIN sports_signup s ON s.game_id = g.id
         WHERE g.id = ? AND g.status <> 'cancelled'
         GROUP BY g.id
         LIMIT 1`,
        [user.id, gameId],
      )
      if (!game) return json(res, { ok: false, error: 'game not found' }, 404)
      if (Number(game.is_joined || 0) === 1) return json(res, { ok: false, error: '你已经报名过这场球局' }, 409)
      if (Number(game.paid_count || 0) >= Number(game.capacity || 0)) return json(res, { ok: false, error: '球局已满员，暂不能报名' }, 409)
      const lifecycle = gameLifecycleStatus(game, Number(game.paid_count || 0), Number(game.paid_count || 0), 0)
      if (!['forming', 'open'].includes(lifecycle)) {
        return json(res, { ok: false, error: '该球局已锁局或已开赛，暂不能报名' }, 409)
      }
      const checkinCode = String(100000 + Math.floor(Math.random() * 900000))
      const [orderResult] = await pool.execute(
        'INSERT INTO sports_order (venue_id, game_id, user_id, username, amount, status, checkin_code) VALUES (?, ?, ?, ?, ?, "pending_payment", ?)',
        [game.venue_id, gameId, user.id, user.username, Number(game.fee_per_person || 0), checkinCode],
      )
      await trackEvent(pool, user, 'order_created', { entity_type: 'game', entity_id: gameId, metadata: { order_id: orderResult.insertId } })
      await createNotification(pool, user, {
        type: 'payment_required',
        title: '报名订单待支付',
        body: `${game.title} 已生成待支付订单，支付后才会正式占位。`,
        order_id: orderResult.insertId,
        game_id: gameId,
      })
      return json(res, { ok: true, order_id: orderResult.insertId, checkin_code: checkinCode, status: 'pending_payment' }, 201)
    }

    const gameDetailMatch = pathName.match(/^\/api\/sports-app\/games\/(\d+)$/)
    if (gameDetailMatch && req.method === 'GET') {
      const detail = await gameRatingContext(pool, Number(gameDetailMatch[1]), user)
      if (!detail) return json(res, { ok: false, error: 'game not found' }, 404)
      return json(res, detail)
    }

    const gameReviewMatch = pathName.match(/^\/api\/sports-app\/games\/(\d+)\/reviews$/)
    if (gameReviewMatch && req.method === 'POST') {
      const gameId = Number(gameReviewMatch[1])
      const detail = await gameRatingContext(pool, gameId, user)
      if (!detail) return json(res, { ok: false, error: 'game not found' }, 404)
      if (!detail.review_open) return json(res, { ok: false, error: '互评入口未开放或已超时' }, 403)
      const body = await readJsonBody(req)
      const reviews = Array.isArray(body.reviews) ? body.reviews : []
      const checkedInTargets = new Map(detail.players.filter((player) => Number(player.checked_in) === 1).map((player) => [Number(player.user_id), player]))
      const savedTargets = []
      for (const review of reviews) {
        const targetId = Number(review.target_user_id)
        const target = checkedInTargets.get(targetId)
        if (!target || targetId === user.id) continue
        const rating = normalizeRatingBody(review)
        const average = averageRating(rating)
        try {
          await pool.execute(
            `INSERT INTO sports_player_peer_rating
              (game_id, rater_user_id, rater_username, target_user_id, target_username,
               technique, physical, tactics, defense, attitude, average_score, anonymous)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              gameId,
              user.id,
              user.username,
              targetId,
              target.username,
              rating.technique,
              rating.physical,
              rating.tactics,
              rating.defense,
              rating.attitude,
              average,
              review.anonymous === false ? 0 : 1,
            ],
          )
          savedTargets.push({ id: targetId, username: target.username })
        } catch (error) {
          if (error?.code !== 'ER_DUP_ENTRY') throw error
        }
      }
      for (const target of savedTargets) {
        await recalculatePlayerRating(pool, target.id, target.username)
        await pool.execute(
          `INSERT INTO sports_credit_event (user_id, username, event_type, score_delta, note, related_game_id)
           VALUES (?, ?, 'peer_praise', 1, '获得队友好评', ?)` ,
          [target.id, target.username, gameId],
        )
        await createNotification(pool, target, {
          type: 'rating_updated',
          title: '你收到新的赛后互评',
          body: '综合实力分已根据有效互评重新计算。',
          game_id: gameId,
        })
      }
      await createNotification(pool, user, {
        type: 'review_submitted',
        title: '赛后互评已提交',
        body: `本场已提交 ${savedTargets.length} 条互评。`,
        game_id: gameId,
      })
      await trackEvent(pool, user, 'review_submitted', { entity_type: 'game', entity_id: gameId, metadata: { saved: savedTargets.length } })
      return json(res, { ok: true, saved: savedTargets.length })
    }

    if (pathName === '/api/sports-app/track' && req.method === 'POST') {
      const body = await readJsonBody(req)
      await trackEvent(pool, user, text(body.event_name, 60), {
        entity_type: text(body.entity_type, 40),
        entity_id: body.entity_id ? Number(body.entity_id) : null,
        metadata: body.metadata || {},
      })
      return json(res, { ok: true })
    }

    if (pathName === '/api/sports-app/me' && req.method === 'GET') return json(res, await sportsProfileForUser(pool, user))

    if (pathName === '/api/sports-app/orders' && req.method === 'GET') {
      const [orders] = await pool.execute(
        `SELECT o.*, g.title, g.start_time, v.name AS venue_name
         FROM sports_order o
         LEFT JOIN sports_game g ON g.id = o.game_id
         JOIN sports_venue v ON v.id = o.venue_id
         WHERE o.user_id = ?
         ORDER BY o.create_time DESC
         LIMIT 100`,
        [user.id],
      )
      return json(res, orders.map(serializeOrder))
    }

    if (pathName === '/api/sports-app/venue-admin' && req.method === 'GET') {
      return json(res, await sportsVenueAdminDashboard(pool, user))
    }

    const venueAdminCheckinMatch = pathName.match(/^\/api\/sports-app\/venue-admin\/orders\/(\d+)\/checkin$/)
    if (venueAdminCheckinMatch && req.method === 'POST') {
      const orderId = Number(venueAdminCheckinMatch[1])
      const [[order]] = await pool.execute(
        `SELECT o.*, g.start_time, g.end_time, v.manager_user_id
         FROM sports_order o
         LEFT JOIN sports_game g ON g.id = o.game_id
         JOIN sports_venue v ON v.id = o.venue_id
         WHERE o.id = ?
         LIMIT 1`,
        [orderId],
      )
      try {
        return json(res, await venueAdminCheckinOrder(pool, user, order))
      } catch (error) {
        return json(res, { ok: false, error: error.message || '核销失败' }, error.statusCode || 500)
      }
    }

    if (pathName === '/api/sports-app/venue-admin/checkin-code' && req.method === 'POST') {
      const body = await readJson(req)
      const code = text(body.checkin_code || body.code, 30)
      if (!code) return json(res, { ok: false, error: '请输入核销码' }, 400)

      const [[order]] = await pool.execute(
        `SELECT o.*, g.start_time, g.end_time, v.manager_user_id
         FROM sports_order o
         LEFT JOIN sports_game g ON g.id = o.game_id
         JOIN sports_venue v ON v.id = o.venue_id
         WHERE o.checkin_code = ?
         ORDER BY o.create_time DESC
         LIMIT 1`,
        [code],
      )
      try {
        return json(res, await venueAdminCheckinOrder(pool, user, order))
      } catch (error) {
        return json(res, { ok: false, error: error.message || '核销失败' }, error.statusCode || 500)
      }
    }

    const venueAdminUpdateMatch = pathName.match(/^\/api\/sports-app\/venue-admin\/venues\/(\d+)$/)
    if (venueAdminUpdateMatch && req.method === 'PATCH') {
      const venueId = Number(venueAdminUpdateMatch[1])
      const [[venue]] = await pool.execute('SELECT * FROM sports_venue WHERE id = ? LIMIT 1', [venueId])
      if (!venue) return json(res, { ok: false, error: 'venue not found' }, 404)
      if (Number(venue.manager_user_id || 0) !== Number(user.id)) {
        return json(res, { ok: false, error: '只能维护自己管理的场馆' }, 403)
      }

      const body = await readJson(req)
      const openSlots = Array.isArray(body.open_slots)
        ? body.open_slots.map((slot) => text(slot, 40)).filter(Boolean)
        : parseJsonList(venue.open_slots_json)

      await pool.execute(
        `UPDATE sports_venue SET
          price_per_hour = COALESCE(?, price_per_hour),
          contact = COALESCE(NULLIF(?, ''), contact),
          open_slots_json = ?
         WHERE id = ? AND manager_user_id = ?`,
        [
          body.price_per_hour === undefined ? null : Number(body.price_per_hour),
          text(body.contact, 80),
          JSON.stringify(openSlots),
          venueId,
          user.id,
        ],
      )
      return json(res, { ok: true, id: venueId })
    }

    if (pathName === '/api/sports-app/notifications' && req.method === 'GET') {
      return json(res, await sportsNotificationsForUser(pool, user))
    }

    const readNotificationMatch = pathName.match(/^\/api\/sports-app\/notifications\/(\d+)\/read$/)
    if (readNotificationMatch && req.method === 'POST') {
      await pool.execute(
        'UPDATE sports_notification SET status = "read", read_at = NOW() WHERE id = ? AND user_id = ?',
        [Number(readNotificationMatch[1]), user.id],
      )
      return json(res, { ok: true })
    }

    const prepayMatch = pathName.match(/^\/api\/sports-app\/orders\/(\d+)\/prepay$/)
    if (prepayMatch && req.method === 'POST') {
      const orderId = Number(prepayMatch[1])
      const [[order]] = await pool.execute('SELECT * FROM sports_order WHERE id = ? LIMIT 1', [orderId])
      if (!order) return json(res, { ok: false, error: 'order not found' }, 404)
      if (Number(order.user_id) !== Number(user.id)) return json(res, { ok: false, error: '只能支付自己的订单' }, 403)
      if (order.status !== 'pending_payment') return json(res, { ok: false, error: '订单当前状态不能支付' }, 409)
      return json(res, createMockPrepay(order))
    }

    const confirmPayMatch = pathName.match(/^\/api\/sports-app\/orders\/(\d+)\/pay\/confirm$/)
    if (confirmPayMatch && req.method === 'POST') {
      const orderId = Number(confirmPayMatch[1])
      const [[order]] = await pool.execute('SELECT * FROM sports_order WHERE id = ? LIMIT 1', [orderId])
      try {
        return json(res, await markSportsOrderPaid(pool, user, order, 'mock_confirm'))
      } catch (error) {
        return json(res, { ok: false, error: error.message || '支付失败' }, error.statusCode || 500)
      }
    }

    const payMatch = pathName.match(/^\/api\/sports-app\/orders\/(\d+)\/pay$/)
    if (payMatch && req.method === 'POST') {
      const orderId = Number(payMatch[1])
      const [[order]] = await pool.execute('SELECT * FROM sports_order WHERE id = ? LIMIT 1', [orderId])
      try {
        return json(res, await markSportsOrderPaid(pool, user, order, 'legacy_mock'))
      } catch (error) {
        return json(res, { ok: false, error: error.message || '支付失败' }, error.statusCode || 500)
      }
    }

    if (pathName === '/api/sports-app/payment/wechat/notify' && req.method === 'POST') {
      return json(res, {
        ok: false,
        error: 'wechat payment notify is reserved; configure merchant keys and signature verification before enabling',
      }, 501)
    }

    const cancelOrderMatch = pathName.match(/^\/api\/sports-app\/orders\/(\d+)\/cancel$/)
    if (cancelOrderMatch && req.method === 'POST') {
      const orderId = Number(cancelOrderMatch[1])
      const [[order]] = await pool.execute(
        `SELECT o.*, g.start_time
         FROM sports_order o
         LEFT JOIN sports_game g ON g.id = o.game_id
         WHERE o.id = ?
         LIMIT 1`,
        [orderId],
      )
      if (!order) return json(res, { ok: false, error: 'order not found' }, 404)
      if (Number(order.user_id) !== Number(user.id)) return json(res, { ok: false, error: '只能取消自己的订单' }, 403)
      const cancelRule = canCancelOrder(order)
      if (!cancelRule.ok) return json(res, { ok: false, error: cancelRule.error }, 409)
      const nextStatus = cancelRule.nextStatus
      await pool.execute('UPDATE sports_order SET status = ?, cancelled_at = NOW() WHERE id = ?', [nextStatus, orderId])
      if (order.game_id) {
        await pool.execute('UPDATE sports_signup SET payment_status = ? WHERE game_id = ? AND user_id = ?', [nextStatus, order.game_id, order.user_id])
      }
      if (Number(cancelRule.penalty || 0) !== 0) {
        await pool.execute(
          'INSERT INTO sports_credit_event (user_id, username, event_type, score_delta, note, related_game_id) VALUES (?, ?, "late_cancel", ?, ?, ?)',
          [order.user_id, order.username, Number(cancelRule.penalty || 0), cancelRule.note, order.game_id || null],
        )
      }
      await trackEvent(pool, user, nextStatus === 'refunded' ? 'refund_success' : 'order_cancelled', { entity_type: order.game_id ? 'game' : 'venue', entity_id: order.game_id || order.venue_id, metadata: { order_id: orderId, penalty: Number(cancelRule.penalty || 0) } })
      await createNotification(pool, user, {
        type: nextStatus === 'refunded' ? 'refund_success' : 'order_cancelled',
        title: nextStatus === 'refunded' ? '订单已退款' : '订单已取消',
        body: `订单 #${orderId} 已更新为${nextStatus === 'refunded' ? '已退款' : '已取消'}。${Number(cancelRule.penalty || 0) !== 0 ? ` ${cancelRule.note}` : ''}`,
        order_id: orderId,
        game_id: order.game_id,
      })
      return json(res, { ok: true, status: nextStatus, penalty: Number(cancelRule.penalty || 0), note: cancelRule.note })
    }

    const checkinMatch = pathName.match(/^\/api\/sports-app\/orders\/(\d+)\/checkin$/)
    if (checkinMatch && req.method === 'POST') {
      const orderId = Number(checkinMatch[1])
      const [[order]] = await pool.execute('SELECT o.*, g.start_time FROM sports_order o LEFT JOIN sports_game g ON g.id = o.game_id WHERE o.id = ? LIMIT 1', [orderId])
      if (!order) return json(res, { ok: false, error: 'order not found' }, 404)
      if (Number(order.user_id) !== Number(user.id)) return json(res, { ok: false, error: '只能核销自己的订单' }, 403)
      if (order.status !== 'paid') return json(res, { ok: false, error: '只有已支付订单可以核销' }, 409)
      const checkinWindow = orderCheckinWindow(order)
      if (!checkinWindow.ok) {
        return json(res, { ok: false, error: checkinWindow.reason }, 409)
      }
      if (order.game_id) {
        const [[signup]] = await pool.execute('SELECT * FROM sports_signup WHERE game_id = ? AND user_id = ? LIMIT 1', [order.game_id, order.user_id])
        if (signup?.no_show) {
          return json(res, { ok: false, error: '该场已记为缺席，无法再次核销' }, 409)
        }
      }
      await pool.execute('UPDATE sports_order SET status = "checked_in", checked_in_at = NOW() WHERE id = ?', [orderId])
      if (order.game_id) {
        await pool.execute('UPDATE sports_signup SET checked_in = 1 WHERE game_id = ? AND user_id = ?', [order.game_id, order.user_id])
        await pool.execute(
          'INSERT INTO sports_credit_event (user_id, username, event_type, score_delta, note, related_game_id) VALUES (?, ?, "checkin", 3, "到场核销", ?)',
          [order.user_id, order.username, order.game_id],
        )
        await trackEvent(pool, { id: order.user_id, username: order.username }, 'checkin_success', { entity_type: 'game', entity_id: order.game_id, metadata: { order_id: orderId } })
        await createNotification(pool, { id: order.user_id, username: order.username }, {
          type: 'checkin_success',
          title: '核销成功',
          body: '你已完成到场核销，信用分 +3。',
          order_id: orderId,
          game_id: order.game_id,
        })
      }
      return json(res, { ok: true, order_id: orderId, checkin_code: order.checkin_code, status: 'checked_in' })
    }

    if (pathName === '/api/sports-app/admin/metrics' && req.method === 'GET') {
      return json(res, {
        ...await sportsMetrics(pool),
        funnel: await analyticsFunnel(pool),
      })
    }

    if (pathName === '/api/sports-app/admin/demo-reset' && req.method === 'POST') {
      await resetDemoAccount(pool, user)
      return json(res, { ok: true })
    }

    if (pathName === '/api/sports-app/admin/users' && req.method === 'GET') {
      const [users] = await pool.execute(
        `SELECT u.id, u.username, u.status, u.create_time,
          COALESCE(s.joined_games, 0) AS joined_games,
          COALESCE(s.no_shows, 0) AS no_shows,
          100 + COALESCE(c.credit_delta, 0) AS credit_score
         FROM user u
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS joined_games, SUM(CASE WHEN no_show = 1 THEN 1 ELSE 0 END) AS no_shows
           FROM sports_signup
           WHERE payment_status = 'paid'
           GROUP BY user_id
         ) s ON s.user_id = u.id
         LEFT JOIN (
           SELECT user_id, SUM(score_delta) AS credit_delta
           FROM sports_credit_event
           GROUP BY user_id
         ) c ON c.user_id = u.id
         ORDER BY u.create_time DESC
         LIMIT 100`,
      )
      return json(res, users.map((item) => ({
        ...item,
        joined_games: Number(item.joined_games || 0),
        no_shows: Number(item.no_shows || 0),
        credit_score: Number(item.credit_score || 100),
      })))
    }

    if (pathName === '/api/sports-app/admin/ratings' && req.method === 'GET') {
      const [rows] = await pool.execute(
        `SELECT * FROM sports_player_rating_summary
         ORDER BY composite_score DESC, peer_rating_count DESC
         LIMIT 100`,
      )
      return json(res, rows)
    }

    const userStatusMatch = pathName.match(/^\/api\/sports-app\/admin\/users\/(\d+)\/status$/)
    if (userStatusMatch && req.method === 'PATCH') {
      const body = await readJsonBody(req)
      const status = Number(body.status) === 0 ? 0 : 1
      await pool.execute('UPDATE user SET status = ? WHERE id = ?', [status, Number(userStatusMatch[1])])
      return json(res, { ok: true })
    }

    const resetRatingMatch = pathName.match(/^\/api\/sports-app\/admin\/ratings\/(\d+)\/reset$/)
    if (resetRatingMatch && req.method === 'POST') {
      const targetId = Number(resetRatingMatch[1])
      await pool.execute('DELETE FROM sports_player_peer_rating WHERE target_user_id = ? OR rater_user_id = ?', [targetId, targetId])
      await pool.execute('DELETE FROM sports_player_self_rating WHERE user_id = ?', [targetId])
      await pool.execute('DELETE FROM sports_player_rating_summary WHERE user_id = ?', [targetId])
      return json(res, { ok: true })
    }

    if (pathName === '/api/sports-app/bootstrap' && req.method === 'GET') {
      const [venues] = await pool.execute('SELECT * FROM sports_venue ORDER BY status = "approved" DESC, create_time DESC')
      const [games] = await pool.execute(
        `SELECT g.*, v.name AS venue_name, v.area, v.address, v.cover_url,
          SUM(CASE WHEN s.payment_status = 'paid' THEN 1 ELSE 0 END) AS joined_count,
          SUM(CASE WHEN s.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
          SUM(CASE WHEN s.checked_in = 1 THEN 1 ELSE 0 END) AS checked_in_count,
          MAX(CASE WHEN s.user_id = ? THEN 1 ELSE 0 END) AS is_joined,
          ROUND(AVG(rs.composite_score), 1) AS average_rating,
          COALESCE(JSON_ARRAYAGG(
            CASE WHEN s.id IS NULL THEN NULL ELSE JSON_OBJECT(
              'user_id', s.user_id,
              'username', s.username,
              'level_label', COALESCE(rs.level_label, '进阶'),
              'composite_score', COALESCE(rs.composite_score, 3.0)
            ) END
          ), JSON_ARRAY()) AS players_json
         FROM sports_game g
         JOIN sports_venue v ON v.id = g.venue_id
         LEFT JOIN sports_signup s ON s.game_id = g.id AND s.payment_status = 'paid'
         LEFT JOIN sports_player_rating_summary rs ON rs.user_id = s.user_id
         WHERE g.status <> 'cancelled'
         GROUP BY g.id
         ORDER BY g.start_time ASC`,
        [user.id],
      )
      return json(res, {
        venues: venues.map(serializeVenue),
        games: games.map(serializeGame),
        ...(await sportsProfileForUser(pool, user)),
        teams: await sportsTeamsForUser(pool, user),
        clips: await sportsClipsForUser(pool, user),
        uploads: await sportsUploadsForUser(pool, user),
        notifications: await sportsNotificationsForUser(pool, user),
        metrics: {
          ...await sportsMetrics(pool),
          funnel: await analyticsFunnel(pool),
        },
      })
    }

    return json(res, { ok: false, error: 'sports endpoint not found' }, 404)
  } catch (error) {
    console.error('[sports-app] error', error)
    return json(res, { ok: false, error: error instanceof Error ? error.message : 'sports api failed' }, error.statusCode || 500)
  }
}

const handleAuthApi = async (req, res, pathName) => {
  if (!pathName.startsWith('/api/auth/')) return false
  try {
    if (pathName === '/api/auth/login' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const username = text(body.username || body.email, 50)
      const password = String(body.password || '')
      if (!username || !password) return json(res, { ok: false, error: 'username and password are required' }, 400)

      const pool = await getDbPool()
      const [rows] = await pool.execute(
        'SELECT id, username, password_hash, status FROM `user` WHERE username = ? LIMIT 1',
        [username],
      )
      const user = rows[0]
      if (!user || Number(user.status) !== 1) {
        return json(res, { ok: false, error: 'Invalid username or password' }, 401)
      }

      const passwordOk = await bcrypt.compare(password, user.password_hash)
      if (!passwordOk) {
        return json(res, { ok: false, error: 'Invalid username or password' }, 401)
      }

      return json(res, { ok: true, user: publicAuthUser(user) })
    }

    if (pathName === '/api/auth/register' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const username = text(body.username || body.email, 50)
      const password = String(body.password || '')
      if (!username || !password) return json(res, { ok: false, error: 'username and password are required' }, 400)
      if (password.length < 6) return json(res, { ok: false, error: 'password must be at least 6 characters' }, 400)

      const passwordHash = await bcrypt.hash(password, 12)
      const pool = await getDbPool()
      try {
        const [result] = await pool.execute(
          'INSERT INTO `user` (username, password_hash, status) VALUES (?, ?, 1)',
          [username, passwordHash],
        )
        return json(res, { ok: true, user: publicAuthUser({ id: result.insertId, username }) }, 201)
      } catch (error) {
        if (error?.code === 'ER_DUP_ENTRY') {
          return json(res, { ok: false, error: 'username already exists' }, 409)
        }
        throw error
      }
    }

    return json(res, { ok: false, error: 'auth endpoint not found' }, 404)
  } catch (error) {
    console.error('[auth] error', error)
    return json(res, { ok: false, error: error instanceof Error ? error.message : 'auth failed' }, 500)
  }
}

const readDotEnv = async (file) => {
  try {
    const raw = await fs.readFile(file, 'utf8')
    return Object.fromEntries(raw.split(/\r?\n/).map((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return null
      const index = trimmed.indexOf('=')
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '')
      return [key, value]
    }).filter(Boolean))
  } catch {
    return {}
  }
}

const buildAgentRuntimePrompt = (message, agent) => {
  if (!agent) return message
  const skill = text(agent?.skillPrompt || agent?.description, 12000)
  const description = text(agent?.description, 4000)
  const mcp = agent?.mcpConfig || null
  return [
    'You are running inside Another Me.',
    'Load the selected skill/persona behavior and expose it through the chat UI.',
    'Before every answer, read the saved PROFILE.md or skill text below, consolidate it into your working memory/persona, and answer as that Agent.',
    'Follow the saved PROFILE.md, the saved user-written description, and the uploaded skill package below. If they conflict, the saved PROFILE.md has the highest priority, then the saved user-written description, then the uploaded skill package.',
    'Do not mention implementation details unless the user asks.',
    '',
    '[AGENT_PROFILE]',
    `Name: ${agent?.name || '觅见AI'}`,
    `Owner: ${agent?.owner || 'Unknown'}`,
    `Category: ${agent?.category || 'General'}`,
    `Tagline: ${agent?.tagline || ''}`,
    '',
    '[USER_DESCRIPTION]',
    description || 'No written description was provided.',
    '[/USER_DESCRIPTION]',
    '',
    '[AGENT_SKILL]',
    skill || 'No explicit skill text was provided yet. Behave as a concise, helpful Another Me agent.',
    '[/AGENT_SKILL]',
    '',
    mcp ? '[MCP_CONFIG]' : '',
    mcp ? `Name: ${mcp.name || 'Unnamed MCP'}` : '',
    mcp ? `Endpoint: ${mcp.endpoint || 'Not provided'}` : '',
    mcp ? `Purpose: ${mcp.purpose || 'Not provided'}` : '',
    mcp ? '[/MCP_CONFIG]' : '',
    mcp ? '' : '',
    '[USER_MESSAGE]',
    message,
    '[/USER_MESSAGE]',
  ].join('\n')
}

const normalizeChatHistory = (history) => {
  if (!Array.isArray(history)) return []
  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-16)
    .map((item) => ({
      role: item.role,
      content: text(item.text || item.content, 4000),
    }))
    .filter((item) => item.content)
}

const runAnotherMeChat = async (message, agent = null, history = []) => {
  const envFromFile = await readDotEnv(globalEnvFile)
  const model = envFromFile.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5'
  const apiKey = envFromFile.OPENAI_API_KEY || envFromFile.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY
  const baseUrl = (envFromFile.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
  if (!apiKey) throw new Error('缺少 OPENAI_API_KEY 或 LLM_API_KEY。')
  const runtimePrompt = buildAgentRuntimePrompt(message, agent)
  const scopedHistory = normalizeChatHistory(history)
  const priorMessages = scopedHistory.at(-1)?.role === 'user' && scopedHistory.at(-1)?.content === message
    ? scopedHistory.slice(0, -1)
    : scopedHistory
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are 觅见AI. Use only the current conversation history provided in this request. Do not infer or remember content from other chat windows. Reply concisely and do not mention implementation details.' },
        ...priorMessages,
        { role: 'user', content: runtimePrompt },
      ],
    }),
    signal: controller.signal,
  })
  clearTimeout(timeout)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || `模型接口返回 ${response.status}`
    throw new Error(sanitizeAssistantOutput(detail))
  }
  const output = data?.choices?.[0]?.message?.content
  return { output: sanitizeAssistantOutput(output || '') }
}

const sanitizeAssistantOutput = (value) => String(value || '')
  .replaceAll('EvoScientist', 'Another Me')
  .replaceAll('EvoSci', 'Another Me')
  .replaceAll('evosci', 'Another Me')
  .replaceAll('viberesearch', 'Another Me')
  .replaceAll(vibeResearchRoot, 'Another Me')

const extractAssistantReply = (raw) => {
  const normalized = sanitizeAssistantOutput(raw).replace(/\r/g, '')
  const lines = normalized.split('\n')
  const separatorIndexes = lines
    .map((line, index) => (/^[─━-]{20,}$/.test(line.trim()) ? index : -1))
    .filter((index) => index >= 0)
  let start = separatorIndexes.length >= 2 ? separatorIndexes[1] + 1 : 0
  while (start < lines.length && /^(Thread:|Workspace:|\s*$)/.test(lines[start])) start += 1
  const body = []
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^\s*\[Usage:/.test(line)) break
    if (/^npm error\b/.test(line)) break
    if (/^╭─/.test(line)) break
    if (/^\[Error\]/.test(line)) break
    body.push(line)
  }
  const cleaned = body.join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cleaned || normalized
}

const defaultUploadedAgents = [
  {
    id: 'local-demo-research-agent',
    name: 'Research Buddy Agent',
    owner: 'Local Demo',
    tagline: 'A sample uploaded agent that other users can open.',
    description: 'Summarizes papers, drafts outreach, and answers questions from a hosted chat endpoint.',
    chatUrl: 'https://example.com/agent-chat',
    apiUrl: '',
    demoVideoUrl: '',
    category: 'Research',
    created_at: new Date().toISOString(),
  },
]

const loadUploadedAgents = async () => {
  try {
    return JSON.parse(await fs.readFile(agentsFile, 'utf8'))
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(agentsFile, JSON.stringify(defaultUploadedAgents, null, 2))
    return defaultUploadedAgents
  }
}

const saveUploadedAgents = async (agents) => {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(agentsFile, JSON.stringify(agents, null, 2))
}

const loadJsonFile = async (file, fallback) => {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(file, JSON.stringify(fallback, null, 2))
    return fallback
  }
}

const saveJsonFile = async (file, value) => {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(file, JSON.stringify(value, null, 2))
}

const safeFileName = (value, fallback = 'skill.zip') => {
  const cleaned = path.basename(String(value || '')).replace(/[^a-zA-Z0-9._-]/g, '_')
  return cleaned || fallback
}

const execFileAsync = (command, args, options = {}) => new Promise((resolve, reject) => {
  execFile(command, args, options, (error, stdout, stderr) => {
    if (error) {
      error.message = `${error.message}\n${stderr || stdout || ''}`.trim()
      reject(error)
      return
    }
    resolve({ stdout, stderr })
  })
})

const walkFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  const files = []
  for (const entry of entries) {
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walkFiles(target))
    } else if (entry.isFile()) {
      files.push(target)
    }
  }
  return files
}

const readExtractedSkillText = async (extractDir) => {
  const files = await walkFiles(extractDir)
  const allowed = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.py', '.js', '.ts', '.tsx', '.jsx'])
  const prioritized = [
    ...files.filter((file) => path.basename(file).toLowerCase() === 'skill.md'),
    ...files.filter((file) => path.basename(file).toLowerCase() !== 'skill.md' && allowed.has(path.extname(file).toLowerCase())),
  ]
  const chunks = []
  let used = 0
  for (const file of prioritized) {
    if (used >= 16000) break
    const stat = await fs.stat(file).catch(() => null)
    if (!stat || stat.size > 512 * 1024) continue
    const relative = path.relative(extractDir, file)
    const content = await fs.readFile(file, 'utf8').catch(() => '')
    if (!content.trim()) continue
    const slice = content.slice(0, Math.max(0, 16000 - used))
    chunks.push(`## ${relative}\n${slice}`)
    used += slice.length
  }
  return chunks.join('\n\n').trim()
}

const saveAndExtractSkillZip = async (agentId, body) => {
  const encoded = text(body.skillZipBase64, 50 * 1024 * 1024)
  if (!encoded) return null
  const skillRoot = path.join(moduleSkillDir, agentId)
  const zipPath = path.join(skillRoot, safeFileName(body.skillZipName))
  const extractDir = path.join(skillRoot, 'extracted')
  await fs.rm(skillRoot, { recursive: true, force: true })
  await fs.mkdir(extractDir, { recursive: true })
  await fs.writeFile(zipPath, Buffer.from(encoded, 'base64'))
  await execFileAsync('unzip', ['-qq', '-o', zipPath, '-d', extractDir])
  const extractedText = await readExtractedSkillText(extractDir)
  return {
    zipPath,
    extractDir,
    extractedText,
  }
}

const makeUploadedAgent = (body) => ({
  id: crypto.randomUUID(),
  name: text(body.name, 80),
  owner: text(body.owner, 80),
  tagline: text(body.tagline, 160),
  description: text(body.description, 1200),
  chatUrl: text(body.chatUrl, 400),
  apiUrl: text(body.apiUrl, 400),
  demoVideoUrl: text(body.demoVideoUrl, 400),
  category: text(body.category, 80) || 'General',
  created_at: new Date().toISOString(),
})

const makeModuleAgent = (body) => ({
  ...makeUploadedAgent(body),
  repoUrl: text(body.repoUrl, 400),
  eventName: text(body.eventName, 120),
  skillPrompt: text(body.skillPrompt, 24000),
  runtimeType: text(body.runtimeType, 80) || 'skill-runtime',
  status: text(body.status, 80) || 'submitted',
  mcpConfig: body.mcpConfig && typeof body.mcpConfig === 'object' ? {
    name: text(body.mcpConfig.name, 120),
    endpoint: text(body.mcpConfig.endpoint, 400),
    purpose: text(body.mcpConfig.purpose, 1200),
  } : null,
})

const makeAvatarProfile = (body) => {
  const agentName = text(body.agentName, 80)
  const role = text(body.role, 120)
  const personality = text(body.personality, 500)
  const visualStyle = text(body.visualStyle, 500)
  const color = text(body.color, 80)
  return {
    id: crypto.randomUUID(),
    agentName,
    role,
    personality,
    visualStyle,
    color,
    prompt: `Create a virtual avatar for ${agentName}: ${role}. Personality: ${personality}. Visual style: ${visualStyle}. Color direction: ${color}.`,
    created_at: new Date().toISOString(),
  }
}

const mockApi = async (req, res, requestUrl) => {
  if (!requestUrl.pathname.startsWith('/api/')) return false
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return true
  }

  const pathName = requestUrl.pathname
  if (await handleAuthApi(req, res, pathName)) return true
  if (await handleSportsApi(req, res, requestUrl)) return true

  const now = new Date().toISOString()
  const merchant = {
    id: 'local-merchant',
    api_key: 'local_demo_merchant_key',
    company_name: 'Xuanming Liu',
    name: 'Xuanming Liu',
    email: 'demo@anotherme.local',
    role: 'merchant',
    balance: 0,
    credit_balance: 0,
    credits: 0,
    created_at: now,
  }
  const dashboard = {
    merchant,
    credit: 0,
    balance: 0,
    platform_credit: 0,
    active_tasks: 0,
    activeTasks: 0,
    active_competitions: 0,
    valid_submissions: 0,
    submissions: 0,
    total_spent: 0,
    spent: 0,
    tasks: [],
    personal_tasks: [],
    competitions: [],
    collabs: [],
    bounties: [],
    offers: [],
    notifications: [],
    activity: [],
    stats: { active_tasks: 0, valid_submissions: 0, total_spent: 0 },
  }

  if (pathName === '/api/module-agent-launch/chat' && req.method === 'POST') {
    const startedAt = Date.now()
    try {
      const body = await readJsonBody(req)
      const message = text(body.message, 8000)
      if (!message) return json(res, { error: 'message is required' }, 400)
      const agentId = text(body.agentId, 120)
      const agents = agentId ? await loadJsonFile(moduleAgentsFile, []) : []
      const agent = agentId ? agents.find((item) => item.id === agentId) : null
      if (agentId && !agent) return json(res, { error: 'agent not found' }, 404)
      console.log(`[agent-launch/chat] start agent=${agent?.name || '觅见AI'} agentId=${agentId || 'default'} history=${Array.isArray(body.history) ? body.history.length : 0}`)
      const result = await runAnotherMeChat(message, agent, body.history)
      console.log(`[agent-launch/chat] ok agent=${agent?.name || '觅见AI'} elapsed=${Date.now() - startedAt}ms`)
      return json(res, {
        output: result.output,
      })
    } catch (error) {
      console.error(`[agent-launch/chat] error elapsed=${Date.now() - startedAt}ms`, error)
      return json(res, {
        error: sanitizeAssistantOutput(error instanceof Error ? error.message : '聊天助手调用失败'),
      }, 500)
    }
  }
  if (pathName === '/api/module-agent-launch/agents' && req.method === 'GET') {
    const fallback = defaultUploadedAgents.map((agent) => ({ ...agent, repoUrl: '', eventName: 'Local Hackathon', status: 'demo' }))
    return json(res, await loadJsonFile(moduleAgentsFile, fallback))
  }
  if (pathName === '/api/module-agent-launch/agents' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      const agent = makeModuleAgent(body)
      if (agent.status === 'published' && (!agent.owner || !agent.description)) {
        return json(res, { error: 'owner and description are required before publishing' }, 400)
      }
      if (!agent.name) agent.name = '觅见AI'
      if (!agent.owner) agent.owner = '未填写'
      if (!agent.description) agent.description = ''
      if (body.skillZipBase64) {
        const extracted = await saveAndExtractSkillZip(agent.id, body)
        agent.skillZipName = text(body.skillZipName, 240)
        agent.skillZipPath = extracted?.zipPath || ''
        agent.skillExtractDir = extracted?.extractDir || ''
        agent.skillExtracted = Boolean(extracted?.extractedText)
        agent.skillPrompt = [
          agent.skillPrompt,
          '',
          '# Extracted Skill Package',
          extracted?.extractedText || 'No readable text files were found in the uploaded skill package.',
        ].join('\n').trim()
      }
      const agents = await loadJsonFile(moduleAgentsFile, [])
      const nextAgents = [agent, ...agents].slice(0, 200)
      await saveJsonFile(moduleAgentsFile, nextAgents)
      return json(res, agent, 201)
    } catch {
      return json(res, { error: 'Invalid JSON body' }, 400)
    }
  }
  if (pathName.startsWith('/api/module-agent-launch/agents/') && req.method === 'PATCH') {
    try {
      const agentId = text(pathName.split('/').pop(), 120)
      const body = await readJsonBody(req)
      const agents = await loadJsonFile(moduleAgentsFile, [])
      const index = agents.findIndex((agent) => agent.id === agentId)
      if (index < 0) return json(res, { error: 'agent not found' }, 404)
      const previous = agents[index]
      const next = {
        ...previous,
        name: text(body.name, 80) || previous.name,
        owner: text(body.owner, 80) || previous.owner,
        tagline: text(body.tagline, 160),
        description: text(body.description, 1200) || previous.description,
        category: text(body.category, 80) || previous.category,
        skillPrompt: text(body.skillPrompt, 24000) || previous.skillPrompt,
        status: text(body.status, 80) || previous.status,
        mcpConfig: body.mcpConfig && typeof body.mcpConfig === 'object' ? {
          name: text(body.mcpConfig.name, 120),
          endpoint: text(body.mcpConfig.endpoint, 400),
          purpose: text(body.mcpConfig.purpose, 1200),
        } : previous.mcpConfig || null,
        updated_at: new Date().toISOString(),
      }
      if (body.skillZipBase64) {
        const extracted = await saveAndExtractSkillZip(next.id, body)
        next.skillZipName = text(body.skillZipName, 240)
        next.skillZipPath = extracted?.zipPath || ''
        next.skillExtractDir = extracted?.extractDir || ''
        next.skillExtracted = Boolean(extracted?.extractedText)
        next.skillPrompt = [
          next.skillPrompt,
          '',
          '# Extracted Skill Package',
          extracted?.extractedText || 'No readable text files were found in the uploaded skill package.',
        ].join('\n').trim()
      }
      agents[index] = next
      await saveJsonFile(moduleAgentsFile, agents)
      return json(res, next)
    } catch {
      return json(res, { error: 'Invalid JSON body' }, 400)
    }
  }
  if (pathName === '/api/module-avatar/profiles' && req.method === 'GET') return json(res, await loadJsonFile(avatarProfilesFile, []))
  if (pathName === '/api/module-avatar/profiles' && req.method === 'POST') {
    try {
      const profile = makeAvatarProfile(await readJsonBody(req))
      if (!profile.agentName || !profile.role || !profile.personality || !profile.visualStyle) {
        return json(res, { error: 'agentName, role, personality, and visualStyle are required' }, 400)
      }
      const profiles = await loadJsonFile(avatarProfilesFile, [])
      const nextProfiles = [profile, ...profiles].slice(0, 200)
      await saveJsonFile(avatarProfilesFile, nextProfiles)
      return json(res, profile, 201)
    } catch {
      return json(res, { error: 'Invalid JSON body' }, 400)
    }
  }
  if (pathName === '/api/module-social/conversations' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      const agents = await loadJsonFile(moduleAgentsFile, [])
      const a = agents.find((agent) => agent.id === body.agentA)
      const b = agents.find((agent) => agent.id === body.agentB)
      const topic = text(body.topic, 500)
      if (!a || !b || !topic) return json(res, { error: 'agentA, agentB, and topic are required' }, 400)
      const item = {
        id: crypto.randomUUID(),
        agentA: a.id,
        agentB: b.id,
        topic,
        report: {
          match: `${a.name} x ${b.name}`,
          topic,
          summary: `${a.name} should lead context gathering. ${b.name} should challenge assumptions and produce a next-step checklist.`,
          suggested_next_steps: ['Open both agent chat URLs', 'Run a 5-minute scoped conversation', 'Save outputs into the project room'],
          open_urls: [a.chatUrl, b.chatUrl].filter(Boolean),
        },
        created_at: new Date().toISOString(),
      }
      const conversations = await loadJsonFile(socialConversationsFile, [])
      await saveJsonFile(socialConversationsFile, [item, ...conversations].slice(0, 200))
      return json(res, item, 201)
    } catch {
      return json(res, { error: 'Invalid JSON body' }, 400)
    }
  }
  if (pathName === '/api/uploaded-agents' && req.method === 'GET') return json(res, await loadUploadedAgents())
  if (pathName === '/api/uploaded-agents' && req.method === 'POST') {
    try {
      const agent = makeUploadedAgent(await readJsonBody(req))
      if (!agent.name || !agent.owner || !agent.description || !agent.chatUrl) {
        return json(res, { error: 'name, owner, description, and chatUrl are required' }, 400)
      }
      const agents = await loadUploadedAgents()
      const nextAgents = [agent, ...agents].slice(0, 200)
      await saveUploadedAgents(nextAgents)
      return json(res, agent, 201)
    } catch {
      return json(res, { error: 'Invalid JSON body' }, 400)
    }
  }
  if (pathName.includes('/auth/') || pathName.endsWith('/me') || pathName.includes('/profile')) return json(res, merchant)
  if (pathName.includes('/showcase/')) return json(res, {
    title: 'Local demo',
    featured: false,
    hero: [
      { label: 'Active', value: 0 },
      { label: 'Submissions', value: 0 },
      { label: 'Spent', value: '—' },
    ],
    bars: [],
    items: [],
  })
  if (pathName.includes('/dashboard')) return json(res, dashboard)
  if (pathName.includes('/stats')) return json(res, { agents: 133931, earned: 44989, totalRewards: 0 })
  if (pathName.includes('/search')) return json(res, [])
  if (pathName.includes('/notifications')) return json(res, [])
  if (pathName.includes('/tasks') || pathName.includes('/quests') || pathName.includes('/offers') || pathName.includes('/bounties') || pathName.includes('/submissions') || pathName.includes('/engagements')) return json(res, [])
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') return json(res, { ok: true, id: 'local-demo', created_at: now })
  return json(res, {})
}

const exists = async (target) => {
  try {
    const stat = await fs.stat(target)
    return stat.isFile()
  } catch {
    return false
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://localhost:${port}`)
  if (await mockApi(req, res, requestUrl)) return
  const decodedPath = decodeURIComponent(requestUrl.pathname)

  if (decodedPath.startsWith('/module-parts/')) {
    const modulePartPath = decodedPath.replace(/^\/module-parts\/?/, '')
    const safeModulePartPath = path.normalize(modulePartPath).replace(/^\/+/, '')
    const target = path.join(modulePartsRoot, safeModulePartPath)
    if (!target.startsWith(modulePartsRoot) || !(await exists(target))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    const ext = path.extname(target)
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' })
    createReadStream(target).pipe(res)
    return
  }

  if (decodedPath === '/modules/agent-launch') {
    const target = path.join(modulePartsRoot, '01-agent-launch', 'page.html')
    if (!(await exists(target))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': mime['.html'] })
    createReadStream(target).pipe(res)
    return
  }

  if (decodedPath === '/modules' || decodedPath.startsWith('/modules/')) {
    const modulePath = decodedPath.replace(/^\/modules\/?/, '')
    const safeModulePath = path.normalize(modulePath).replace(/^\/+/, '')
    let target = path.join(modulesRoot, safeModulePath || 'index.html')
    if (!(await exists(target))) {
      const htmlTarget = path.join(modulesRoot, `${safeModulePath}.html`)
      target = (await exists(htmlTarget)) ? htmlTarget : path.join(modulesRoot, 'index.html')
    }
    if (!target.startsWith(modulesRoot) || !(await exists(target))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    const ext = path.extname(target)
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' })
    createReadStream(target).pipe(res)
    return
  }

  const safePath = path.normalize(decodedPath).replace(/^\/+/, '')
  let target = path.join(root, safePath)

  if (decodedPath === '/' || decodedPath === '') {
    target = path.join(root, 'index.html')
  } else if (!(await exists(target))) {
    const htmlTarget = path.join(root, `${safePath}.html`)
    target = (await exists(htmlTarget)) ? htmlTarget : path.join(root, 'index.html')
  }

  if (!target.startsWith(root) || !(await exists(target))) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
  }

  const ext = path.extname(target)
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' })
  createReadStream(target).pipe(res)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Local mirror running at http://localhost:${port}`)
  console.log(`Serving: ${root}`)
})
