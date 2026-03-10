'use strict';

const { Router } = require('express');
const db = require('../db/database');

const router = Router();

// GET /api/config  — returns { allotments: { ... } }
router.get('/', (_req, res) => {
  const row = db.prepare("SELECT value FROM config WHERE key = 'allotments'").get();
  const allotments = row ? JSON.parse(row.value) : {};
  res.json({ allotments });
});

// PUT /api/config  — body: { allotments: { ... } }
router.put('/', (req, res) => {
  const { allotments } = req.body;
  if (!allotments || typeof allotments !== 'object') {
    return res.status(400).json({ error: 'allotments object is required' });
  }

  db.prepare(
    "INSERT INTO config (key, value) VALUES ('allotments', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(JSON.stringify(allotments));

  res.json({ allotments });
});

// GET /api/config/allotments — returns { allotments: { ... } } (convenience alias)
router.get('/allotments', (_req, res) => {
  const row = db.prepare("SELECT value FROM config WHERE key = 'allotments'").get();
  const allotments = row ? JSON.parse(row.value) : {};
  res.json({ allotments });
});

// PUT /api/config/allotments — body: { explore:60, learn:120, ... }
router.put('/allotments', (req, res) => {
  // Accept either { allotments: {...} } or the allotments object directly
  const allotments = req.body.allotments ?? req.body;
  if (!allotments || typeof allotments !== 'object') {
    return res.status(400).json({ error: 'allotments object is required' });
  }

  db.prepare(
    "INSERT INTO config (key, value) VALUES ('allotments', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(JSON.stringify(allotments));

  res.json({ allotments });
});

module.exports = router;
