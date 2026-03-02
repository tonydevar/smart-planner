/**
 * storage.js - LocalStorage CRUD wrappers for Smart Planner
 * Handles persistence of tasks, missions, and daily configuration
 */

// Storage keys
const STORAGE_KEYS = {
  TASKS: 'smart-planner-tasks',
  MISSIONS: 'smart-planner-missions',
  CONFIG: 'smart-planner-config'
};

// Default daily time allotments (in minutes)
const DEFAULT_ALLOTMENTS = {
  explore: 60,
  learn: 120,
  build: 180,
  integrate: 60,
  reflect: 30,
  'office-hours': 60,
  other: 60
};

/**
 * Generate a UUID
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get all tasks from storage
 */
function getTasks() {
  const data = localStorage.getItem(STORAGE_KEYS.TASKS);
  return data ? JSON.parse(data) : [];
}

/**
 * Save all tasks to storage
 */
function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
}

/**
 * Get all missions from storage
 */
function getMissions() {
  const data = localStorage.getItem(STORAGE_KEYS.MISSIONS);
  return data ? JSON.parse(data) : [];
}

/**
 * Save all missions to storage
 */
function saveMissions(missions) {
  localStorage.setItem(STORAGE_KEYS.MISSIONS, JSON.stringify(missions));
}

/**
 * Get daily configuration (time allotments)
 */
function getConfig() {
  const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
  if (!data) {
    return { allotments: { ...DEFAULT_ALLOTMENTS } };
  }
  return JSON.parse(data);
}

/**
 * Save daily configuration
 */
function saveConfig(config) {
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
}

/**
 * Create a new task
 */
function createTask(taskData) {
  const tasks = getTasks();
  const task = {
    id: generateId(),
    missionId: taskData.missionId || null,
    name: taskData.name,
    description: taskData.description || '',
    priority: taskData.priority || 'medium',
    category: taskData.category || 'other',
    estimatedMinutes: taskData.estimatedMinutes || 30,
    completed: false,
    subtasks: [],
    createdAt: new Date().toISOString()
  };
  tasks.push(task);
  saveTasks(tasks);
  return task;
}

/**
 * Update an existing task
 */
function updateTask(taskId, updates) {
  const tasks = getTasks();
  const index = tasks.findIndex(t => t.id === taskId);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...updates };
    saveTasks(tasks);
    return tasks[index];
  }
  return null;
}

/**
 * Delete a task
 */
function deleteTask(taskId) {
  const tasks = getTasks();
  const filtered = tasks.filter(t => t.id !== taskId);
  saveTasks(filtered);
  return true;
}

/**
 * Get task by ID
 */
function getTask(taskId) {
  const tasks = getTasks();
  return tasks.find(t => t.id === taskId) || null;
}

/**
 * Toggle task completion
 */
function toggleTaskCompletion(taskId) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.completed = !task.completed;
    saveTasks(tasks);
    return task;
  }
  return null;
}

/**
 * Create a new mission
 */
function createMission(missionData) {
  const missions = getMissions();
  const mission = {
    id: generateId(),
    name: missionData.name,
    description: missionData.description || '',
    createdAt: new Date().toISOString()
  };
  missions.push(mission);
  saveMissions(missions);
  return mission;
}

/**
 * Update a mission
 */
function updateMission(missionId, updates) {
  const missions = getMissions();
  const index = missions.findIndex(m => m.id === missionId);
  if (index !== -1) {
    missions[index] = { ...missions[index], ...updates };
    saveMissions(missions);
    return missions[index];
  }
  return null;
}

/**
 * Delete a mission
 */
function deleteMission(missionId) {
  const missions = getMissions();
  const filtered = missions.filter(m => m.id !== missionId);
  saveMissions(filtered);
  
  // Also remove mission reference from tasks
  const tasks = getTasks();
  tasks.forEach(task => {
    if (task.missionId === missionId) {
      task.missionId = null;
    }
  });
  saveTasks(tasks);
  return true;
}

/**
 * Get mission by ID
 */
function getMission(missionId) {
  const missions = getMissions();
  return missions.find(m => m.id === missionId) || null;
}

/**
 * Get tasks by mission
 */
function getTasksByMission(missionId) {
  const tasks = getTasks();
  return tasks.filter(t => t.missionId === missionId);
}

/**
 * Update time allotments
 */
function updateAllotments(allotments) {
  const config = getConfig();
  config.allotments = { ...config.allotments, ...allotments };
  saveConfig(config);
  return config;
}

/**
 * Add subtask to a task
 */
function addSubtask(taskId, subtaskName) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    const subtask = {
      id: generateId(),
      name: subtaskName,
      completed: false
    };
    task.subtasks.push(subtask);
    saveTasks(tasks);
    return subtask;
  }
  return null;
}

/**
 * Toggle subtask completion
 */
function toggleSubtask(taskId, subtaskId) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    const subtask = task.subtasks.find(s => s.id === subtaskId);
    if (subtask) {
      subtask.completed = !subtask.completed;
      saveTasks(tasks);
      return subtask;
    }
  }
  return null;
}

/**
 * Delete subtask
 */
function deleteSubtask(taskId, subtaskId) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
    saveTasks(tasks);
    return true;
  }
  return false;
}

/**
 * Clear all data (for testing/reset)
 */
function clearAllData() {
  localStorage.removeItem(STORAGE_KEYS.TASKS);
  localStorage.removeItem(STORAGE_KEYS.MISSIONS);
  localStorage.removeItem(STORAGE_KEYS.CONFIG);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    getTasks,
    saveTasks,
    getMissions,
    saveMissions,
    getConfig,
    saveConfig,
    createTask,
    updateTask,
    deleteTask,
    getTask,
    toggleTaskCompletion,
    createMission,
    updateMission,
    deleteMission,
    getMission,
    getTasksByMission,
    updateAllotments,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    clearAllData,
    DEFAULT_ALLOTMENTS,
    STORAGE_KEYS
  };
}