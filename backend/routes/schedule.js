'use strict';

const { Router } = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/database');

const router = Router();

// GET /api/schedule/overrides?date=YYYY-MM-DD
router.get('/overrides', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });

  const rows = db.prepare(
    'SELECT * FROM schedule_overrides WHERE date = ? ORDER BY slot_index ASC'
  ).all(date);

  res.json(rows.map(r => ({ ...r, is_actual: !!r.is_actual })));
});

// PUT /api/schedule/overrides  — upserts by (date, slot_index)
// body: { date, slot_index, task_id?, label?, is_actual? }
router.put('/overrides', (req, res) => {
  const { date, slot_index, task_id = null, label = null, is_actual = 0 } = req.body;

  if (!date || slot_index === undefined) {
    return res.status(400).json({ error: 'date and slot_index are required' });
  }

  // Check whether a row already exists
  const existing = db.prepare(
    'SELECT id FROM schedule_overrides WHERE date = ? AND slot_index = ?'
  ).get(date, slot_index);

  if (existing) {
    db.prepare(
      `UPDATE schedule_overrides
       SET task_id = ?, label = ?, is_actual = ?
       WHERE date = ? AND slot_index = ?`
    ).run(task_id, label, is_actual ? 1 : 0, date, slot_index);
  } else {
    db.prepare(
      `INSERT INTO schedule_overrides (id, date, slot_index, task_id, label, is_actual)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), date, slot_index, task_id, label, is_actual ? 1 : 0);
  }

  const row = db.prepare(
    'SELECT * FROM schedule_overrides WHERE date = ? AND slot_index = ?'
  ).get(date, slot_index);

  res.json({ ...row, is_actual: !!row.is_actual });
});

module.exports = router;
