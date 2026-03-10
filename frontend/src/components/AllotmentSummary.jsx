import React from 'react';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORIES, CATEGORY_COLORS, fmtMinutes } from '../utils.js';

/**
 * AllotmentSummary — progress bars showing used vs allotted minutes per category.
 *
 * "Used" minutes are computed from the scheduled timeSlots (tasks that were
 * actually placed in the schedule). This gives a more accurate picture than
 * counting all incomplete tasks, which might include tasks that were flagged
 * as overflow and were NOT scheduled.
 */
export default function AllotmentSummary() {
  const { allotments, schedule } = useApp();
  const timeSlots = schedule.timeSlots || [];

  // Compute scheduled minutes per category from timeSlots
  const scheduledMinutes = {};
  CATEGORIES.forEach(c => { scheduledMinutes[c] = 0; });

  for (const slot of timeSlots) {
    for (const task of (slot.tasks || [])) {
      if (scheduledMinutes[task.category] !== undefined) {
        scheduledMinutes[task.category] += task.minutes || 15;
      } else {
        scheduledMinutes['other'] = (scheduledMinutes['other'] || 0) + (task.minutes || 15);
      }
    }
  }

  return (
    <div className="allotment-summary glass-card">
      <div className="allotment-summary-header">
        <span className="allotment-summary-title">Daily Allotments</span>
      </div>
      <div className="allotment-summary-bars">
        {CATEGORIES.map(cat => {
          const allotted  = allotments[cat] || 0;
          const used      = scheduledMinutes[cat] || 0;
          const pct       = allotted > 0 ? Math.min(100, (used / allotted) * 100) : 0;
          const over      = used > allotted && allotted > 0;
          const color     = CATEGORY_COLORS[cat];
          return (
            <div key={cat} className="allotment-bar-row">
              <div className="allotment-bar-label">
                <span className="allotment-cat-dot" style={{ background: color }} />
                <span className="allotment-cat-name">{cat}</span>
              </div>
              <div className="allotment-bar-track">
                <div
                  className={`allotment-bar-fill ${over ? 'allotment-bar-over' : ''}`}
                  style={{ width: `${pct}%`, background: over ? '#ef4444' : color }}
                />
              </div>
              <span className="allotment-bar-nums">
                {fmtMinutes(used)}&nbsp;/&nbsp;{fmtMinutes(allotted)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
