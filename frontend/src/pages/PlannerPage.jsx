import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext, DragOverlay, closestCenter,
  MouseSensor, TouchSensor, useSensors, useSensor,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORIES, CATEGORY_COLORS, PRIORITY_COLORS, fmtMinutes, todayISO } from '../utils.js';
import TaskModal from '../components/TaskModal.jsx';
import MissionModal from '../components/MissionModal.jsx';
import AllotmentModal from '../components/AllotmentModal.jsx';
import ScheduleGrid, { START_SLOT_IDX, END_SLOT_IDX } from '../components/ScheduleGrid.jsx';
import SubtaskPanel from '../components/SubtaskPanel.jsx';
import './PlannerPage.css';

// ──────────────────────────────────────────────────────────────────────────────
// MissionList
// ──────────────────────────────────────────────────────────────────────────────
function MissionList({ selectedMissionId, onSelect, onEdit, onDelete, open, onToggle }) {
  const { missions, tasks } = useApp();

  function missionMinutes(missionId) {
    return tasks
      .filter(t => t.mission_id === missionId)
      .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  }

  return (
    <div className="sidebar-section">
      <button className="sidebar-section-header accordion-header" onClick={onToggle}>
        <span className="sidebar-section-title">Missions</span>
        <div className="accordion-header-right">
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={e => { e.stopPropagation(); onEdit(null); }}
            title="Add Mission"
          >＋</button>
          <span className={`accordion-chevron${open ? ' open' : ''}`}>›</span>
        </div>
      </button>

      <div className={`accordion-body${open ? ' accordion-open' : ''}`}>
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
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// DraggableTaskCard — wraps TaskCard with @dnd-kit drag
// ──────────────────────────────────────────────────────────────────────────────
function DraggableTaskCard({ task, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'task-' + task.id,
    data: { type: 'sidebar-task', task },
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 9999, position: 'relative' }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'task-card-ghost' : ''}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

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
function TaskList({ selectedMissionId, onAdd, onEdit, onDelete, open, onToggle }) {
  const { tasks } = useApp();
  const filtered = selectedMissionId
    ? tasks.filter(t => t.mission_id === selectedMissionId)
    : tasks;

  return (
    <div className="sidebar-section tasks-section">
      <button className="sidebar-section-header accordion-header" onClick={onToggle}>
        <span className="sidebar-section-title">Tasks</span>
        <div className="accordion-header-right">
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={e => { e.stopPropagation(); onAdd(); }}
            title="Add Task"
          >＋</button>
          <span className={`accordion-chevron${open ? ' open' : ''}`}>›</span>
        </div>
      </button>

      <div className={`accordion-body${open ? ' accordion-open' : ''}`}>
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
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// AllotmentConfig
// ──────────────────────────────────────────────────────────────────────────────
function AllotmentConfig({ onEdit, open, onToggle }) {
  const { allotments, tasks } = useApp();

  const usedPerCat = {};
  CATEGORIES.forEach(c => { usedPerCat[c] = 0; });
  tasks.filter(t => !t.completed).forEach(t => {
    if (usedPerCat[t.category] !== undefined) {
      usedPerCat[t.category] += (t.estimated_minutes || 0);
    }
  });

  return (
    <div className="sidebar-section allotment-section">
      <button className="sidebar-section-header accordion-header" onClick={onToggle}>
        <span className="sidebar-section-title">Daily Allotments</span>
        <div className="accordion-header-right">
          <button
            className="btn btn-ghost btn-sm"
            onClick={e => { e.stopPropagation(); onEdit(); }}
          >Edit</button>
          <span className={`accordion-chevron${open ? ' open' : ''}`}>›</span>
        </div>
      </button>
      <div className={`accordion-body${open ? ' accordion-open' : ''}`}>
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
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PlannerPage — single DndContext for sidebar AND schedule drag
// ──────────────────────────────────────────────────────────────────────────────
export default function PlannerPage() {
  const { loading, tasks, deleteTask, deleteMission, schedule, upsertSlot, upsertSlotBatch } = useApp();

  const [selectedMission, setSelectedMission] = useState(null);

  // Sidebar open by default on desktop (≥768px), closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  // Accordion section open states
  const [missionOpen,    setMissionOpen]    = useState(false);
  const [tasksOpen,      setTasksOpen]      = useState(true);
  const [allotmentsOpen, setAllotmentsOpen] = useState(false);

  // viewMode lifted so both sidebar DnD and ScheduleGrid can access it
  const [viewMode, setViewMode] = useState('planned');

  // Unified DnD state
  const [activeDragId,   setActiveDragId]   = useState(null);
  const [sidebarDragTask, setSidebarDragTask] = useState(null);

  // Selected slots for multi-row drag (lifted from ScheduleGrid)
  const [selectedSlots, setSelectedSlots] = useState(new Set());

  // Shaking slot (rejected drop) — unified for sidebar and schedule drops
  const [shakingSlot, setShakingSlot] = useState(null);

  // Capacity warning banner (sidebar → schedule drop fails)
  const [capacityWarning, setCapacityWarning] = useState(null);
  const capacityWarningTimer = useRef(null);

  const [taskModal,    setTaskModal]    = useState(null);
  const [missionModal, setMissionModal] = useState(null);
  const [allotModal,   setAllotModal]   = useState(false);

  const scheduleGridRef = useRef(null);

  // Single DndContext: Mouse + Touch sensors
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // Build slotMap for the current viewMode (used by both sidebar and schedule handlers)
  const viewSlots = viewMode === 'actual'
    ? (schedule.actual  || [])
    : (schedule.planned || []);
  const slotMap = {};
  for (const s of viewSlots) slotMap[s.slot_index] = s;
  const date = schedule.date ?? todayISO();

  function triggerShake(idx) {
    setShakingSlot(idx);
    setTimeout(() => setShakingSlot(null), 400);
  }

  // ── Unified drag start ────────────────────────────────────────────────────
  function handleDragStart({ active }) {
    setActiveDragId(active.id);
    const id = String(active.id);

    if (id.startsWith('task-')) {
      // Sidebar task drag
      const taskData = active.data?.current?.task;
      setSidebarDragTask(taskData || null);
    }

    // Clear any inline editing in the schedule grid
    scheduleGridRef.current?.clearEditing();
  }

  // ── Unified drag end ──────────────────────────────────────────────────────
  async function handleDragEnd({ active, over }) {
    setActiveDragId(null);
    setSidebarDragTask(null);
    if (!over) return;

    const id = String(active.id);

    if (id.startsWith('task-')) {
      // ── Sidebar → schedule drop ─────────────────────────────────────────
      const isDropZone = String(over.id).startsWith('drop-');
      if (!isDropZone) return;

      const taskId  = id.replace('task-', '');
      const slotIdx = parseInt(String(over.id).replace('drop-', ''), 10);
      if (isNaN(slotIdx)) return;

      // Duration-aware multi-slot fill
      // sidebarDragTask still references the captured closure value (setState is async)
      const droppedTask = sidebarDragTask;
      const taskName    = droppedTask?.name || 'Task';
      const slotsNeeded = Math.ceil((droppedTask?.estimated_minutes || 30) / 15);
      const requiredSlots = Array.from({ length: slotsNeeded }, (_, i) => slotIdx + i);

      // Validate: all required slots within schedule window and unoccupied
      const allValid = requiredSlots.every(
        s => s >= START_SLOT_IDX && s <= END_SLOT_IDX && !(slotMap[s]?.task_id)
      );

      if (!allValid) {
        // Count consecutive available (unoccupied + in-range) slots from slotIdx
        let available = 0;
        for (let s = slotIdx; s <= END_SLOT_IDX; s++) {
          if (slotMap[s]?.task_id) break;
          available++;
        }
        triggerShake(slotIdx);
        if (capacityWarningTimer.current) clearTimeout(capacityWarningTimer.current);
        setCapacityWarning({ taskName, needed: slotsNeeded, available });
        capacityWarningTimer.current = setTimeout(() => setCapacityWarning(null), 4000);
        return;
      }

      // Build batch: first slot gets task name, subsequent slots get '[cont.]' label
      const batchSlots = requiredSlots.map((s, i) => ({
        slot_index: s,
        task_id:    taskId,
        label:      i === 0 ? null : '[cont.]',
        comments:   '',
      }));
      upsertSlotBatch({ date, record_type: viewMode, slots: batchSlots }).catch(() => {});

    } else if (id.startsWith('slot-')) {
      // ── Schedule row drag ───────────────────────────────────────────────
      const sourceIdx = parseInt(id.replace('slot-', ''), 10);
      const targetIdx = parseInt(String(over.id).replace('drop-', ''), 10);
      if (isNaN(sourceIdx) || isNaN(targetIdx) || sourceIdx === targetIdx) return;

      if (selectedSlots.size > 1 && selectedSlots.has(sourceIdx)) {
        // ── Multi-row move ──────────────────────────────────────────────
        const sorted = [...selectedSlots].sort((a, b) => a - b);
        const offset = targetIdx - sourceIdx;
        const targets = sorted.map(i => i + offset);

        const invalid = targets.some(t =>
          t < START_SLOT_IDX || t > END_SLOT_IDX ||
          (slotMap[t] && slotMap[t].task_id && !selectedSlots.has(t))
        );
        if (invalid) { triggerShake(targetIdx); return; }

        const batchSlots = [];
        sorted.forEach((src, i) => {
          const srcSlot = slotMap[src];
          batchSlots.push({
            slot_index: targets[i],
            task_id:    srcSlot?.task_id  || null,
            label:      srcSlot?.label    || null,
            comments:   srcSlot?.comments || '',
          });
        });
        sorted.forEach(src => {
          if (!targets.includes(src)) {
            batchSlots.push({ slot_index: src, task_id: null, label: null, comments: '' });
          }
        });

        try {
          await upsertSlotBatch({ date, record_type: viewMode, slots: batchSlots });
          setSelectedSlots(new Set());
        } catch {
          triggerShake(targetIdx);
        }

      } else {
        // ── Single-row move ─────────────────────────────────────────────
        const targetSlot = slotMap[targetIdx];
        if (targetSlot && targetSlot.task_id) { triggerShake(targetIdx); return; }

        const srcSlot = slotMap[sourceIdx];
        if (!srcSlot || !srcSlot.task_id) return;

        try {
          await Promise.all([
            upsertSlot({ date, slot_index: targetIdx, record_type: viewMode,
                         task_id: srcSlot.task_id, label: srcSlot.label || null,
                         comments: srcSlot.comments || '' }),
            upsertSlot({ date, slot_index: sourceIdx, record_type: viewMode,
                         task_id: null, label: null, comments: '' }),
          ]);
        } catch {
          triggerShake(targetIdx);
        }
      }
    }
  }

  // ── DragOverlay content ────────────────────────────────────────────────────
  let overlayContent = null;
  if (activeDragId) {
    const id = String(activeDragId);
    if (id.startsWith('task-') && sidebarDragTask) {
      overlayContent = (
        <div className="sg-drag-overlay">
          <span className="sg-cat-dot"
            style={{ background: CATEGORY_COLORS[sidebarDragTask.category] || '#64748b' }} />
          <span>{sidebarDragTask.name}</span>
        </div>
      );
    } else if (id.startsWith('slot-')) {
      const slotIdx = parseInt(id.replace('slot-', ''), 10);
      const slot = slotMap[slotIdx];
      if (slot?.task) {
        overlayContent = (
          <div className="sg-drag-overlay">
            <span className="sg-cat-dot"
              style={{ background: CATEGORY_COLORS[slot.task.category] || '#64748b' }} />
            <span>{slot.label || slot.task.name}</span>
          </div>
        );
      }
    }
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
        <span>Loading Waypoint…</span>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="planner-layout">
        {/* Header */}
        <header className="planner-header glass-card">
          <div className="planner-logo">
            <button
              className="sidebar-toggle btn btn-ghost btn-icon"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {sidebarOpen ? '◀' : '☰'}
            </button>
            <span className="planner-logo-icon">🧠</span>
            <span className="planner-logo-text">Waypoint</span>
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
          {sidebarOpen && (
            <div
              className="sidebar-backdrop"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          <aside className={`planner-sidebar glass-card ${sidebarOpen ? 'sidebar-open' : ''}`}>
            <MissionList
              selectedMissionId={selectedMission}
              onSelect={setSelectedMission}
              onEdit={mission => setMissionModal({ mission })}
              onDelete={id => {
                if (confirm('Delete this mission? Tasks will be unassigned.')) deleteMission(id);
              }}
              open={missionOpen}
              onToggle={() => setMissionOpen(o => !o)}
            />

            <TaskList
              selectedMissionId={selectedMission}
              onAdd={() => setTaskModal({ task: null, missionId: selectedMission })}
              onEdit={task => setTaskModal({ task })}
              onDelete={id => {
                if (confirm('Delete this task?')) deleteTask(id);
              }}
              open={tasksOpen}
              onToggle={() => setTasksOpen(o => !o)}
            />

            <AllotmentConfig
              onEdit={() => setAllotModal(true)}
              open={allotmentsOpen}
              onToggle={() => setAllotmentsOpen(o => !o)}
            />
          </aside>

          <main className="planner-main">
            {capacityWarning && (
              <div className="capacity-warning-banner">
                <span className="capacity-warning-icon">⚠️</span>
                <span className="capacity-warning-message">
                  <strong>{capacityWarning.taskName}</strong> needs{' '}
                  {capacityWarning.needed} slot{capacityWarning.needed !== 1 ? 's' : ''}{' '}
                  ({capacityWarning.needed * 15} min) but only{' '}
                  {capacityWarning.available} consecutive slot{capacityWarning.available !== 1 ? 's' : ''}{' '}
                  available here.
                </span>
                <button
                  className="capacity-warning-dismiss btn btn-ghost btn-icon btn-sm"
                  onClick={() => {
                    clearTimeout(capacityWarningTimer.current);
                    setCapacityWarning(null);
                  }}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            )}
            <ScheduleGrid
              ref={scheduleGridRef}
              viewMode={viewMode}
              setViewMode={setViewMode}
              selectedSlots={selectedSlots}
              setSelectedSlots={setSelectedSlots}
              shakingSlot={shakingSlot}
            />
          </main>
        </div>

        {/* Unified DragOverlay */}
        <DragOverlay>{overlayContent}</DragOverlay>

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
    </DndContext>
  );
}
