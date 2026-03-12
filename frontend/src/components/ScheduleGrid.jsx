import React, { useState, useCallback, useRef } from 'react';
import {
  DndContext, DragOverlay, closestCenter,
  MouseSensor, TouchSensor, useSensors, useSensor,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
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

function InlineCommentCell({ slot, date, viewMode, upsertSlot }) {
  const initial = slot?.comments || '';
  const ref     = useRef(null);

  function handleBlur() {
    const val = ref.current?.value ?? '';
    if (val === initial) return;
    if (!slot) return;
    upsertSlot({
      date,
      slot_index:  slot.slot_index,
      record_type: viewMode,
      task_id:     slot.task_id || null,
      label:       slot.label   || null,
      comments:    val,
    }).catch(() => {});
  }

  return (
    <td className="sg-td sg-td-comments" onClick={e => e.stopPropagation()}>
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
// Shown for empty slots when creatingSlot === idx.

function InlineCreateRow({ slotIdx, date, viewMode, onDone, onCancel }) {
  const { createTask, upsertSlot } = useApp();
  const [name,   setName]   = useState('');
  const [saving, setSaving] = useState(false);
  const def = TIME_SLOT_DEFS.find(d => d.idx === slotIdx);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { onCancel(); return; }
    setSaving(true);
    try {
      const task = await createTask({
        name: trimmed,
        category: 'other',
        priority: 'medium',
        estimated_minutes: 30,
        skip_ai: true,
      });
      await upsertSlot({ date, slot_index: slotIdx, record_type: viewMode, task_id: task.id });
      onDone();
    } catch {
      setSaving(false);
    }
  }

  return (
    <tr
      className="sg-row sg-row-creating"
      onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
    >
      <td className="sg-td sg-td-time">{def?.display}</td>
      <td className="sg-td" colSpan={3}>
        <div className="sg-create-form">
          <input
            autoFocus
            className="sg-create-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            placeholder="New task name…"
            disabled={saving}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? '…' : 'Add'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>✕</button>
        </div>
      </td>
    </tr>
  );
}

// ─── InlineEditRow ─────────────────────────────────────────────────────────────

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

  return (
    <tr className="sg-row sg-row-editing" onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}>
      <td className="sg-td sg-td-time">{def?.display}</td>
      <td className="sg-td sg-td-task" colSpan={2}>
        <div className="sg-inline-edit">
          <select className="sg-inline-input" value={taskId} onChange={e => setTaskId(e.target.value)}>
            <option value="">— clear slot —</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input className="sg-inline-input" type="text" value={label}
            onChange={e => setLabel(e.target.value)} placeholder="Label (optional)" />
          <input className="sg-inline-input" type="text" value={comments}
            onChange={e => setComments(e.target.value)} placeholder="Comments" />
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

// ─── DroppableRow + DraggableRow wrapper ──────────────────────────────────────

function DroppableRow({ idx, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-' + idx });
  return React.cloneElement(children, {
    ref: setNodeRef,
    'data-drop-over': isOver ? 'true' : undefined,
  });
}

function DraggableRowHandle({ idx, children, disabled }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'slot-' + idx,
    disabled,
  });
  return React.cloneElement(children, {
    ref: setNodeRef,
    'data-dragging': isDragging ? 'true' : undefined,
    ...(!disabled ? { ...attributes, ...listeners } : {}),
  });
}

// ─── ScheduleGrid ─────────────────────────────────────────────────────────────

export default function ScheduleGrid({ viewMode, setViewMode }) {
  const { schedule, tasks, generateSchedule, fetchSchedule, upsertSlot, upsertSlotBatch } = useApp();

  const [generating,    setGenerating]    = useState(false);
  const [genError,      setGenError]      = useState('');
  const [editingSlot,   setEditingSlot]   = useState(null);
  const [creatingSlot,  setCreatingSlot]  = useState(null);

  // Multi-row selection
  const [selectedSlots,   setSelectedSlots]   = useState(new Set());
  const [lastClicked,     setLastClicked]      = useState(null);
  const [shakingSlot,     setShakingSlot]      = useState(null);
  const [longPressActive, setLongPressActive]  = useState(false);
  const longPressTimer = useRef(null);

  // Active drag id (for DragOverlay)
  const [activeId, setActiveId] = useState(null);

  const date         = schedule.date ?? todayISO();
  const flaggedTasks = schedule.flaggedTasks || [];

  // slotMap for current viewMode
  const viewSlots = viewMode === 'actual'
    ? (schedule.actual  || [])
    : (schedule.planned || []);
  const slotMap = {};
  for (const s of viewSlots) slotMap[s.slot_index] = s;

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

  // ── @dnd-kit sensors ──────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // ── DnD onDragStart ────────────────────────────────────────────────────────
  function handleDragStart({ active }) {
    setActiveId(active.id);
    setEditingSlot(null);
    setCreatingSlot(null);
  }

  // ── DnD onDragEnd (single and multi-row) ───────────────────────────────────
  async function handleDragEnd({ active, over }) {
    setActiveId(null);
    if (!over) return;

    const sourceIdx = parseInt(String(active.id).replace('slot-', ''), 10);
    const targetIdx = parseInt(String(over.id).replace('drop-', ''), 10);
    if (isNaN(sourceIdx) || isNaN(targetIdx) || sourceIdx === targetIdx) return;

    if (selectedSlots.size > 1 && selectedSlots.has(sourceIdx)) {
      // ── Multi-row move ────────────────────────────────────────────────────
      const sorted = [...selectedSlots].sort((a, b) => a - b);
      const offset = targetIdx - sourceIdx;
      const targets = sorted.map(i => i + offset);

      // Validate: all targets in range and not occupied by non-selected slots
      const invalid = targets.some(t =>
        t < START_SLOT_IDX || t > END_SLOT_IDX ||
        (slotMap[t] && slotMap[t].task_id && !selectedSlots.has(t))
      );
      if (invalid) { triggerShake(targetIdx); return; }

      // Build batch: move selected to new positions, clear old positions
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
      // Clear original positions that aren't also target positions
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
      // ── Single-row move ───────────────────────────────────────────────────
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

  // ── Row click handler ──────────────────────────────────────────────────────
  function handleRowClick(e, idx, hasTask) {
    // Don't interfere with active edit/create
    if (creatingSlot !== null || editingSlot !== null) return;

    if (e.shiftKey && lastClicked !== null) {
      // Shift+click: select contiguous range
      const lo = Math.min(lastClicked, idx);
      const hi = Math.max(lastClicked, idx);
      setSelectedSlots(prev => {
        const next = new Set(prev);
        for (let i = lo; i <= hi; i++) next.add(i);
        return next;
      });
    } else if (selectedSlots.size > 0 && !e.shiftKey) {
      // Plain click while selection active: clear selection, then open slot
      setSelectedSlots(new Set());
      setLastClicked(idx);
      if (hasTask) setEditingSlot(idx);
      else setCreatingSlot(idx);
    } else {
      setLastClicked(idx);
      if (hasTask) setEditingSlot(idx);
      else setCreatingSlot(idx);
    }
  }

  // ── Active drag task (for DragOverlay) ────────────────────────────────────
  const activeSlotIdx = activeId ? parseInt(String(activeId).replace('slot-', ''), 10) : null;
  const activeDragSlot = activeSlotIdx != null ? (slotMap[activeSlotIdx] || null) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="schedule-grid-container">
        {/* Flagged tasks banner */}
        <FlaggedTasksBanner flaggedTasks={flaggedTasks} />

        <div className="schedule-grid glass-card">
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="sg-header">
            <div className="sg-date">
              <span className="sg-date-icon">📅</span>
              <span className="sg-date-label">{formatDate(date)}</span>
            </div>

            <div className="sg-header-actions">
              <div className="sg-view-toggle" role="group" aria-label="View mode">
                <button
                  className={`sg-toggle-btn ${viewMode === 'planned' ? 'active' : ''}`}
                  onClick={() => { setViewMode('planned'); setEditingSlot(null); setCreatingSlot(null); }}
                >
                  Plan
                </button>
                <button
                  className={`sg-toggle-btn ${viewMode === 'actual' ? 'active' : ''}`}
                  onClick={() => { setViewMode('actual'); setEditingSlot(null); setCreatingSlot(null); }}
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

          {/* ── Time Slots Table (8AM – 8PM, 48 slots) ────────────────── */}
          <div className="sg-scroll">
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
                  // Inline create mode
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

                  // Inline edit mode
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

                  const slot    = slotMap[idx] || null;
                  const hasTask = !!(slot && slot.task_id);
                  const task    = slot?.task || null;
                  const color   = task ? (CATEGORY_COLORS[task.category] || '#64748b') : null;
                  const isBreak = task?.category === 'break';
                  const isSelected = selectedSlots.has(idx);
                  const isShaking  = shakingSlot === idx;

                  const rowClasses = [
                    'sg-row',
                    hasTask   ? 'sg-row-occupied' : 'sg-row-empty',
                    isBreak   ? 'sg-row-break'    : '',
                    isSelected ? 'sg-row-selected' : '',
                    isShaking  ? 'sg-row-shaking'  : '',
                  ].filter(Boolean).join(' ');

                  const rowEl = (
                    <tr
                      className={rowClasses}
                      style={!isBreak && color ? { borderLeft: `3px solid ${color}` } : undefined}
                      onClick={e => handleRowClick(e, idx, hasTask)}
                      onPointerDown={() => {
                        longPressTimer.current = setTimeout(() => {
                          setLongPressActive(true);
                          setSelectedSlots(new Set([idx]));
                        }, 500);
                      }}
                      onPointerUp={() => clearTimeout(longPressTimer.current)}
                      onPointerCancel={() => {
                        clearTimeout(longPressTimer.current);
                        setLongPressActive(false);
                      }}
                      onPointerEnter={() => {
                        if (longPressActive) {
                          setSelectedSlots(prev => new Set([...prev, idx]));
                        }
                      }}
                      title={hasTask ? 'Drag to reorder · Click to edit · Shift+click to select' : 'Click to create task'}
                    >
                      <td className="sg-td sg-td-time">{display}</td>
                      <td className="sg-td sg-td-task">
                        {hasTask ? (
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
                        ) : (
                          <span className="sg-empty-label sg-add-hint">＋ Add task</span>
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
                    </tr>
                  );

                  // Wrap with droppable for all rows, draggable only for occupied rows
                  const withDrop = (
                    <DroppableRow key={idx} idx={idx}>
                      {rowEl}
                    </DroppableRow>
                  );

                  if (hasTask) {
                    return (
                      <DraggableRowHandle key={idx} idx={idx} disabled={false}>
                        {withDrop}
                      </DraggableRowHandle>
                    );
                  }
                  return withDrop;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DragOverlay — floating chip during drag */}
      <DragOverlay>
        {activeId && activeDragSlot?.task ? (
          <div className="sg-drag-overlay">
            <span
              className="sg-cat-dot"
              style={{ background: CATEGORY_COLORS[activeDragSlot.task.category] || '#64748b' }}
            />
            <span>{activeDragSlot.label || activeDragSlot.task.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
