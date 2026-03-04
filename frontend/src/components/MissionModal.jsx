import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';

export default function MissionModal({ mission, onClose }) {
  const { createMission, updateMission } = useApp();
  const isEdit = !!mission;

  const [name, setName]        = useState(mission?.name || '');
  const [description, setDesc] = useState(mission?.description || '');
  const [saving, setSaving]    = useState(false);
  const [error, setError]      = useState('');

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
  }, []);

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await updateMission(mission.id, { name: name.trim(), description });
      } else {
        await createMission({ name: name.trim(), description });
      }
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
          <span className="modal-title">{isEdit ? 'Edit Mission' : 'New Mission'}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label className="form-label">Mission Name</label>
            <input
              className="form-control"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Neural Signal Processing"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="What is this mission about?"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Mission'}
          </button>
        </div>
      </div>
    </div>
  );
}
