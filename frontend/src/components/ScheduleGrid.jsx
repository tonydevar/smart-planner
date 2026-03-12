import React, { useState, useCallback, useRef } from 'react';
import {
  DndContext, DragOverlay,
  useDraggable, useDroppable,
  useSensors, useSensor, MouseSensor, TouchSensor,
} from '@dnd-kit/core';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORY_COLORS, todayISO } from '../utils.js';
import FlaggedTasksBanner from './FlaggedTasksBanner.jsx';
import './ScheduleGrid.css';

// ─── Constants ────────────────────────────────────────────────────────────────

// 8AM – 8PM = slot indices 32–79 (15-min slots, 0 = midnight)
const START_SLOT_IDX = 32;  // 08:00
const END_SLOT_IDX   = 79;  // 19:45
const SLOT_COUNT     = END_SLOT_IDX - START_SLOT_IDX + 1; // 48

// Pre-compute display labels for all 48 slots
const TIME_SLOT_DEFS = Array.from({ length: SLOT_COUNT }, (_, i) => {
  const idx        = START_SLOT_IDX + i;
  const startMins  = idx * 15;
  const endMins    = startMins + 15;
  const fmt = m => {
    const h = Math.floor(m / 60) % 24;
    const mm = m % 60;
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
  };
  return { idx, display: `${fmt(startMins)} – ${fmt(endMins)}` };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── InlineCommentCell ────────────────────────────────────────────────────────
// An editable <td> that saves on blur if value changed.

function InlineCommentCell({ slot, date, viewMode, upsertSlot }) {
  const initial = slot?.comments || '';
  const ref     = useRef(null);

  function handleBlur() {
    const val = ref.current?.value ?? '';
    if (val === initial) return;          // no change
    if (!slot) return;                    // empty row — nothing to save
    upsertSlot({
      date,
      slot_index:  slot.slot_index,
      record_type: viewMode,
      task_id:     slot.task_id || null,
      label:       slot.label   || null,
      comments:    val,
    }).catch(() => {/* silent — UI stays consistent via server round-trip */});
  }

  return (
    <td
      className="sg-td sg-td-comments"
      onClick={e => e.stopPropagation()}   // don't trigger row edit
    >
      <input
        ref={ref}
        className="sg-comments-input"
        type="text"
        defaultValue={initial}
        onBlur={handleBlur}
        placeholder="…"
      />
    </td>
  );
}

// ─── InlineCreateRow ──────────────────────────────────────────────────────────

function InlineCreateRow({ slotIdx, date, viewMode, onDone, onCancel }) {
  const { createTask, upsertSlot } = useApp();
  const [name, setName]     = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const newTask = await createTask({
        name: trimmed,
        category: 'other',
        priority: 'medium',
        estimated_minutes: 30,
        skip_ai: true,
      });
      await upsertSlot({ date, slot_index: slotIdx, record_type: viewMode, task_id: newTask.id });
      onDone();
    } catch {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') onCancel();
  }

  return (
    <tr className="sg-row sg-row-creating">
      <td className="sg-td sg-td-time" />
      <td className="sg-td sg-td-task" colSpan={3}>
        <div className="sg-create-form">
          <input
            autoFocus
            className="sg-create-input"
            placeholder="New task name…"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
          />
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? '…' : 'Add'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>✕</button>
        </div>
      </td>
    </tr>
  );
}

// ─── InlineEditRow ─────────────────────────────────────────────────────────────
// Replaces a table row when in edit mode.

function InlineEditRow({ slotIdx, slot, date, viewMode, tasks, upsertSlot, onCancel }) {
  const [taskId,   setTaskId]   = useState(slot?.task_id  || '');
  const [label,    setLabel]    = useState(slot?.label    || '');
  const [comments, setComments] = useState(slot?.comments || '');
  const [saving,   setSaving]   = useState(false);

  const def = TIME_SLOT_DEFS.find(d => d.idx === slotIdx);

  async function handleSave() {
    setSaving(true);
    try {
      await upsertSlot({
        date,
        slot_index:  slotIdx,
        record_type: viewMode,
        task_id:     taskId || null,
        label:       label  || null,
        comments,
      });
      onCancel();
    } catch {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onCancel();
  }

  return (
    <tr className="sg-row sg-row-editing" onKeyDown={handleKeyDown}>
      <td className="sg-td sg-td-time">{def?.display}</td>
      <td className="sg-td sg-td-task" colSpan={2}>
        <div className="sg-inline-edit">
          <select
            className="sg-inline-input"
            value={taskId}
            onChange={e => setTaskId(e.target.value)}
          >
            <option value="">— clear slot —</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            className="sg-inline-input"
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Label (optional)"
          />
          <input
            className="sg-inline-input"
            type="text"
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder="Comments"
          />
          <div className="sg-inline-actions">
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── ScheduleGrid ─────────────────────────────────────────────────────────────

// ─── DroppableRow ────────────────────────────────────────────────────────────

function DroppableRow({ idx, children, ...props }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-' + idx });
  return (
    <tr ref={setNodeRef} data-drop-over={isOver ? 'true' : undefined} {...props}>
      {children}
    </tr>
  );
}

// ─── DraggableRowHandle ──────────────────────────────────────────────────────

function DraggableRowHandle({ idx, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: 'slot-' + idx });
  return (
    <div
      ref={setNodeRef}
      data-dragging={isDragging ? 'true' : undefined}
      className="sg-drag-handle"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

// ─── ScheduleGrid ─────────────────────────────────────────────────────────────

export default function ScheduleGrid() {
  const { schedule, tasks, generateSchedule, fetchSchedule, upsertSlot, upsertSlotBatch } = useApp();

  const [generating,    setGenerating]   = useState(false);
  const [genError,      setGenError]     = useState('');
  const [viewMode,      setViewMode]     = useState('planned');   // 'planned' | 'actual'
  const [editingSlot,   setEditingSlot]  = useState(null);        // slot_index | null
  const [creatingSlot,  setCreatingSlot] = useState(null);        // slot_index | null
  const [activeDragIdx, setActiveDragIdx] = useState(null);       // slot_index being dragged
  const [selectedSlots, setSelectedSlots] = useState(new Set());  // Set<number>
  const [lastClicked,   setLastClicked]  = useState(null);        // last slot clicked
  const [shakingSlot,   setShakingSlot]  = useState(null);        // slot_index with shake anim
  const [longPressActive, setLongPressActive] = useState(false);
  const longPressTimer = useRef(null);

  const date         = schedule.date ?? todayISO();
  const flaggedTasks = schedule.flaggedTasks || [];

  // Build slotMap from the current view's array: { [slot_index]: slot }
  const viewSlots = viewMode === 'actual'
    ? (schedule.actual  || [])
    : (schedule.planned || []);
  const slotMap = {};
  for (const s of viewSlots) slotMap[s.slot_index] = s;

  // @dnd-kit sensors: mouse (desktop) + touch (mobile)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError('');
    try {
      await generateSchedule(date);
      await fetchSchedule(date);
    } catch {
      setGenError('Failed to generate schedule. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [date, generateSchedule, fetchSchedule]);

  function triggerShake(idx) {
    setShakingSlot(idx);
    setTimeout(() => setShakingSlot(null), 400);
  }

  // ── @dnd-kit DragEnd handler ─────────────────────────────────────────────

  async function handleDndEnd({ active, over }) {
    setActiveDragIdx(null);
    if (!active || !over) return;

    const sourceIdx = parseInt(active.id.replace('slot-', ''), 10);
    const targetIdx = parseInt(over.id.replace('drop-', ''), 10);

    if (isNaN(sourceIdx) || isNaN(targetIdx) || sourceIdx === targetIdx) return;

    const sourceSlot = slotMap[sourceIdx];
    if (!sourceSlot?.task_id) return;

    // ── Multi-row move ─────────────────────────────────────────────────────
    if (selectedSlots.size > 1 && selectedSlots.has(sourceIdx)) {
      const offset = targetIdx - sourceIdx;
      const sortedSources = Array.from(selectedSlots).sort((a, b) => a - b);

      // Validate: all targets must be in 32-79 and not occupied by non-selected slots
      const invalid = sortedSources.some(s => {
        const t = s + offset;
        return t < START_SLOT_IDX || t > END_SLOT_IDX ||
               (slotMap[t]?.task_id && !selectedSlots.has(t));
      });
      if (invalid) { triggerShake(targetIdx); return; }

      // Build batch: moved slots + cleared source slots
      const batchSlots = [];
      for (const srcIdx of sortedSources) {
        const tgtIdx  = srcIdx + offset;
        const srcSlot = slotMap[srcIdx];
        batchSlots.push({ slot_index: tgtIdx, task_id: srcSlot.task_id, label: srcSlot.label || null, comments: srcSlot.comments || '' });
      }
      // Clear sources that aren't also targets
      const targetSet = new Set(sortedSources.map(s => s + offset));
      for (const srcIdx of sortedSources) {
        if (!targetSet.has(srcIdx)) {
          batchSlots.push({ slot_index: srcIdx, task_id: null, label: null, comments: '' });
        }
      }

      try {
        await upsertSlotBatch({ date, record_type: viewMode, slots: batchSlots });
        setSelectedSlots(new Set());
      } catch { /* server authoritative */ }
      return;
    }

    // ── Single-row move ────────────────────────────────────────────────────
    const targetSlot = slotMap[targetIdx];
    if (targetSlot?.task_id) { triggerShake(targetIdx); return; } // occupied → reject

    try {
      await upsertSlot({ date, slot_index: targetIdx, record_type: viewMode, task_id: sourceSlot.task_id, label: sourceSlot.label || null, comments: sourceSlot.comments || '' });
      await upsertSlot({ date, slot_index: sourceIdx, record_type: viewMode, task_id: null, label: null, comments: '' });
      setSelectedSlots(new Set());
    } catch { /* server authoritative */ }
  }

  // ── Multi-select (shift+click) ────────────────────────────────────────────

  function handleRowClick(e, idx, hasTask) {
    if (e.shiftKey && lastClicked !== null) {
      // Range selection
      const lo = Math.min(lastClicked, idx);
      const hi = Math.max(lastClicked, idx);
      const newSet = new Set();
      for (let i = lo; i <= hi; i++) {
        if (slotMap[i]?.task_id) newSet.add(i);
      }
      setSelectedSlots(newSet);
    } else {
      // Plain click
      setSelectedSlots(new Set());
      setLastClicked(idx);
      if (hasTask) setEditingSlot(idx);
      else setCreatingSlot(idx);
    }
  }

  // ── Mobile long-press ─────────────────────────────────────────────────────

  function handlePointerDown(idx, hasTask) {
    if (!hasTask) return;
    longPressTimer.current = setTimeout(() => {
      setLongPressActive(true);
      setSelectedSlots(prev => new Set([...prev, idx]));
    }, 500);
  }

  function handlePointerUp() {
    clearTimeout(longPressTimer.current);
    setLongPressActive(false);
  }

  function handlePointerEnter(idx) {
    if (!longPressActive) return;
    if (slotMap[idx]?.task_id) {
      setSelectedSlots(prev => new Set([...prev, idx]));
    }
  }

  // Active drag task (for DragOverlay chip)
  const activeDragSlot = activeDragIdx !== null ? slotMap[activeDragIdx] : null;
  const activeDragTask = activeDragSlot?.task || null;

  return (
    <div className="schedule-grid-container">
      {/* Flagged tasks banner */}
      <FlaggedTasksBanner flaggedTasks={flaggedTasks} />

      <div className="schedule-grid glass-card">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="sg-header">
          <div className="sg-date">
            <span className="sg-date-icon">📅</span>
            <span className="sg-date-label">{formatDate(date)}</span>
          </div>

          <div className="sg-header-actions">
            {/* Plan / Actual toggle */}
            <div className="sg-view-toggle" role="group" aria-label="View mode">
              <button
                className={`sg-toggle-btn ${viewMode === 'planned' ? 'active' : ''}`}
                onClick={() => { setViewMode('planned'); setEditingSlot(null); }}
              >
                Plan
              </button>
              <button
                className={`sg-toggle-btn ${viewMode === 'actual' ? 'active' : ''}`}
                onClick={() => { setViewMode('actual'); setEditingSlot(null); }}
              >
                Actual
              </button>
            </div>

            <button
              className="btn btn-primary sg-generate-btn"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <><span className="spinner" style={{ width: 14, height: 14 }} /> Generating…</>
              ) : (
                '⟳ Generate Schedule'
              )}
            </button>
          </div>
        </div>

        {genError && <div className="sg-error">{genError}</div>}

        {/* ── Time Slots Table (8AM – 8PM, 48 slots) ──────────────────── */}
        <div className="sg-scroll">
          <DndContext
            sensors={sensors}
            onDragStart={({ active }) => {
              const idx = parseInt(active.id.replace('slot-', ''), 10);
              setActiveDragIdx(isNaN(idx) ? null : idx);
            }}
            onDragEnd={handleDndEnd}
            onDragCancel={() => setActiveDragIdx(null)}
          >
            <table className="sg-table">
              <thead>
                <tr>
                  <th className="sg-th sg-th-time">Time</th>
                  <th className="sg-th sg-th-task">Task</th>
                  <th className="sg-th sg-th-cat">Category</th>
                  <th className="sg-th sg-th-comments">Comments</th>
                </tr>
              </thead>
              <tbody>
                {TIME_SLOT_DEFS.map(({ idx, display }) => {
                  // Inline create mode for this row (empty slot clicked)
                  if (creatingSlot === idx) {
                    return (
                      <InlineCreateRow
                        key={idx}
                        slotIdx={idx}
                        date={date}
                        viewMode={viewMode}
                        onDone={() => setCreatingSlot(null)}
                        onCancel={() => setCreatingSlot(null)}
                      />
                    );
                  }

                  // Inline edit mode for this row (occupied slot clicked)
                  if (editingSlot === idx) {
                    return (
                      <InlineEditRow
                        key={idx}
                        slotIdx={idx}
                        slot={slotMap[idx] || null}
                        date={date}
                        viewMode={viewMode}
                        tasks={tasks}
                        upsertSlot={upsertSlot}
                        onCancel={() => setEditingSlot(null)}
                      />
                    );
                  }

                  const slot       = slotMap[idx] || null;
                  const hasTask    = !!(slot?.task_id);
                  const task       = slot?.task || null;
                  const color      = task ? (CATEGORY_COLORS[task.category] || '#64748b') : null;
                  const isBreak    = task?.category === 'break';
                  const isSelected = selectedSlots.has(idx);
                  const isShaking  = shakingSlot === idx;
                  const isDragging = activeDragIdx === idx;

                  const rowClasses = [
                    'sg-row',
                    hasTask    ? 'sg-row-occupied' : 'sg-row-empty',
                    isBreak    ? 'sg-row-break'    : '',
                    isSelected ? 'sg-row-selected' : '',
                    isShaking  ? 'sg-row-shaking'  : '',
                    isDragging ? 'sg-row-dragging' : '',
                  ].filter(Boolean).join(' ');

                  return (
                    <DroppableRow
                      key={idx}
                      idx={idx}
                      className={rowClasses}
                      style={!isBreak && color ? { borderLeft: `3px solid ${color}` } : undefined}
                      onClick={e => handleRowClick(e, idx, hasTask)}
                      onPointerDown={() => handlePointerDown(idx, hasTask)}
                      onPointerUp={handlePointerUp}
                      onPointerEnter={() => handlePointerEnter(idx)}
                      title={hasTask ? 'Drag to reorder · Click to edit · Shift+click to multi-select' : 'Click to add task'}
                    >
                      <td className="sg-td sg-td-time">{display}</td>
                      <td className="sg-td sg-td-task">
                        {hasTask ? (
                          <DraggableRowHandle idx={idx}>
                            <div className="sg-task-chips">
                              <div className="sg-task-chip">
                                {isBreak ? (
                                  <span className="sg-break-icon">☕</span>
                                ) : (
                                  <span className="sg-cat-dot" style={{ background: color }} />
                                )}
                                <span className="sg-task-name">
                                  {slot.label || task?.name || ''}
                                </span>
                              </div>
                            </div>
                          </DraggableRowHandle>
                        ) : (
                          <span className="sg-empty-label">—</span>
                        )}
                      </td>
                      <td className="sg-td sg-td-cat">
                        {task && (
                          <span className="sg-cat-pill" style={{ background: `${color}22`, color }}>
                            {task.category}
                          </span>
                        )}
                      </td>
                      <InlineCommentCell
                        slot={slot}
                        date={date}
                        viewMode={viewMode}
                        upsertSlot={upsertSlot}
                      />
                    </DroppableRow>
                  );
                })}
              </tbody>
            </table>

            {/* DragOverlay — floating chip showing dragged task name */}
            <DragOverlay>
              {activeDragTask ? (
                <div className="sg-drag-overlay">
                  <span
                    className="sg-cat-dot"
                    style={{ background: CATEGORY_COLORS[activeDragTask.category] || '#64748b' }}
                  />
                  <span className="sg-drag-overlay-name">{activeDragTask.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
