import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORIES, CATEGORY_COLORS, fmtMinutes } from '../utils.js';

export default function AllotmentModal({ onClose }) {
  const { allotments, updateAllotments } = useApp();
  const [values, setValues] = useState({ ...allotments });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
  }, []);

  async function handleSave() {
    const parsed = {};
    for (const [k, v] of Object.entries(values)) {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 0) { setError(`Invalid value for ${k}`); return; }
      parsed[k] = n;
    }
    setSaving(true);
    setError('');
    try {
      await updateAllotments(parsed);
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">Edit Daily Allotments</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-msg">{error}</div>}
          <p className="allotment-hint">Set the maximum daily minutes for each category.</p>
          {CATEGORIES.map(cat => (
            <div key={cat} className="allotment-row">
              <div
                className="allotment-dot"
                style={{ background: CATEGORY_COLORS[cat] }}
              />
              <span className="allotment-label">
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </span>
              <input
                type="number"
                className="form-control allotment-input"
                value={values[cat] ?? 60}
                min={0}
                step={15}
                onChange={e => setValues(v => ({ ...v, [cat]: e.target.value }))}
              />
              <span className="allotment-unit">min</span>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Allotments'}
          </button>
        </div>
      </div>
    </div>
  );
}
