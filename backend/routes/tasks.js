'use strict';

const { Router } = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/database');

const router = Router();

// ─── helpers ────────────────────────────────────────────────────────────────

function getSubtasks(taskId) {
  return db.prepare(
    'SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order ASC, rowid ASC'
  ).all(taskId);
}

function getTask(id) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return null;
  task.subtasks = getSubtasks(id);
  task.completed = !!task.completed;
  task.subtasks = task.subtasks.map(s => ({ ...s, completed: !!s.completed }));
  return task;
}

function getAllTasks() {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  return tasks.map(t => ({ ...t, completed: !!t.completed, subtasks: getSubtasks(t.id).map(s => ({ ...s, completed: !!s.completed })) }));
}

// ─── tasks CRUD ─────────────────────────────────────────────────────────────

// GET /api/tasks
router.get('/', (_req, res) => {
  res.json(getAllTasks());
});

// GET /api/tasks/:id
router.get('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST /api/tasks
router.post('/', (req, res) => {
  const {
    name,
    description = '',
    priority = 'medium',
    category = 'other',
    estimated_minutes = 30,
    completed = 0,
    mission_id = null,
    subtasks: incomingSubtasks = [],
  } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO tasks (id, mission_id, name, description, priority, category, estimated_minutes, completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, mission_id, name, description, priority, category, estimated_minutes, completed ? 1 : 0, now, now);

  // Insert subtasks if provided
  const insertSubtask = db.prepare(
    'INSERT INTO subtasks (id, task_id, name, completed, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  incomingSubtasks.forEach((s, i) => {
    insertSubtask.run(randomUUID(), id, s.name, s.completed ? 1 : 0, i);
  });

  res.status(201).json(getTask(id));
});

// PUT /api/tasks/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const {
    name,
    description,
    priority,
    category,
    estimated_minutes,
    completed,
    mission_id,
  } = req.body;

  const updates = [];
  const params  = [];

  if (name              !== undefined) { updates.push('name = ?');               params.push(name); }
  if (description       !== undefined) { updates.push('description = ?');        params.push(description); }
  if (priority          !== undefined) { updates.push('priority = ?');            params.push(priority); }
  if (category          !== undefined) { updates.push('category = ?');            params.push(category); }
  if (estimated_minutes !== undefined) { updates.push('estimated_minutes = ?');   params.push(estimated_minutes); }
  if (completed         !== undefined) { updates.push('completed = ?');            params.push(completed ? 1 : 0); }
  if (mission_id        !== undefined) { updates.push('mission_id = ?');           params.push(mission_id); }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json(getTask(id));
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  // Subtasks are cascade-deleted by SQLite FK constraint
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ success: true });
});

// ─── subtasks ────────────────────────────────────────────────────────────────

// POST /api/tasks/:id/subtasks
router.post('/:id/subtasks', (req, res) => {
  const { id: taskId } = req.params;
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { name, completed = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) AS max FROM subtasks WHERE task_id = ?'
  ).get(taskId).max;

  const sid = randomUUID();
  db.prepare(
    'INSERT INTO subtasks (id, task_id, name, completed, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(sid, taskId, name, completed ? 1 : 0, maxOrder + 1);

  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(sid);
  res.status(201).json({ ...subtask, completed: !!subtask.completed });
});

// PUT /api/tasks/:id/subtasks/:sid
router.put('/:id/subtasks/:sid', (req, res) => {
  const { id: taskId, sid } = req.params;
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ? AND task_id = ?').get(sid, taskId);
  if (!subtask) return res.status(404).json({ error: 'Subtask not found' });

  const { name, completed, sort_order } = req.body;
  const updates = [];
  const params  = [];

  if (name       !== undefined) { updates.push('name = ?');       params.push(name); }
  if (completed  !== undefined) { updates.push('completed = ?');   params.push(completed ? 1 : 0); }
  if (sort_order !== undefined) { updates.push('sort_order = ?');  params.push(sort_order); }

  if (updates.length > 0) {
    params.push(sid);
    db.prepare(`UPDATE subtasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(sid);
  res.json({ ...updated, completed: !!updated.completed });
});

// DELETE /api/tasks/:id/subtasks/:sid
router.delete('/:id/subtasks/:sid', (req, res) => {
  const { id: taskId, sid } = req.params;
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ? AND task_id = ?').get(sid, taskId);
  if (!subtask) return res.status(404).json({ error: 'Subtask not found' });

  db.prepare('DELETE FROM subtasks WHERE id = ?').run(sid);
  res.json({ success: true });
});

module.exports = router;
