import React, { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORY_COLORS, todayISO } from '../utils.js';
import FlaggedTasksBanner from './FlaggedTasksBanner.jsx';
import './ScheduleGrid.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── ScheduleGrid ─────────────────────────────────────────────────────────────

export default function ScheduleGrid() {
  const { schedule, generateSchedule, fetchSchedule } = useApp();

  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState('');

  const date         = schedule.date ?? todayISO();
  const timeSlots    = schedule.timeSlots    || [];
  const flaggedTasks = schedule.flaggedTasks || [];

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError('');
    try {
      // Generate via POST (writes flagged_overflow), then refresh via GET
      await generateSchedule(date);
      await fetchSchedule(date);
    } catch {
      setGenError('Failed to generate schedule. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [date, generateSchedule, fetchSchedule]);

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
          {timeSlots.length === 0 ? (
            <div className="sg-empty">
              <span className="sg-empty-icon">🗓️</span>
              <span>No schedule generated yet.</span>
              <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={generating}>
                Generate Now
              </button>
            </div>
          ) : (
            <table className="sg-table">
              <thead>
                <tr>
                  <th className="sg-th sg-th-time">Time</th>
                  <th className="sg-th sg-th-task">Task</th>
                  <th className="sg-th sg-th-cat">Category</th>
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot, i) => {
                  const hasTasks = slot.tasks && slot.tasks.length > 0;
                  const firstTask = hasTasks ? slot.tasks[0] : null;
                  const color = firstTask ? (CATEGORY_COLORS[firstTask.category] || null) : null;

                  return (
                    <tr
                      key={i}
                      className={`sg-row ${hasTasks ? 'sg-row-occupied' : 'sg-row-empty'}`}
                      style={color ? { borderLeft: `3px solid ${color}` } : undefined}
                    >
                      <td className="sg-td sg-td-time">{slot.time}</td>
                      <td className="sg-td sg-td-task">
                        {hasTasks ? (
                          <div className="sg-task-chips">
                            {slot.tasks.map((t, ti) => {
                              const tColor = CATEGORY_COLORS[t.category] || '#64748b';
                              return (
                                <div key={ti} className="sg-task-chip">
                                  <span
                                    className="sg-cat-dot"
                                    style={{ background: tColor }}
                                  />
                                  <span className="sg-task-name">
                                    {t.name}
                                    {t.isPartial && <span className="sg-partial-tag"> [cont.]</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="sg-empty-label">—</span>
                        )}
                      </td>
                      <td className="sg-td sg-td-cat">
                        {firstTask && (
                          <span
                            className="sg-cat-pill"
                            style={{
                              background: `${CATEGORY_COLORS[firstTask.category] || '#64748b'}22`,
                              color: CATEGORY_COLORS[firstTask.category] || '#64748b',
                            }}
                          >
                            {firstTask.category}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
