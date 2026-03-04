'use strict';

const { Router } = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/database');

const router = Router();

// GET /api/missions
router.get('/', (_req, res) => {
  const missions = db.prepare('SELECT * FROM missions ORDER BY created_at DESC').all();
  res.json(missions);
});

// GET /api/missions/:id
router.get('/:id', (req, res) => {
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
  if (!mission) return res.status(404).json({ error: 'Mission not found' });
  res.json(mission);
});

// POST /api/missions
router.post('/', (req, res) => {
  const { name, description = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO missions (id, name, description, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, name, description, now);

  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(id);
  res.status(201).json(mission);
});

// PUT /api/missions/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM missions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Mission not found' });

  const { name, description } = req.body;
  const updates = [];
  const params  = [];

  if (name        !== undefined) { updates.push('name = ?');        params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE missions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json(db.prepare('SELECT * FROM missions WHERE id = ?').get(id));
});

// DELETE /api/missions/:id  — sets tasks.mission_id = NULL
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM missions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Mission not found' });

  // ON DELETE SET NULL handled by FK pragma — confirmed in schema
  db.prepare('DELETE FROM missions WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
