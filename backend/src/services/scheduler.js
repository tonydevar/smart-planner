'use strict';

/**
 * scheduler.js — Daily Schedule Generator for Smart Planner
 *
 * Ported from the original scheduler.js and adapted to read from SQLite
 * via the db singleton. Generates a calendar-style schedule in 15-minute
 * increments (8 AM – 8 PM) and flags tasks that exceed allotment capacity.
 */

const db = require('../../db/database');

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_ORDER   = { high: 0, medium: 1, low: 2 };
const SLOT_DURATION    = 15;                // minutes per slot
const START_HOUR       = 8;                 // 08:00
const END_HOUR         = 20;               // 20:00 (8 PM)
const CATEGORY_ORDER   = ['explore', 'learn', 'build', 'integrate', 'reflect', 'office-hours', 'other'];

// ─── Time-slot helpers ────────────────────────────────────────────────────────

/**
 * Generates the skeleton of 15-min slots from 8 AM to 8 PM.
 * Returns an array of:
 *   { time: "HH:MM", display: "HH:MM - HH:MM", tasks: [] }
 */
function generateTimeSlots() {
  const slots = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_DURATION) {
      const hh         = String(hour).padStart(2, '0');
      const mm         = String(minute).padStart(2, '0');
      const endMinute  = minute + SLOT_DURATION;
      const endHH      = String(hour + (endMinute >= 60 ? 1 : 0)).padStart(2, '0');
      const endMM      = String(endMinute >= 60 ? endMinute - 60 : endMinute).padStart(2, '0');
      slots.push({
        time:    `${hh}:${mm}`,
        display: `${hh}:${mm} - ${endHH}:${endMM}`,
        tasks:   [],
      });
    }
  }
  return slots;
}

// ─── Core scheduling algorithm ────────────────────────────────────────────────

/**
 * Loads incomplete tasks from SQLite, groups by category, sorts by priority,
 * and fills time slots according to each category's allotment.
 *
 * Tasks that cannot fit within their category's allotment are marked as
 * flagged_overflow = 1 in the database and returned in the flaggedTasks array.
 *
 * @param {Object} allotments — { category: minutes, ... }
 * @param {Object} [opts]
 * @param {boolean} [opts.persist=true] — when false, skip all DB writes (safe for GET)
 * @returns {{ timeSlots: Array, flaggedTasks: Array }}
 */
function generateSchedule(allotments, { persist = true } = {}) {
  // 1. Load all incomplete tasks ordered by created_at (FIFO within priority)
  const tasks = db.prepare(
    'SELECT * FROM tasks WHERE completed = 0 ORDER BY created_at ASC'
  ).all();

  // 2. Reset all flagged_overflow flags before re-generating (skip for dry-run / GET)
  if (persist) {
    db.prepare('UPDATE tasks SET flagged_overflow = 0').run();
  }

  // 3. Group by category
  const byCategory = {};
  for (const cat of CATEGORY_ORDER) byCategory[cat] = [];
  for (const task of tasks) {
    const bucket = byCategory[task.category] ?? byCategory['other'];
    bucket.push(task);
  }

  // 4. Sort each group: high → medium → low; preserve created_at order within tier
  for (const cat of CATEGORY_ORDER) {
    byCategory[cat].sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
    });
  }

  // 5. Schedule tasks into time slots
  const timeSlots          = generateTimeSlots();
  const totalSlots         = timeSlots.length;       // 48 slots (8 AM–8 PM)
  const flaggedTaskIds     = new Set();
  let   currentSlotIndex   = 0;

  for (const cat of CATEGORY_ORDER) {
    const catTasks = byCategory[cat];
    const allottedMinutes = allotments[cat] ?? 0;
    let   remainingCatMinutes = allottedMinutes;

    for (const task of catTasks) {
      const estMinutes = task.estimated_minutes || SLOT_DURATION;

      if (remainingCatMinutes <= 0) {
        // Category exhausted — flag all remaining tasks in this category
        flaggedTaskIds.add(task.id);
        continue;
      }

      if (currentSlotIndex >= totalSlots) {
        // Day is full
        flaggedTaskIds.add(task.id);
        continue;
      }

      // Determine how many minutes this task gets (may be partial)
      const schedulableMinutes = Math.min(estMinutes, remainingCatMinutes);
      const slotsNeeded        = Math.ceil(schedulableMinutes / SLOT_DURATION);
      const isPartial          = schedulableMinutes < estMinutes;

      // Fill slots
      for (let i = 0; i < slotsNeeded && currentSlotIndex < totalSlots; i++) {
        const slotDuration = Math.min(SLOT_DURATION, schedulableMinutes - i * SLOT_DURATION);
        timeSlots[currentSlotIndex].tasks.push({
          id:        task.id,
          name:      task.name,
          category:  task.category,
          priority:  task.priority,
          minutes:   slotDuration,
          isPartial,
        });
        currentSlotIndex++;
      }

      remainingCatMinutes -= schedulableMinutes;

      // If task was only partially scheduled, the remainder overflows
      if (isPartial) {
        flaggedTaskIds.add(task.id);
      }
    }
  }

  // 6. Write flagged_overflow to database (skip for dry-run / GET)
  if (persist && flaggedTaskIds.size > 0) {
    const setFlag = db.prepare('UPDATE tasks SET flagged_overflow = 1 WHERE id = ?');
    const flagAll = db.transaction((ids) => {
      for (const id of ids) setFlag.run(id);
    });
    flagAll(flaggedTaskIds);
  }

  // 7. Load the full flaggedTask objects
  const flaggedTasks = flaggedTaskIds.size > 0
    ? db.prepare(
        `SELECT * FROM tasks WHERE id IN (${[...flaggedTaskIds].map(() => '?').join(',')}) ORDER BY priority ASC, created_at ASC`
      ).all(...flaggedTaskIds)
    : [];

  return { timeSlots, flaggedTasks };
}

/**
 * Returns the current allotments config from SQLite.
 * @returns {Object} — { category: minutes, ... }
 */
function getAllotments() {
  const row = db.prepare("SELECT value FROM config WHERE key = 'allotments'").get();
  return row ? JSON.parse(row.value) : {};
}

/**
 * Formats minutes to a human-readable string.
 * @param {number} minutes
 * @returns {string} — "1h 30m" / "45m"
 */
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

module.exports = {
  generateSchedule,
  generateTimeSlots,
  getAllotments,
  formatDuration,
  PRIORITY_ORDER,
  SLOT_DURATION,
};
