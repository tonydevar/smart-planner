import React, { useState } from 'react';
import { CATEGORY_COLORS, fmtMinutes } from '../utils.js';

/**
 * FlaggedTasksBanner — shown when tasks exceed their category's daily allotment.
 *
 * Displays a collapsible list of overflow tasks with their category and estimated time.
 * Prompts the user to reduce task time or increase allotments.
 */
export default function FlaggedTasksBanner({ flaggedTasks }) {
  const [expanded, setExpanded] = useState(true);

  if (!flaggedTasks || flaggedTasks.length === 0) return null;

  return (
    <div className="flagged-banner glass-card">
      <button
        className="flagged-banner-header"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="flagged-banner-icon">⚠️</span>
        <span className="flagged-banner-title">
          {flaggedTasks.length} task{flaggedTasks.length !== 1 ? 's' : ''} exceed daily capacity
        </span>
        <span className="flagged-banner-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="flagged-banner-body">
          <p className="flagged-banner-hint">
            These tasks couldn't be scheduled today. Reduce their estimated time or increase the category allotment.
          </p>
          <div className="flagged-list">
            {flaggedTasks.map(t => {
              const color = CATEGORY_COLORS[t.category] || '#64748b';
              return (
                <div key={t.id} className="flagged-item">
                  <span
                    className="flagged-cat-dot"
                    style={{ background: color }}
                  />
                  <span className="flagged-task-name">{t.name}</span>
                  <span
                    className="flagged-cat-pill"
                    style={{ background: `${color}22`, color }}
                  >
                    {t.category}
                  </span>
                  <span className="flagged-task-time">
                    {fmtMinutes(t.estimated_minutes)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
