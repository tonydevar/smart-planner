'use strict';

const { Router }    = require('express');
const { randomUUID } = require('crypto');
const db             = require('../db/database');

const router = Router();

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['explore', 'learn', 'build', 'integrate', 'office-hours', 'other'];
const PRIORITY_RANK  = { high: 0, medium: 1, low: 2 };
const START_SLOT     = 32;   // 08:00 (32 × 15 min)
const MAX_SLOT       = 95;   // 23:45

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Join a schedule_slots row with its task data.
 * Returns the row augmented with a `task` object (or null).
 */
const SLOT_JOIN_SQL = `
  SELECT
    ss.id, ss.date, ss.slot_index, ss.record_type, ss.task_id, ss.label,
    t.name        AS task_name,
    t.description AS task_description,
    t.category    AS task_category
  FROM schedule_slots ss
  LEFT JOIN tasks t ON t.id = ss.task_id
  WHERE ss.date = ? AND ss.record_type = ?
  ORDER BY ss.slot_index ASC
`;

function formatSlots(rows) {
  return rows.map(r => ({
    id:          r.id,
    date:        r.date,
    slot_index:  r.slot_index,
    record_type: r.record_type,
    task_id:     r.task_id,
    label:       r.label,
    task: r.task_id ? {
      name:        r.task_name,
      description: r.task_description,
      category:    r.task_category,
    } : null,
  }));
}

// ─── POST /api/schedule/generate ────────────────────────────────────────────

router.post('/generate', (req, res) => {
  const { date } = req.body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
  }

  // 1. Load allotments from config
  const configRow  = db.prepare("SELECT value FROM config WHERE key = 'allotments'").get();
  const allotments = configRow ? JSON.parse(configRow.value) : {};

  // 2. Load all incomplete tasks
  const tasks = db.prepare(
    'SELECT * FROM tasks WHERE completed = 0 ORDER BY created_at ASC'
  ).all();

  // 3. Group tasks by category
  const byCategory = {};
  for (const cat of CATEGORY_ORDER) byCategory[cat] = [];
  for (const task of tasks) {
    if (byCategory[task.category]) {
      byCategory[task.category].push(task);
    } else {
      byCategory['other'].push(task);
    }
  }

  // 4. Sort each group: high → medium → low, then created_at ASC (already in created_at ASC order)
  for (const cat of CATEGORY_ORDER) {
    byCategory[cat].sort((a, b) => {
      const pd = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pd !== 0) return pd;
      // created_at ASC — tasks were loaded in this order already; preserve stability
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
    });
  }

  // 5. Fill slots
  const slots = [];     // { slot_index, task_id, label }
  let currentSlot = START_SLOT;

  for (const cat of CATEGORY_ORDER) {
    const catTasks   = byCategory[cat];
    const allottedMs = allotments[cat] ?? 0;
    let   capSlots   = Math.ceil(allottedMs / 15);   // slots this category may consume

    if (capSlots <= 0 || catTasks.length === 0) continue;

    for (const task of catTasks) {
      if (capSlots <= 0 || currentSlot > MAX_SLOT) break;

      const taskSlots  = Math.ceil((task.estimated_minutes || 15) / 15);
      const toSchedule = Math.min(taskSlots, capSlots, MAX_SLOT - currentSlot + 1);

      for (let i = 0; i < toSchedule; i++) {
        slots.push({
          slot_index: currentSlot + i,
          task_id:    task.id,
          label:      toSchedule < taskSlots ? task.name + ' [cont.]' : null,
        });
      }

      currentSlot += toSchedule;
      capSlots    -= toSchedule;
    }
  }

  // 6. Persist — delete existing planned rows then bulk-insert inside a transaction
  const insert = db.prepare(`
    INSERT INTO schedule_slots (id, date, slot_index, record_type, task_id, label)
    VALUES (?, ?, ?, 'planned', ?, ?)
  `);

  db.transaction(() => {
    db.prepare(
      "DELETE FROM schedule_slots WHERE date = ? AND record_type = 'planned'"
    ).run(date);

    for (const s of slots) {
      insert.run(randomUUID(), date, s.slot_index, s.task_id, s.label);
    }
  })();

  // 7. Return the inserted slots joined with task data
  const rows = db.prepare(SLOT_JOIN_SQL).all(date, 'planned');
  return res.json({ slots: formatSlots(rows) });
});

// ─── GET /api/schedule?date=YYYY-MM-DD ──────────────────────────────────────

router.get('/', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });

  const planned = db.prepare(SLOT_JOIN_SQL).all(date, 'planned');
  const actual  = db.prepare(SLOT_JOIN_SQL).all(date, 'actual');

  return res.json({
    planned: formatSlots(planned),
    actual:  formatSlots(actual),
  });
});

// ─── DELETE /api/schedule?date=YYYY-MM-DD ───────────────────────────────────

router.delete('/', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });

  const result = db.prepare(
    "DELETE FROM schedule_slots WHERE date = ? AND record_type = 'planned'"
  ).run(date);

  return res.json({ deleted: result.changes });
});

// ─── PUT /api/schedule/slots ─────────────────────────────────────────────────

router.put('/slots', (req, res) => {
  const {
    date,
    slot_index,
    record_type = 'planned',
    task_id     = null,
    label       = null,
  } = req.body;

  if (!date || slot_index === undefined) {
    return res.status(400).json({ error: 'date and slot_index are required' });
  }
  if (!['planned', 'actual'].includes(record_type)) {
    return res.status(400).json({ error: 'record_type must be planned or actual' });
  }

  // Upsert by (date, slot_index, record_type)
  const existing = db.prepare(
    'SELECT id FROM schedule_slots WHERE date = ? AND slot_index = ? AND record_type = ?'
  ).get(date, slot_index, record_type);

  if (existing) {
    db.prepare(
      `UPDATE schedule_slots SET task_id = ?, label = ?
       WHERE date = ? AND slot_index = ? AND record_type = ?`
    ).run(task_id, label, date, slot_index, record_type);
  } else {
    db.prepare(
      `INSERT INTO schedule_slots (id, date, slot_index, record_type, task_id, label)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), date, slot_index, record_type, task_id, label);
  }

  const row = db.prepare(`
    SELECT
      ss.id, ss.date, ss.slot_index, ss.record_type, ss.task_id, ss.label,
      t.name AS task_name, t.description AS task_description, t.category AS task_category
    FROM schedule_slots ss
    LEFT JOIN tasks t ON t.id = ss.task_id
    WHERE ss.date = ? AND ss.slot_index = ? AND ss.record_type = ?
  `).get(date, slot_index, record_type);

  return res.json({
    id:          row.id,
    date:        row.date,
    slot_index:  row.slot_index,
    record_type: row.record_type,
    task_id:     row.task_id,
    label:       row.label,
    task: row.task_id ? {
      name:        row.task_name,
      description: row.task_description,
      category:    row.task_category,
    } : null,
  });
});

module.exports = router;
