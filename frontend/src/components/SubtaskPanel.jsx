import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';

/**
 * SubtaskPanel — expandable inline subtask list per task card.
 *
 * Shows a collapsible panel under the task card with:
 * - Subtask list with completion toggles
 * - Manual add row
 * - Delete button per subtask
 * - "Generate with AI" button
 */
export default function SubtaskPanel({ task }) {
  const { addSubtask, toggleSubtask, deleteSubtask, generateAiSubtasks } = useApp();
  const [newName, setNewName] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const subtasks = task.subtasks || [];

  async function handleToggle(subtask) {
    try {
      await toggleSubtask(task.id, subtask.id);
    } catch {
      // silent — optimistic UI handles it
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddLoading(true);
    try {
      await addSubtask(task.id, { name: newName.trim() });
      setNewName('');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(subtaskId) {
    try {
      await deleteSubtask(task.id, subtaskId);
    } catch {
      // silent
    }
  }

  async function handleGenerateAi() {
    setAiLoading(true);
    setAiError('');
    try {
      await generateAiSubtasks(task.id);
    } catch (err) {
      setAiError('AI generation failed. Try again.');
    } finally {
      setAiLoading(false);
    }
  }

  const completedCount = subtasks.filter(s => s.completed).length;

  return (
    <div className="subtask-panel">
      {/* Progress summary */}
      {subtasks.length > 0 && (
        <div className="subtask-progress">
          <div className="subtask-progress-bar">
            <div
              className="subtask-progress-fill"
              style={{ width: `${(completedCount / subtasks.length) * 100}%` }}
            />
          </div>
          <span className="subtask-progress-label">
            {completedCount}/{subtasks.length} done
          </span>
        </div>
      )}

      {/* Subtask list */}
      <div className="subtask-items">
        {subtasks.map(s => (
          <div key={s.id} className={`subtask-item ${s.completed ? 'subtask-item-done' : ''}`}>
            <input
              type="checkbox"
              className="subtask-checkbox"
              checked={!!s.completed}
              onChange={() => handleToggle(s)}
            />
            <span className="subtask-item-name">{s.name}</span>
            <button
              className="btn btn-ghost btn-icon subtask-delete"
              onClick={() => handleDelete(s.id)}
              title="Remove subtask"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add row */}
      <form className="subtask-add-row" onSubmit={handleAdd}>
        <input
          className="form-control subtask-add-input"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Add subtask…"
          disabled={addLoading}
        />
        <button type="submit" className="btn btn-secondary btn-sm" disabled={addLoading || !newName.trim()}>
          Add
        </button>
      </form>

      {/* AI generate */}
      <div className="subtask-ai-row">
        <button
          className="btn btn-ghost btn-sm subtask-ai-btn"
          onClick={handleGenerateAi}
          disabled={aiLoading}
        >
          {aiLoading ? (
            <><span className="spinner" style={{ width: 12, height: 12 }} /> Generating…</>
          ) : (
            <>✨ Generate with AI</>
          )}
        </button>
        {aiError && <span className="subtask-ai-error">{aiError}</span>}
      </div>
    </div>
  );
}
