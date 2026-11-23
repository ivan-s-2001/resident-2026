-- Resident 2026 / Master-sourced shared catalog (Cloudflare D1)
-- Do not commit the master's campaign text as seed data in a public repository.
CREATE TABLE IF NOT EXISTS catalog_entries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('weapon_ranged','weapon_melee','consumable','armor','skill','ability','item')),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  cost INTEGER NOT NULL DEFAULT 0 CHECK(cost BETWEEN 0 AND 21),
  payload TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catalog_entries_category_title ON catalog_entries(category,title);
