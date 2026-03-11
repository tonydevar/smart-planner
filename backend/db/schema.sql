PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS missions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id                TEXT PRIMARY KEY,
  mission_id        TEXT REFERENCES missions(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  priority          TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high','medium','low')),
  category          TEXT NOT NULL DEFAULT 'other',
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  completed         INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subtasks (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  completed  INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO config (key, value) VALUES (
  'allotments',
  '{"explore":60,"learn":120,"build":180,"integrate":60,"reflect":30,"office-hours":60,"other":60}'
);

CREATE TABLE IF NOT EXISTS schedule_slots (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,
  slot_index  INTEGER NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'planned'
              CHECK(record_type IN ('planned','actual')),
  task_id     TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  label       TEXT,
  UNIQUE(date, slot_index, record_type)
);
