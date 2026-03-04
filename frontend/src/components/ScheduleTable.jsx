import React, { useCallback } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORY_COLORS } from '../utils.js';
import './ScheduleTable.css';

// ── TaskChip ─────────────────────────────────────────────────────────────────

function TaskChip({ slot, isDragging = false }) {
  const color = CATEGORY_COLORS[slot.category] || '#64748b';
  const bg    = slot.isActual
    ? color
    : `${color}66`; // 40% opacity hex

  return (
    <div
      className={`task-chip ${slot.isActual ? 'is-actual' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ background: bg, borderLeft: `3px solid ${color}` }}
    >
      <span className="chip-name">{slot.taskName}</span>
      {slot.taskDescription && (
        <span className="chip-desc">{slot.taskDescription}</span>
      )}
    </div>
  );
}

// ── DraggableChip ─────────────────────────────────────────────────────────────

function DraggableChip({ slot }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: String(slot.index),
    data: { slot },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab' }}
    >
      <TaskChip slot={slot} />
    </div>
  );
}

// ── TimeBlock (one row) ───────────────────────────────────────────────────────

function TimeBlock({ slot, onToggleActual }) {
  const { isOver, setNodeRef } = useDroppable({ id: String(slot.index) });

  const isHour = slot.time.endsWith(':00');

  return (
    <tr
      className={`time-block ${isOver ? 'drop-over' : ''} ${isHour ? 'hour-row' : ''}`}
    >
      <td className="time-cell">
        {isHour ? slot.time : <span className="time-sub">{slot.time}</span>}
      </td>
      <td
        ref={setNodeRef}
        className={`slot-cell ${slot.taskId ? 'has-task' : 'empty-slot'}`}
      >
        {slot.taskId ? (
          <div className="slot-inner">
            <DraggableChip slot={slot} />
            <button
              className={`actual-toggle ${slot.isActual ? 'is-actual' : ''}`}
              onClick={() => onToggleActual(slot)}
              title={slot.isActual ? 'Mark as planned' : 'Mark as actual'}
              aria-label={slot.isActual ? 'Marked actual' : 'Mark as actual'}
            >
              {slot.isActual ? '✓' : '○'}
            </button>
          </div>
        ) : (
          <div className="empty-inner" />
        )}
      </td>
    </tr>
  );
}

// ── ScheduleTable ─────────────────────────────────────────────────────────────

export default function ScheduleTable() {
  const { schedule, upsertOverride } = useApp();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const todayISO = new Date().toISOString().slice(0, 10);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    if (!over) return;
    const srcIndex  = parseInt(active.id, 10);
    const destIndex = parseInt(over.id,   10);
    if (srcIndex === destIndex) return;

    const srcSlot = schedule[srcIndex];
    if (!srcSlot?.taskId) return;

    // Persist the override
    await upsertOverride({
      date:       todayISO,
      slot_index: destIndex,
      task_id:    srcSlot.taskId,
      label:      srcSlot.taskName,
      is_actual:  0,
    });
  }, [schedule, upsertOverride, todayISO]);

  const handleToggleActual = useCallback(async (slot) => {
    await upsertOverride({
      date:       todayISO,
      slot_index: slot.index,
      task_id:    slot.taskId,
      label:      slot.taskName,
      is_actual:  slot.isActual ? 0 : 1,
    });
  }, [upsertOverride, todayISO]);

  // Find currently dragging slot (for overlay)
  const [activeSlot, setActiveSlot] = React.useState(null);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => {
        const idx = parseInt(active.id, 10);
        setActiveSlot(schedule[idx] || null);
      }}
      onDragEnd={(e) => {
        setActiveSlot(null);
        handleDragEnd(e);
      }}
      onDragCancel={() => setActiveSlot(null)}
    >
      <div className="schedule-table-wrapper">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="schedule-th-time">Time</th>
              <th className="schedule-th-task">Task</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map(slot => (
              <TimeBlock
                key={slot.index}
                slot={slot}
                onToggleActual={handleToggleActual}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeSlot ? <TaskChip slot={activeSlot} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
