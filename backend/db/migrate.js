'use strict';

/**
 * Idempotent migration runner.
 * Uses PRAGMA user_version to track applied migrations.
 * Safe to call on every server startup.
 */
function runMigration(db) {
  let version = db.pragma('user_version', { simple: true });

  // ─── Migration 1: Remove 'reflect' category from tasks table ───────────────
  if (version < 1) {
    db.exec(`
      CREATE TABLE tasks_new (
        id                TEXT PRIMARY KEY,
        mission_id        TEXT REFERENCES missions(id) ON DELETE SET NULL,
        name              TEXT NOT NULL,
        description       TEXT NOT NULL DEFAULT '',
        priority          TEXT NOT NULL DEFAULT 'medium'
                          CHECK(priority IN ('high','medium','low')),
        category          TEXT NOT NULL DEFAULT 'other'
                          CHECK(category IN ('explore','learn','build','integrate','office-hours','other')),
        estimated_minutes INTEGER NOT NULL DEFAULT 30,
        completed         INTEGER NOT NULL DEFAULT 0,
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO tasks_new
        SELECT
          id, mission_id, name, description, priority,
          CASE WHEN category = 'reflect' THEN 'other' ELSE category END,
          estimated_minutes, completed, created_at, updated_at
        FROM tasks;

      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;
    `);

    // Remove 'reflect' from stored allotments config
    const row = db.prepare("SELECT value FROM config WHERE key = 'allotments'").get();
    if (row) {
      const allotments = JSON.parse(row.value);
      delete allotments.reflect;
      db.prepare(
        "UPDATE config SET value = ? WHERE key = 'allotments'"
      ).run(JSON.stringify(allotments));
    }

    db.pragma('user_version = 1');
    version = 1;
  }

  // ─── Migration 2: Replace schedule_overrides with schedule_slots ────────────
  if (version < 2) {
    // Create the new table
    db.exec(`
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
    `);

    // Migrate existing data from schedule_overrides if the table still exists
    const hasOverrides = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schedule_overrides'"
    ).get();

    if (hasOverrides) {
      db.exec(`
        INSERT OR IGNORE INTO schedule_slots (id, date, slot_index, record_type, task_id, label)
          SELECT id, date, slot_index, 'planned', task_id, label
          FROM schedule_overrides;

        DROP TABLE schedule_overrides;
      `);
    }

    db.pragma('user_version = 2');
  }
}

module.exports = { runMigration };
