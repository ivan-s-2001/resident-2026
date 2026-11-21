-- Resident 2026: one campaign, Cloudflare D1 schema
-- Run using Cloudflare D1 SQL tooling. The GM bootstrap secret is intentionally NOT stored in Git.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('gm','player')), created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS one_campaign_gm ON users(role) WHERE role='gm';
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS characters (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters(owner_id);
CREATE TABLE IF NOT EXISTS effects (id TEXT PRIMARY KEY, character_id TEXT NOT NULL REFERENCES characters(id), kind TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', modifier INTEGER NOT NULL DEFAULT 0, visible INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_effects_character ON effects(character_id);
CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, title TEXT NOT NULL, date TEXT NOT NULL DEFAULT '', blocks TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'planned', updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, character_id TEXT, kind TEXT NOT NULL, description TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'all', created_at TEXT NOT NULL);
