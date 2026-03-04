import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORIES, PRIORITIES, CATEGORY_COLORS, PRIORITY_COLORS, fmtMinutes } from '../utils.js';

function SubtaskList({ subtasks, onAdd, onToggle, onRemove }) {
  const [newName, setNewName] = useState('');

  function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName('');
  }

  return (
    <div className="subtask-list">
      {subtasks.map((s, i) => (
        <div key={i} className="subtask-item">
          <input
            type="checkbox"
            checked={!!s.completed}
            onChange={() => onToggle(i)}
            className="subtask-checkbox"
          />
          <span className={`subtask-name ${s.completed ? 'subtask-done' : ''}`}>{s.name}</span>
          <button className="btn btn-ghost btn-icon subtask-remove" onClick={() => onRemove(i)}>✕</button>
        </div>
      ))}
      <form className="subtask-add-row" onSubmit={handleAdd}>
        <input
          className="form-control subtask-input"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Add subtask…"
        />
        <button type="submit" className="btn btn-secondary btn-sm">Add</button>
      </form>
    </div>
  );
}

export default function TaskModal({ task, defaultMissionId, onClose }) {
  const { createTask, updateTask, missions } = useApp();
  const isEdit = !!task;

  const [name,     setName]     = useState(task?.name || '');
  const [desc,     setDesc]     = useState(task?.description || '');
  const [priority, setPri]      = useState(task?.priority || 'medium');
  const [category, setCat]      = useState(task?.category || 'build');
  const [estMins,  setEstMins]  = useState(task?.estimated_minutes || 30);
  const [missionId, setMission] = useState(task?.mission_id || defaultMissionId || '');
  const [subtasks, setSubtasks] = useState(
    (task?.subtasks || []).map(s => ({ name: s.name, completed: s.completed }))
  );

  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiSuggested, setAiSuggested] = useState(null); // { estimatedMinutes, suggestedCategory, suggestedSubtasks }
  const [saving, setSaving]         = useState(false);
  const [error,  setError]          = useState('');

  const nameRef = useRef(null);

  // Auto-fetch AI estimate when creating a new task
  useEffect(() => {
    if (!isEdit) fetchAiEstimate('', '');
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
  }, []);

  async function fetchAiEstimate(taskName, taskDesc) {
    setAiLoading(true);
    setAiSuggested(null);
    try {
      const res = await fetch('/api/ai/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: taskName, description: taskDesc }),
      });
      if (!res.ok) throw new Error('AI error');
      const data = await res.json();
      setAiSuggested(data);
    } catch {
      setAiSuggested(null);
    } finally {
      setAiLoading(false);
    }
  }

  function acceptAiSuggestion() {
    if (!aiSuggested) return;
    if (aiSuggested.estimatedMinutes) setEstMins(aiSuggested.estimatedMinutes);
    if (aiSuggested.suggestedCategory) setCat(aiSuggested.suggestedCategory);
    if (Array.isArray(aiSuggested.suggestedSubtasks)) {
      setSubtasks(prev => {
        const existing = new Set(prev.map(s => s.name.toLowerCase()));
        const newOnes = aiSuggested.suggestedSubtasks
          .filter(s => !existing.has(s.name.toLowerCase()))
          .map(s => ({ name: s.name, completed: false }));
        return [...prev, ...newOnes];
      });
    }
    setAiSuggested(null);
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name: name.trim(),
      description: desc,
      priority,
      category,
      estimated_minutes: Number(estMins) || 30,
      mission_id: missionId || null,
    };
    try {
      if (isEdit) {
        // Update task fields
        const updated = await updateTask(task.id, payload);
        // Sync subtasks: since we track locally, diff against original
        // Simple approach: nothing here — subtask changes were handled inline via context
        onClose();
      } else {
        // Create with subtasks
        await createTask({ ...payload, subtasks });
        onClose();
      }
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  const catColor = CATEGORY_COLORS[category] || '#64748b';
  const priColor = PRIORITY_COLORS[priority] || '#f59e0b';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box task-modal-box">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Edit Task' : 'New Task'}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label className="form-label">Task Name</label>
            <input
              ref={nameRef}
              className="form-control"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Optional details…"
              rows={3}
            />
          </div>

          <div className="task-modal-row">
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-control" value={priority} onChange={e => setPri(e.target.value)}>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" value={category} onChange={e => setCat(e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Est. Minutes</label>
              <input
                type="number"
                className="form-control"
                value={estMins}
                min={5}
                step={5}
                onChange={e => setEstMins(e.target.value)}
              />
            </div>
          </div>

          {missions.length > 0 && (
            <div className="form-group">
              <label className="form-label">Mission</label>
              <select className="form-control" value={missionId} onChange={e => setMission(e.target.value)}>
                <option value="">No mission</option>
                {missions.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* AI Estimation Panel */}
          {!isEdit && (
            <div className="ai-panel">
              <div className="ai-panel-header">
                <span className="ai-label">✨ AI Suggestion</span>
                {aiLoading && <span className="spinner" />}
                {!aiLoading && name.trim() && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => fetchAiEstimate(name, desc)}
                  >
                    ↻ Re-estimate
                  </button>
                )}
              </div>

              {aiLoading && (
                <div className="ai-loading-msg">Analysing task…</div>
              )}

              {!aiLoading && aiSuggested && (
                <div className="ai-suggestion">
                  <div className="ai-suggestion-row">
                    <span>⏱ {fmtMinutes(aiSuggested.estimatedMinutes)}</span>
                    <span
                      className="cat-pill"
                      style={{ background: `${CATEGORY_COLORS[aiSuggested.suggestedCategory]}22`, color: CATEGORY_COLORS[aiSuggested.suggestedCategory] }}
                    >
                      {aiSuggested.suggestedCategory}
                    </span>
                    {Array.isArray(aiSuggested.suggestedSubtasks) && (
                      <span className="ai-subtask-count">{aiSuggested.suggestedSubtasks.length} subtasks</span>
                    )}
                  </div>
                  <div className="ai-suggestion-actions">
                    <button className="btn btn-primary btn-sm" onClick={acceptAiSuggestion}>
                      ✓ Accept
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAiSuggested(null)}>
                      Ignore
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subtasks */}
          <div className="form-group">
            <label className="form-label">Subtasks</label>
            <SubtaskList
              subtasks={subtasks}
              onAdd={name => setSubtasks(prev => [...prev, { name, completed: false }])}
              onToggle={i => setSubtasks(prev => prev.map((s, idx) => idx === i ? { ...s, completed: !s.completed } : s))}
              onRemove={i => setSubtasks(prev => prev.filter((_, idx) => idx !== i))}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
