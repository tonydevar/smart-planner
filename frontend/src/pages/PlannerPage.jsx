import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORIES, CATEGORY_COLORS, PRIORITY_COLORS, fmtMinutes } from '../utils.js';
import TaskModal from '../components/TaskModal.jsx';
import MissionModal from '../components/MissionModal.jsx';
import AllotmentModal from '../components/AllotmentModal.jsx';
import './PlannerPage.css';

// ──────────────────────────────────────────────────────────────────────────────
// MissionList
// ──────────────────────────────────────────────────────────────────────────────
function MissionList({ selectedMissionId, onSelect, onEdit, onDelete }) {
  const { missions, tasks } = useApp();

  function missionMinutes(missionId) {
    return tasks
      .filter(t => t.mission_id === missionId)
      .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  }

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-header">
        <span className="sidebar-section-title">Missions</span>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onEdit(null)} title="Add Mission">＋</button>
      </div>

      <button
        className={`mission-item ${!selectedMissionId ? 'active' : ''}`}
        onClick={() => onSelect(null)}
      >
        <span className="mission-name">All Tasks</span>
        <span className="mission-mins">{fmtMinutes(tasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0))}</span>
      </button>

      {missions.map(m => (
        <div key={m.id} className={`mission-item ${selectedMissionId === m.id ? 'active' : ''}`}>
          <button className="mission-item-body" onClick={() => onSelect(m.id)}>
            <span className="mission-name">{m.name}</span>
            <span className="mission-mins">{fmtMinutes(missionMinutes(m.id))}</span>
          </button>
          <div className="mission-actions">
            <button className="btn btn-ghost btn-icon" onClick={() => onEdit(m)} title="Edit">✎</button>
            <button className="btn btn-ghost btn-icon" onClick={() => onDelete(m.id)} title="Delete">🗑</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TaskCard
// ──────────────────────────────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDelete }) {
  const { toggleTask } = useApp();
  const catColor = CATEGORY_COLORS[task.category] || '#64748b';
  const priColor = PRIORITY_COLORS[task.priority] || '#f59e0b';

  return (
    <div className={`task-card ${task.completed ? 'task-done' : ''}`}>
      <div className="task-card-top">
        <input
          type="checkbox"
          className="task-checkbox"
          checked={!!task.completed}
          onChange={() => toggleTask(task.id, !task.completed)}
        />
        <span className="task-name">{task.name}</span>
        <div className="task-actions">
          <button className="btn btn-ghost btn-icon" onClick={() => onEdit(task)} title="Edit">✎</button>
          <button className="btn btn-ghost btn-icon" onClick={() => onDelete(task.id)} title="Delete">🗑</button>
        </div>
      </div>
      <div className="task-card-meta">
        <span
          className="cat-pill"
          style={{ background: `${catColor}22`, color: catColor }}
        >
          {task.category}
        </span>
        <span
          className="pri-badge"
          style={{ background: `${priColor}22`, color: priColor }}
        >
          {task.priority}
        </span>
        <span className="task-duration">⏱ {fmtMinutes(task.estimated_minutes)}</span>
        {task.subtasks?.length > 0 && (
          <span className="task-subtask-count">
            ✓ {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
          </span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TaskList
// ──────────────────────────────────────────────────────────────────────────────
function TaskList({ selectedMissionId, onAdd, onEdit, onDelete }) {
  const { tasks } = useApp();
  const filtered = selectedMissionId
    ? tasks.filter(t => t.mission_id === selectedMissionId)
    : tasks;

  return (
    <div className="sidebar-section tasks-section">
      <div className="sidebar-section-header">
        <span className="sidebar-section-title">Tasks</span>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onAdd} title="Add Task">＋</button>
      </div>

      {filtered.length === 0 ? (
        <div className="tasks-empty">No tasks yet. Click ＋ to add one.</div>
      ) : (
        <div className="task-list">
          {filtered.map(t => (
            <TaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// AllotmentConfig
// ──────────────────────────────────────────────────────────────────────────────
function AllotmentConfig({ onEdit }) {
  const { allotments, tasks } = useApp();

  // Compute used minutes per category from incomplete tasks
  const usedPerCat = {};
  CATEGORIES.forEach(c => { usedPerCat[c] = 0; });
  tasks.filter(t => !t.completed).forEach(t => {
    if (usedPerCat[t.category] !== undefined) {
      usedPerCat[t.category] += (t.estimated_minutes || 0);
    }
  });

  return (
    <div className="sidebar-section allotment-section">
      <div className="sidebar-section-header">
        <span className="sidebar-section-title">Daily Allotments</span>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
      </div>
      <div className="allotment-bars">
        {CATEGORIES.map(cat => {
          const allotted = allotments[cat] || 0;
          const used     = usedPerCat[cat] || 0;
          const pct      = allotted > 0 ? Math.min(100, (used / allotted) * 100) : 0;
          const over     = used > allotted && allotted > 0;
          const color    = CATEGORY_COLORS[cat];
          return (
            <div key={cat} className="allotment-bar-row">
              <div className="allotment-bar-label">
                <span className="allotment-cat-dot" style={{ background: color }} />
                <span className="allotment-cat-name">{cat}</span>
              </div>
              <div className="allotment-bar-track">
                <div
                  className={`allotment-bar-fill ${over ? 'over' : ''}`}
                  style={{ width: `${pct}%`, background: over ? '#ef4444' : color }}
                />
              </div>
              <span className="allotment-bar-nums">
                {fmtMinutes(used)}/{fmtMinutes(allotted)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PlannerPage
// ──────────────────────────────────────────────────────────────────────────────
export default function PlannerPage() {
  const { loading, deleteTask, deleteMission } = useApp();

  const [selectedMission, setSelectedMission] = useState(null);

  const [taskModal,     setTaskModal]     = useState(null);  // null | { task? }
  const [missionModal,  setMissionModal]  = useState(null);  // null | { mission? }
  const [allotModal,    setAllotModal]    = useState(false);

  if (loading) {
    return (
      <div className="planner-loading">
        <span className="spinner" style={{ width: 32, height: 32 }} />
        <span>Loading Smart Planner…</span>
      </div>
    );
  }

  return (
    <div className="planner-layout">
      {/* Header */}
      <header className="planner-header glass-card">
        <div className="planner-logo">
          <span className="planner-logo-icon">🧠</span>
          <span className="planner-logo-text">Smart Planner</span>
        </div>
        <div className="planner-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => setTaskModal({ task: null })}
          >
            ＋ Add Task
          </button>
        </div>
      </header>

      <div className="planner-body">
        {/* Sidebar */}
        <aside className="planner-sidebar glass-card">
          <MissionList
            selectedMissionId={selectedMission}
            onSelect={setSelectedMission}
            onEdit={mission => setMissionModal({ mission })}
            onDelete={id => {
              if (confirm('Delete this mission? Tasks will be unassigned.')) deleteMission(id);
            }}
          />

          <TaskList
            selectedMissionId={selectedMission}
            onAdd={() => setTaskModal({ task: null, missionId: selectedMission })}
            onEdit={task => setTaskModal({ task })}
            onDelete={id => {
              if (confirm('Delete this task?')) deleteTask(id);
            }}
          />

          <AllotmentConfig onEdit={() => setAllotModal(true)} />
        </aside>

        {/* Main area (placeholder for Feature 3 schedule) */}
        <main className="planner-main">
          <div className="schedule-placeholder glass-card">
            <div className="schedule-placeholder-icon">📅</div>
            <h2>Schedule</h2>
            <p>Daily schedule view coming in the next feature.</p>
          </div>
        </main>
      </div>

      {/* Modals */}
      {taskModal !== null && (
        <TaskModal
          task={taskModal.task}
          defaultMissionId={taskModal.missionId}
          onClose={() => setTaskModal(null)}
        />
      )}
      {missionModal !== null && (
        <MissionModal
          mission={missionModal.mission}
          onClose={() => setMissionModal(null)}
        />
      )}
      {allotModal && (
        <AllotmentModal onClose={() => setAllotModal(false)} />
      )}
    </div>
  );
}
