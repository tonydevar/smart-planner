import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext, DragOverlay,
  useDraggable,
  useSensors, useSensor, MouseSensor,
} from '@dnd-kit/core';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORIES, CATEGORY_COLORS, PRIORITY_COLORS, fmtMinutes, todayISO } from '../utils.js';
import TaskModal from '../components/TaskModal.jsx';
import MissionModal from '../components/MissionModal.jsx';
import AllotmentModal from '../components/AllotmentModal.jsx';
import ScheduleGrid from '../components/ScheduleGrid.jsx';
import SubtaskPanel from '../components/SubtaskPanel.jsx';
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
  const [subtasksOpen, setSubtasksOpen] = useState(false);

  const catColor = CATEGORY_COLORS[task.category] || '#64748b';
  const priColor = PRIORITY_COLORS[task.priority] || '#f59e0b';
  const subtaskCount = task.subtasks?.length || 0;
  const completedCount = task.subtasks?.filter(s => s.completed).length || 0;

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
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setSubtasksOpen(o => !o)}
            title={subtasksOpen ? 'Hide subtasks' : 'Show subtasks'}
          >
            {subtasksOpen ? '▲' : '▼'}
          </button>
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
        {subtaskCount > 0 && (
          <button
            className="task-subtask-count"
            onClick={() => setSubtasksOpen(o => !o)}
            title="Toggle subtasks"
          >
            ✓ {completedCount}/{subtaskCount}
          </button>
        )}
        {task.flagged_overflow === 1 && (
          <span className="task-overflow-badge" title="Exceeds daily allotment">⚠️ overflow</span>
        )}
      </div>
      {subtasksOpen && (
        <SubtaskPanel task={task} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TaskList
// ──────────────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
// DraggableTaskCard — wraps TaskCard with @dnd-kit draggable (desktop only)
// ──────────────────────────────────────────────────────────────────────────────
function DraggableTaskCard({ task, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'task-' + task.id,
    data: { type: 'sidebar-task', task },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'task-card-ghost' : undefined}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

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
            <DraggableTaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// AllotmentConfig (sidebar Daily Allotments — stays in sidebar)
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
  const { loading, deleteTask, deleteMission, schedule, upsertSlot } = useApp();

  const [selectedMission, setSelectedMission] = useState(null);

  // viewMode lifted from ScheduleGrid so PlannerPage can access it for sidebar drops
  const [viewMode, setViewMode] = useState('planned');

  // Sidebar open by default on desktop (≥768px), closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  const [taskModal,    setTaskModal]    = useState(null);  // null | { task? }
  const [missionModal, setMissionModal] = useState(null);  // null | { mission? }
  const [allotModal,   setAllotModal]   = useState(false);

  // Outer DnD — sidebar→schedule drag (MouseSensor only, desktop)
  const mouseSensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }));
  const [activeSidebarTask, setActiveSidebarTask] = useState(null); // task being dragged from sidebar
  const shakeRef = useRef(null); // ref to ScheduleGrid's triggerShake

  // Build slotMap at PlannerPage level for occupancy check during sidebar drops
  const viewSlots = viewMode === 'actual'
    ? (schedule?.actual  || [])
    : (schedule?.planned || []);
  const ppSlotMap = {};
  for (const s of viewSlots) ppSlotMap[s.slot_index] = s;

  function handleSidebarDragEnd({ active, over }) {
    setActiveSidebarTask(null);
    if (!active?.id?.startsWith?.('task-') || !over?.id?.startsWith?.('drop-')) return;

    const taskId    = active.id.replace('task-', '');
    const slotIndex = parseInt(over.id.replace('drop-', ''), 10);
    if (isNaN(slotIndex)) return;

    const targetSlot = ppSlotMap[slotIndex];
    if (targetSlot?.task_id) {
      // Occupied — trigger shake on that slot
      shakeRef.current?.(slotIndex);
      return;
    }

    upsertSlot({
      date:        todayISO(),
      slot_index:  slotIndex,
      record_type: viewMode,
      task_id:     taskId,
    }).catch(() => { /* server authoritative */ });
  }

  // Auto-close sidebar when viewport shrinks below 768px
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div className="planner-loading">
        <span className="spinner" style={{ width: 32, height: 32 }} />
        <span>Loading Smart Planner…</span>
      </div>
    );
  }

  return (
    <DndContext
      sensors={mouseSensors}
      onDragStart={({ active }) => {
        if (active?.id?.startsWith('task-')) {
          setActiveSidebarTask(active.data?.current?.task || null);
        }
      }}
      onDragEnd={handleSidebarDragEnd}
      onDragCancel={() => setActiveSidebarTask(null)}
    >
    <div className="planner-layout">
      {/* Header */}
      <header className="planner-header glass-card">
        <div className="planner-logo">
          {/* Hamburger / arrow toggle button */}
          <button
            className="sidebar-toggle btn btn-ghost btn-icon"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? '◀' : '☰'}
          </button>
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
        {/* Mobile backdrop — closes sidebar on tap */}
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside className={`planner-sidebar glass-card ${sidebarOpen ? 'sidebar-open' : ''}`}>
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

        {/* Main area — daily schedule grid */}
        <main className="planner-main">
          <ScheduleGrid
            viewMode={viewMode}
            setViewMode={setViewMode}
            externalShakeRef={shakeRef}
          />
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

      {/* DragOverlay — floating chip during sidebar→schedule drag */}
      <DragOverlay>
        {activeSidebarTask ? (
          <div className="sg-drag-overlay" style={{ pointerEvents: 'none' }}>
            <span
              className="sg-cat-dot"
              style={{ background: CATEGORY_COLORS[activeSidebarTask.category] || '#64748b' }}
            />
            <span className="sg-drag-overlay-name">{activeSidebarTask.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </div>
    </DndContext>
  );
}
