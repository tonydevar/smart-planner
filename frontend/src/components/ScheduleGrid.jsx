import React, { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORY_COLORS, todayISO } from '../utils.js';
import './ScheduleGrid.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_SLOTS = 96;   // 15-min slots in 24 hours

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slotToTime(index) {
  const totalMins = index * 15;
  const h24       = Math.floor(totalMins / 60) % 24;
  const m         = totalMins % 60;
  const ampm      = h24 < 12 ? 'AM' : 'PM';
  const h12       = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── ScheduleGrid ─────────────────────────────────────────────────────────────

export default function ScheduleGrid() {
  const { schedule, generateSchedule } = useApp();

  // 'planned' | 'actual' — ephemeral UI state, lives here not in context
  const [view,        setView]        = useState('planned');
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState('');

  const date   = schedule.date ?? todayISO();
  const slots  = view === 'actual' ? schedule.actual : schedule.planned;

  // Build a lookup: slot_index → slot object
  const slotMap = {};
  for (const s of slots) slotMap[s.slot_index] = s;

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError('');
    try {
      await generateSchedule(date);
    } catch {
      setGenError('Failed to generate schedule. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [date, generateSchedule]);

  return (
    <div className="schedule-grid glass-card">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sg-header">
        <div className="sg-date">
          <span className="sg-date-icon">📅</span>
          <span className="sg-date-label">{formatDate(date)}</span>
        </div>

        <div className="sg-header-actions">
          {/* Plan / Actual toggle */}
          <div className="sg-view-toggle">
            <button
              className={`sg-toggle-btn ${view === 'planned' ? 'active' : ''}`}
              onClick={() => setView('planned')}
            >
              Plan
            </button>
            <button
              className={`sg-toggle-btn ${view === 'actual' ? 'active' : ''}`}
              onClick={() => setView('actual')}
            >
              Actual
            </button>
          </div>

          {/* Generate button */}
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

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="sg-scroll">
        <table className="sg-table">
          <thead>
            <tr>
              <th className="sg-th sg-th-time">Time</th>
              <th className="sg-th sg-th-task">Task / Label</th>
              <th className="sg-th sg-th-desc">Description</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
              const slot     = slotMap[i];
              const occupied = !!slot;
              const category = slot?.task?.category;
              const color    = category ? CATEGORY_COLORS[category] : null;

              return (
                <tr
                  key={i}
                  className={`sg-row ${occupied ? 'sg-row-occupied' : 'sg-row-empty'}`}
                  style={color ? { borderLeft: `4px solid ${color}` } : undefined}
                >
                  <td className="sg-td sg-td-time">{slotToTime(i)}</td>
                  <td className="sg-td sg-td-task">
                    {occupied ? (
                      <div className="sg-task-name">
                        {category && (
                          <span
                            className="sg-cat-dot"
                            style={{ background: color }}
                            title={category}
                          />
                        )}
                        {slot.label ?? slot.task?.name ?? '—'}
                      </div>
                    ) : (
                      <span className="sg-empty-label">—</span>
                    )}
                  </td>
                  <td className="sg-td sg-td-desc">
                    {occupied && slot.task?.description ? (
                      <span className="sg-task-desc">{slot.task.description}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
