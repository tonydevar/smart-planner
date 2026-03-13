import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORIES, CATEGORY_COLORS, todayISO } from '../utils.js';
import FlaggedTasksBanner from './FlaggedTasksBanner.jsx';
import './ScheduleGrid.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const START_SLOT_IDX = 32;  // 08:00
const END_SLOT_IDX   = 79;  // 19:45
const SLOT_COUNT     = END_SLOT_IDX - START_SLOT_IDX + 1; // 48

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

// ─── TaskNameInput — auto-select, Enter/blur saves, Escape cancels, Tab → next ─

function TaskNameInput({ initialValue, onSave, onCancel, onTabNext }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  function commit() {
    const val = (inputRef.current?.value ?? '').trim();
    if (val && val !== initialValue) onSave(val);
    else onCancel();
  }

  return (
    <input
      ref={inputRef}
      className="sg-cell-input"
      type="text"
      defaultValue={initialValue}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        else if (e.key === 'Tab')   { e.preventDefault(); commit(); onTabNext?.(); }
      }}
    />
  );
}

// ─── DndRow — combined droppable + draggable wrapper (single ref) ────────────

function DndRow({ idx, hasTask, children }) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'drop-' + idx });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: 'slot-' + idx,
    disabled: !hasTask,
  });

  const combinedRef = useCallback(node => {
    setDropRef(node);
    setDragRef(node);
  }, [setDropRef, setDragRef]);

  return React.cloneElement(children, {
    ref: combinedRef,
    'data-drop-over': isOver ? 'true' : undefined,
    'data-dragging': isDragging ? 'true' : undefined,
    ...(hasTask ? { ...attributes, ...listeners } : {}),
  });
}

// ─── ScheduleGrid ─────────────────────────────────────────────────────────────
// No DndContext here — hooks register with PlannerPage's single DndContext.

const ScheduleGrid = forwardRef(function ScheduleGrid(
  { viewMode, setViewMode, selectedSlots, setSelectedSlots, shakingSlot },
  ref
) {
  const { schedule, tasks, generateSchedule, fetchSchedule, upsertSlot, updateTask } = useApp();

  const [generating,   setGenerating]   = useState(false);
  const [genError,     setGenError]     = useState('');
  const [editingCell,  setEditingCell]  = useState(null);   // {slotIdx, field:'name'|'category'} | null
  const [creatingSlot, setCreatingSlot] = useState(null);

  // Multi-row selection helpers (not DnD-related)
  const [lastClicked,     setLastClicked]     = useState(null);
  const [longPressActive, setLongPressActive] = useState(false);
  const longPressTimer = useRef(null);

  const date         = schedule.date ?? todayISO();
  const flaggedTasks = schedule.flaggedTasks || [];

  const viewSlots = viewMode === 'actual'
    ? (schedule.actual  || [])
    : (schedule.planned || []);
  const slotMap = {};
  for (const s of viewSlots) slotMap[s.slot_index] = s;

  // Expose clearEditing so PlannerPage can call on drag start
  useImperativeHandle(ref, () => ({
    clearEditing() {
      setEditingCell(null);
      setCreatingSlot(null);
    },
  }));

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

  // ── Row click handler ──────────────────────────────────────────────────────
  function handleRowClick(e, idx, hasTask) {
    if (creatingSlot !== null || editingCell !== null) return;

    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click (or Cmd+Click on Mac): toggle selection without opening any form
      e.preventDefault();
      e.stopPropagation();
      setSelectedSlots(prev => {
        const next = new Set(prev);
        next.has(idx) ? next.delete(idx) : next.add(idx);
        return next;
      });
      setLastClicked(idx);
      return;
    }

    // Plain click: clear selection
    if (selectedSlots.size > 0) setSelectedSlots(new Set());
    setLastClicked(idx);
    // Occupied rows: cell onClick handles per-cell editing; don't open any form at row level
    // Empty rows: open inline create
    if (!hasTask) setCreatingSlot(idx);
  }

  return (
    <div className="schedule-grid-container">
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
                onClick={() => { setViewMode('planned'); setEditingCell(null); setCreatingSlot(null); }}
              >
                Plan
              </button>
              <button
                className={`sg-toggle-btn ${viewMode === 'actual' ? 'active' : ''}`}
                onClick={() => { setViewMode('actual'); setEditingCell(null); setCreatingSlot(null); }}
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
                    title={hasTask ? 'Drag to reorder · Click cell to edit · Ctrl+click to select' : 'Click to create task'}
                  >
                    <td className="sg-td sg-td-time">{display}</td>
                    <td
                      className={`sg-td sg-td-task${editingCell?.slotIdx === idx && editingCell?.field === 'name' ? ' sg-td-editing' : ''}`}
                      onClick={hasTask ? e => { e.stopPropagation(); setEditingCell({ slotIdx: idx, field: 'name' }); } : undefined}
                    >
                      {hasTask ? (
                        editingCell?.slotIdx === idx && editingCell?.field === 'name' ? (
                          <TaskNameInput
                            initialValue={task?.name || ''}
                            onSave={val => { updateTask(task.id, { name: val }).catch(() => {}); setEditingCell(null); }}
                            onCancel={() => setEditingCell(null)}
                            onTabNext={() => setEditingCell({ slotIdx: idx, field: 'category' })}
                          />
                        ) : (
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
                        )
                      ) : (
                        <span className="sg-empty-label sg-add-hint">＋ Add task</span>
                      )}
                    </td>
                    <td
                      className={`sg-td sg-td-cat${editingCell?.slotIdx === idx && editingCell?.field === 'category' ? ' sg-td-editing' : ''}`}
                      onClick={hasTask ? e => { e.stopPropagation(); setEditingCell({ slotIdx: idx, field: 'category' }); } : undefined}
                    >
                      {task && (
                        editingCell?.slotIdx === idx && editingCell?.field === 'category' ? (
                          <select
                            className="sg-cell-select"
                            autoFocus
                            defaultValue={task.category}
                            onChange={e => { updateTask(task.id, { category: e.target.value }).catch(() => {}); setEditingCell(null); }}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setEditingCell(null); } }}
                          >
                            {CATEGORIES.filter(c => c !== 'break').map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="sg-cat-pill" style={{ background: `${color}22`, color }}>
                            {task.category}
                          </span>
                        )
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

                return (
                  <DndRow key={idx} idx={idx} hasTask={hasTask}>
                    {rowEl}
                  </DndRow>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default ScheduleGrid;

// Export constants for use by PlannerPage's drag handler
export { START_SLOT_IDX, END_SLOT_IDX };
