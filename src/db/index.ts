import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import { logger } from '../shared/logger'
import { DatabaseError } from '../shared/error'

let _db: Database.Database | null = null

// schema.sql과 동기화 유지 — 런타임에 파일 읽기 대신 임베드
const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS repositories (
  id               TEXT    PRIMARY KEY,
  name             TEXT    NOT NULL,
  platform         TEXT    NOT NULL CHECK (platform IN ('gitlab', 'github')),
  diff_source      TEXT    NOT NULL CHECK (diff_source IN ('api', 'local-git')),
  repo_url         TEXT    NOT NULL,
  local_path       TEXT,
  ai_provider      TEXT    NOT NULL DEFAULT 'claude'   CHECK (ai_provider IN ('claude', 'openai')),
  summary_language TEXT    NOT NULL DEFAULT 'ko'       CHECK (summary_language IN ('ko', 'en', 'both')),
  summary_style    TEXT    NOT NULL DEFAULT 'detailed' CHECK (summary_style IN ('detailed', 'concise', 'technical')),
  baseline_sha     TEXT,
  display_order    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS security_exclusion_rules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id    TEXT    NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  pattern    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_security_rules_repo
  ON security_exclusion_rules(repo_id);

CREATE TABLE IF NOT EXISTS release_notes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id      TEXT    NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  from_sha     TEXT    NOT NULL,
  to_sha       TEXT    NOT NULL,
  version_tag  TEXT,
  raw_diff     TEXT    NOT NULL,
  ai_draft_ko  TEXT,
  ai_draft_en  TEXT,
  edited_ko    TEXT,
  edited_en    TEXT,
  change_types TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_release_notes_repo
  ON release_notes(repo_id);

CREATE INDEX IF NOT EXISTS idx_release_notes_created
  ON release_notes(repo_id, created_at DESC);

CREATE TABLE IF NOT EXISTS global_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO global_settings (key, value) VALUES
  ('app_language',    'ko'),
  ('app_theme',       'light'),
  ('startup_launch',  'false'),
  ('webhook_enabled', 'false'),
  ('webhook_port',    '45678');
`

export function initDb(): void {
  const dbPath = join(app.getPath('userData'), 'sosik.db')
  try {
    _db = new Database(dbPath)
    _db.exec(SCHEMA)
    logger.info('DB 초기화 완료', { path: dbPath })
  } catch (err) {
    throw new DatabaseError(`DB 초기화 실패: ${err}`)
  }
}

export function getDb(): Database.Database {
  if (!_db) throw new DatabaseError('DB가 초기화되지 않았습니다')
  return _db
}
