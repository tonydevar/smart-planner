/**
 * useSchedule — pure computation, no side effects.
 * Returns 96 ScheduleSlot objects for a full 24-hour day in 15-min increments.
 *
 * ScheduleSlot {
 *   index:          0-95
 *   time:           '00:00'…'23:45'
 *   taskId:         string | null
 *   taskName:       string | null
 *   taskDescription:string | null
 *   category:       string | null
 *   priority:       string | null
 *   isOverride:     boolean
 *   isActual:       boolean
 * }
 */

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const CATEGORY_ORDER = ['build', 'learn', 'explore', 'integrate', 'reflect', 'office-hours', 'other'];

/**
 * Build the 96-slot base schedule from tasks + allotments.
 * Returns Map<slotIndex, {taskId, taskName, taskDescription, category, priority}>.
 */
function computeSchedule(tasks, allotments) {
  const slots = new Map(); // slotIndex -> slot data

  // Only schedule incomplete tasks
  const activeTasks = tasks.filter(t => !t.completed);

  // Group by category
  const byCategory = {};
  for (const t of activeTasks) {
    const cat = t.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(t);
  }

  // Sort each category group: high → medium → low
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    );
  }

  // Assign slots in category order (descending allotment → most important first)
  // Sort categories by their allotted minutes descending
  const sortedCats = Object.keys(byCategory).sort(
    (a, b) => (allotments[b] || 0) - (allotments[a] || 0)
  );

  let nextSlot = 0;

  for (const cat of sortedCats) {
    const allotted = allotments[cat] || 0;
    const maxSlots = Math.floor(allotted / 15);
    if (maxSlots === 0) continue;

    let slotsUsed = 0;
    for (const task of byCategory[cat]) {
      if (slotsUsed >= maxSlots) break;
      const taskSlots = Math.max(1, Math.floor((task.estimated_minutes || 30) / 15));
      for (let s = 0; s < taskSlots && slotsUsed < maxSlots; s++) {
        if (nextSlot < 96) {
          slots.set(nextSlot, {
            taskId:          task.id,
            taskName:        task.name,
            taskDescription: task.description || '',
            category:        cat,
            priority:        task.priority || 'medium',
          });
          nextSlot++;
          slotsUsed++;
        }
      }
    }
  }

  return slots;
}

/**
 * Merge schedule_overrides into computed base schedule.
 * Overrides can move a task to a different slot, or mark it as actual.
 */
function mergeOverrides(baseSlots, overrides) {
  // Clone base
  const merged = new Map(baseSlots);

  for (const ov of overrides) {
    const idx = ov.slot_index;
    if (ov.task_id === null) {
      // Override clears the slot
      merged.delete(idx);
    } else {
      // Find task data from base (may not exist if task was completed)
      const existing = merged.get(idx);
      merged.set(idx, {
        taskId:          ov.task_id,
        taskName:        existing?.taskId === ov.task_id ? existing.taskName : (ov.label || ov.task_id),
        taskDescription: existing?.taskId === ov.task_id ? existing.taskDescription : '',
        category:        existing?.taskId === ov.task_id ? existing.category : 'other',
        priority:        existing?.taskId === ov.task_id ? existing.priority : 'medium',
        isOverride:      true,
        isActual:        !!ov.is_actual,
        _label:          ov.label,
      });
    }
  }

  return merged;
}

/**
 * Build the full 96-element ScheduleSlot array.
 */
export function buildSchedule(tasks, allotments, overrides = []) {
  const base   = computeSchedule(tasks, allotments);
  const merged = mergeOverrides(base, overrides);

  return Array.from({ length: 96 }, (_, i) => {
    const hh = String(Math.floor(i / 4)).padStart(2, '0');
    const mm = String((i % 4) * 15).padStart(2, '0');
    const data = merged.get(i) || null;
    return {
      index:           i,
      time:            `${hh}:${mm}`,
      taskId:          data?.taskId          || null,
      taskName:        data?.taskName        || null,
      taskDescription: data?.taskDescription || null,
      category:        data?.category        || null,
      priority:        data?.priority        || null,
      isOverride:      data?.isOverride      || false,
      isActual:        data?.isActual        || false,
    };
  });
}

/**
 * React hook wrapper (for convenience; actual memoization lives in AppContext).
 */
import { useMemo } from 'react';

export default function useSchedule(tasks, allotments, overrides) {
  return useMemo(
    () => buildSchedule(tasks, allotments, overrides),
    [tasks, allotments, overrides]
  );
}
