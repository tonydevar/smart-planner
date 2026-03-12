import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

const AppContext = createContext(null);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const initialState = {
  tasks:      [],
  missions:   [],
  allotments: {},
  schedule: {
    date:         todayISO(),
    planned:      [],   // [{ id, slot_index, record_type, task_id, label, task }]
    actual:       [],   // [{ id, slot_index, record_type, task_id, label, task }]
    timeSlots:    [],   // [{ time, display, tasks: [...] }] from scheduler service
    flaggedTasks: [],   // tasks that exceeded their category allotment
  },
  loading: true,
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

    // ── Schedule ───────────────────────────────────────────────────────────
    case 'SET_SCHEDULE':
      return { ...state, schedule: { ...state.schedule, ...action.payload } };

    case 'SET_PLANNED_SLOTS':
      return { ...state, schedule: { ...state.schedule, planned: action.payload } };

    case 'SET_TIME_SLOTS':
      return { ...state, schedule: { ...state.schedule, timeSlots: action.payload } };

    case 'SET_FLAGGED_TASKS':
      return { ...state, schedule: { ...state.schedule, flaggedTasks: action.payload } };

    case 'UPSERT_SLOT': {
      const slot = action.payload;
      const key  = slot.record_type === 'actual' ? 'actual' : 'planned';
      const arr  = state.schedule[key];
      const idx  = arr.findIndex(s => s.slot_index === slot.slot_index);
      const next = idx >= 0
        ? arr.map((s, i) => i === idx ? slot : s)
        : [...arr, slot].sort((a, b) => a.slot_index - b.slot_index);
      return { ...state, schedule: { ...state.schedule, [key]: next } };
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
      fetch(`/api/schedule?date=${today}`).then(r => r.json()),
    ]).then(([tasks, missions, config, schedule]) => {
      const planned      = schedule.planned      || [];
      const actual       = schedule.actual       || [];
      const timeSlots    = schedule.timeSlots    || [];
      const flaggedTasks = schedule.flaggedTasks || [];

      dispatch({ type: 'INIT', payload: {
        tasks,
        missions,
        allotments: config.allotments || {},
        schedule: { date: today, planned, actual, timeSlots, flaggedTasks },
      }});

      // Auto-generate if no planned slots exist for today
      if (planned.length === 0) {
        fetch('/api/schedule/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: today }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.slots) {
              dispatch({ type: 'SET_PLANNED_SLOTS', payload: data.slots });
            }
          })
          .catch(() => {/* silent — no planned schedule today, that's OK */});
      }
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
    // Completing/un-completing a task changes the schedule — refetch it
    const today = todayISO();
    fetch(`/api/schedule?date=${today}`)
      .then(r => r.json())
      .then(data => dispatch({ type: 'SET_SCHEDULE', payload: {
        date:         today,
        planned:      data.planned      || [],
        actual:       data.actual       || [],
        timeSlots:    data.timeSlots    || [],
        flaggedTasks: data.flaggedTasks || [],
      }}))
      .catch(() => {});
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
    // Allotment changes affect the schedule — regenerate and refetch
    const today = todayISO();
    fetch('/api/schedule/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today }),
    })
      .then(() => fetch(`/api/schedule?date=${today}`))
      .then(r => r.json())
      .then(sched => dispatch({ type: 'SET_SCHEDULE', payload: {
        date:         today,
        planned:      sched.planned      || [],
        actual:       sched.actual       || [],
        timeSlots:    sched.timeSlots    || [],
        flaggedTasks: sched.flaggedTasks || [],
      }}))
      .catch(() => {});
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

  const toggleSubtask = useCallback(async (taskId, subtaskId) => {
    const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Failed to toggle subtask');
    const task = await fetch(`/api/tasks/${taskId}`).then(r => r.json());
    dispatch({ type: 'UPDATE_TASK', payload: task });
    return task;
  }, []);

  const generateAiSubtasks = useCallback(async (taskId) => {
    const task = await fetch(`/api/tasks/${taskId}`).then(r => r.json());
    const res = await fetch('/api/ai/subtasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        name:        task.name,
        description: task.description || '',
        category:    task.category,
      }),
    });
    if (!res.ok) throw new Error('AI subtask generation failed');
    const updated = await fetch(`/api/tasks/${taskId}`).then(r => r.json());
    dispatch({ type: 'UPDATE_TASK', payload: updated });
    return updated;
  }, []);

  // ── Schedule ──────────────────────────────────────────────────────────────

  const fetchSchedule = useCallback(async (date) => {
    const res = await fetch(`/api/schedule?date=${date}`);
    if (!res.ok) throw new Error('Failed to fetch schedule');
    const data = await res.json();
    dispatch({ type: 'SET_SCHEDULE', payload: {
      date,
      planned:      data.planned      || [],
      actual:       data.actual       || [],
      timeSlots:    data.timeSlots    || [],
      flaggedTasks: data.flaggedTasks || [],
    }});
    return data;
  }, []);

  const generateSchedule = useCallback(async (date) => {
    const res = await fetch('/api/schedule/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    if (!res.ok) throw new Error('Failed to generate schedule');
    const data = await res.json();
    dispatch({ type: 'SET_PLANNED_SLOTS', payload: data.slots || [] });
    return data.slots || [];
  }, []);

  const upsertSlot = useCallback(async (slotData) => {
    const res = await fetch('/api/schedule/slots', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slotData),
    });
    if (!res.ok) throw new Error('Failed to upsert slot');
    const slot = await res.json();
    dispatch({ type: 'UPSERT_SLOT', payload: slot });
    return slot;
  }, []);

  const upsertSlotBatch = useCallback(async (batchData) => {
    const res = await fetch('/api/schedule/slots/batch', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchData),
    });
    if (!res.ok) throw new Error('Batch upsert failed');
    const { slots } = await res.json();
    slots.forEach(slot => dispatch({ type: 'UPSERT_SLOT', payload: slot }));
    return slots;
  }, []);

  return (
    <AppContext.Provider value={{
      ...state,
      createTask, updateTask, deleteTask, toggleTask,
      createMission, updateMission, deleteMission,
      updateAllotments,
      addSubtask, updateSubtask, deleteSubtask, toggleSubtask, generateAiSubtasks,
      fetchSchedule, generateSchedule, upsertSlot, upsertSlotBatch,
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
