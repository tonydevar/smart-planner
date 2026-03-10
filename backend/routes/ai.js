'use strict';

/**
 * ai.js — AI endpoints for Smart Planner
 *
 * All LLM calls are made server-side via the openrouter service.
 * The API key is never sent to the frontend.
 *
 * POST /api/ai/estimate  — estimate task duration + suggest category/subtasks
 * POST /api/ai/subtasks  — generate subtasks and persist them to DB
 */

const { Router }   = require('express');
const { randomUUID } = require('crypto');
const db           = require('../db/database');
const { estimateTask, generateSubtasksForTask } = require('../src/services/openrouter');

const router = Router();

// ─── POST /api/ai/estimate ────────────────────────────────────────────────────

/**
 * Accepts:  { name, description, category? }
 * Returns:  { estimatedMinutes, reasoning, suggestedCategory, suggestedSubtasks, fallback? }
 */
router.post('/estimate', async (req, res) => {
  const { name = '', description = '', category = '' } = req.body;

  const result = await estimateTask({ name, description, category });
  return res.json(result);
});

// ─── POST /api/ai/subtasks ────────────────────────────────────────────────────

/**
 * Accepts:  { taskId, name, description, category }
 * Returns:  { subtasks: [{ id, task_id, name, completed, sort_order }], fallback? }
 *
 * Persists generated subtasks to the database. Skips names already present
 * (avoids duplicates if called multiple times on the same task).
 */
router.post('/subtasks', async (req, res) => {
  const { taskId, name = '', description = '', category = 'other' } = req.body;

  // Validate taskId if provided
  if (taskId) {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
  }

  const { subtasks: generated, fallback } = await generateSubtasksForTask({ name, description, category });

  if (!taskId) {
    // No taskId supplied — just return the suggestions without persisting
    const response = { subtasks: generated };
    if (fallback) response.fallback = true;
    return res.json(response);
  }

  // Persist to DB (skip duplicates by name, case-insensitive)
  const existing = db.prepare(
    'SELECT name FROM subtasks WHERE task_id = ?'
  ).all(taskId).map(s => s.name.toLowerCase());

  const maxOrderRow = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) AS max FROM subtasks WHERE task_id = ?'
  ).get(taskId);

  let sortOrder = maxOrderRow.max + 1;

  const insert = db.prepare(
    'INSERT INTO subtasks (id, task_id, name, completed, sort_order) VALUES (?, ?, ?, 0, ?)'
  );

  const created = [];
  const insertAll = db.transaction(() => {
    for (const s of generated) {
      if (existing.includes(s.name.toLowerCase())) continue;
      const sid = randomUUID();
      insert.run(sid, taskId, s.name, sortOrder++);
      created.push(db.prepare('SELECT * FROM subtasks WHERE id = ?').get(sid));
    }
  });
  insertAll();

  const response = {
    subtasks: created.map(s => ({ ...s, completed: !!s.completed })),
  };
  if (fallback) response.fallback = true;

  return res.json(response);
});

module.exports = router;
