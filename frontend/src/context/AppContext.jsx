import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import { buildSchedule } from '../hooks/useSchedule.js';

const AppContext = createContext(null);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const initialState = {
  tasks:     [],
  missions:  [],
  allotments: {},
  overrides:  [],
  loading:   true,
};

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...state, ...action.payload, loading: false };

    case 'SET_TASKS':
      return { ...state, tasks: action.payload };
    case 'ADD_TASK':
      return { ...state, tasks: [action.payload, ...state.tasks] };
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) };

    case 'ADD_MISSION':
      return { ...state, missions: [action.payload, ...state.missions] };
    case 'UPDATE_MISSION':
      return { ...state, missions: state.missions.map(m => m.id === action.payload.id ? action.payload : m) };
    case 'DELETE_MISSION':
      return {
        ...state,
        missions: state.missions.filter(m => m.id !== action.payload),
        tasks: state.tasks.map(t => t.mission_id === action.payload ? { ...t, mission_id: null } : t),
      };

    case 'SET_ALLOTMENTS':
      return { ...state, allotments: action.payload };

    case 'UPSERT_OVERRIDE': {
      const { date, slot_index } = action.payload;
      const existing = state.overrides.find(o => o.date === date && o.slot_index === slot_index);
      return {
        ...state,
        overrides: existing
          ? state.overrides.map(o => (o.date === date && o.slot_index === slot_index) ? action.payload : o)
          : [...state.overrides, action.payload],
      };
    }

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const today = todayISO();
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/missions').then(r => r.json()),
      fetch('/api/config').then(r => r.json()),
      fetch(`/api/schedule/overrides?date=${today}`).then(r => r.json()),
    ]).then(([tasks, missions, config, overrides]) => {
      dispatch({ type: 'INIT', payload: {
        tasks,
        missions,
        allotments: config.allotments || {},
        overrides,
      }});
    }).catch(() => {
      dispatch({ type: 'INIT', payload: {} });
    });
  }, []);

  // ── Tasks ─────────────────────────────────────────────────────────────────

  const createTask = useCallback(async (data) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create task');
    const task = await res.json();
    dispatch({ type: 'ADD_TASK', payload: task });
    return task;
  }, []);

  const updateTask = useCallback(async (id, data) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update task');
    const task = await res.json();
    dispatch({ type: 'UPDATE_TASK', payload: task });
    return task;
  }, []);

  const deleteTask = useCallback(async (id) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    dispatch({ type: 'DELETE_TASK', payload: id });
  }, []);

  const toggleTask = useCallback(async (id, completed) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) throw new Error('Failed to toggle task');
    const task = await res.json();
    dispatch({ type: 'UPDATE_TASK', payload: task });
    return task;
  }, []);

  // ── Missions ──────────────────────────────────────────────────────────────

  const createMission = useCallback(async (data) => {
    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create mission');
    const mission = await res.json();
    dispatch({ type: 'ADD_MISSION', payload: mission });
    return mission;
  }, []);

  const updateMission = useCallback(async (id, data) => {
    const res = await fetch(`/api/missions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update mission');
    const mission = await res.json();
    dispatch({ type: 'UPDATE_MISSION', payload: mission });
    return mission;
  }, []);

  const deleteMission = useCallback(async (id) => {
    await fetch(`/api/missions/${id}`, { method: 'DELETE' });
    dispatch({ type: 'DELETE_MISSION', payload: id });
  }, []);

  // ── Allotments ────────────────────────────────────────────────────────────

  const updateAllotments = useCallback(async (allotments) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allotments }),
    });
    if (!res.ok) throw new Error('Failed to update allotments');
    const data = await res.json();
    dispatch({ type: 'SET_ALLOTMENTS', payload: data.allotments });
  }, []);

  // ── Subtasks ──────────────────────────────────────────────────────────────

  const addSubtask = useCallback(async (taskId, data) => {
    const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add subtask');
    const task = await fetch(`/api/tasks/${taskId}`).then(r => r.json());
    dispatch({ type: 'UPDATE_TASK', payload: task });
    return task;
  }, []);

  const updateSubtask = useCallback(async (taskId, subtaskId, data) => {
    const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update subtask');
    const task = await fetch(`/api/tasks/${taskId}`).then(r => r.json());
    dispatch({ type: 'UPDATE_TASK', payload: task });
    return task;
  }, []);

  const deleteSubtask = useCallback(async (taskId, subtaskId) => {
    await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' });
    const task = await fetch(`/api/tasks/${taskId}`).then(r => r.json());
    dispatch({ type: 'UPDATE_TASK', payload: task });
  }, []);

  // ── Schedule overrides ────────────────────────────────────────────────────

  const upsertOverride = useCallback(async (data) => {
    const res = await fetch('/api/schedule/overrides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to upsert override');
    const override = await res.json();
    dispatch({ type: 'UPSERT_OVERRIDE', payload: override });
    return override;
  }, []);

  // Reactive schedule — recomputes automatically when tasks, allotments, or overrides change
  const schedule = useMemo(
    () => buildSchedule(state.tasks, state.allotments, state.overrides),
    [state.tasks, state.allotments, state.overrides]
  );

  return (
    <AppContext.Provider value={{
      ...state,
      schedule,
      createTask, updateTask, deleteTask, toggleTask,
      createMission, updateMission, deleteMission,
      updateAllotments,
      addSubtask, updateSubtask, deleteSubtask,
      upsertOverride,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
