/**
 * scheduler.js - Daily Schedule Generator for Smart Planner
 * Generates a calendar-style schedule in 15-minute increments
 * Balances time across categories based on user-defined allotments
 */

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const SLOT_DURATION = 15; // minutes

/**
 * Get start and end time for a day (8 AM to 8 PM = 12 hours)
 */
function getDayBounds() {
  return { startHour: 8, endHour: 20 };
}

/**
 * Generate all time slots for the day
 */
function generateTimeSlots() {
  const { startHour, endHour } = getDayBounds();
  const slots = [];
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_DURATION) {
      const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const endMinute = minute + SLOT_DURATION;
      const endTime = `${hour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
      slots.push({
        time: startTime,
        display: `${startTime} - ${endTime}`,
        tasks: []
      });
    }
  }
  
  return slots;
}

/**
 * Get all uncompleted tasks
 */
function getUncompletedTasks() {
  if (typeof getTasks !== 'undefined') {
    return getTasks().filter(t => !t.completed);
  }
  return [];
}

/**
 * Group tasks by category
 */
function groupTasksByCategory(tasks) {
  const groups = {};
  tasks.forEach(task => {
    if (!groups[task.category]) {
      groups[task.category] = [];
    }
    groups[task.category].push(task);
  });
  return groups;
}

/**
 * Sort tasks within a category by priority
 */
function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
}

/**
 * Schedule tasks based on category allotments
 */
function scheduleTasksInternal(allotments) {
  const tasks = getUncompletedTasks();
  const tasksByCategory = groupTasksByCategory(tasks);
  const remainingAllotments = { ...allotments };
  const scheduledTasks = [];
  const unscheduledTasks = [];
  
  // Process each category
  Object.keys(allotments).forEach(category => {
    const categoryTasks = sortByPriority(tasksByCategory[category] || []);
    let availableMinutes = remainingAllotments[category];
    
    categoryTasks.forEach(task => {
      if (availableMinutes >= task.estimatedMinutes && task.estimatedMinutes > 0) {
        scheduledTasks.push({
          ...task,
          scheduledMinutes: task.estimatedMinutes,
          categoryAllotment: category
        });
        availableMinutes -= task.estimatedMinutes;
      } else if (task.estimatedMinutes > 0) {
        if (availableMinutes > 0) {
          scheduledTasks.push({
            ...task,
            scheduledMinutes: availableMinutes,
            categoryAllotment: category,
            isPartial: true
          });
        }
        unscheduledTasks.push(task);
        availableMinutes = 0;
      }
    });
  });
  
  return { scheduledTasks, unscheduledTasks };
}

/**
 * Generate the complete daily schedule
 */
function generateDailySchedule(allotments) {
  const timeSlots = generateTimeSlots();
  const { scheduledTasks, unscheduledTasks } = scheduleTasksInternal(allotments);
  
  let currentSlotIndex = 0;
  const usedSlots = new Set();
  
  // Sort scheduled tasks by priority then category
  scheduledTasks.sort((a, b) => {
    if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    return a.category.localeCompare(b.category);
  });
  
  // Schedule each task into time slots
  scheduledTasks.forEach(task => {
    let remainingMinutes = task.scheduledMinutes;
    
    while (remainingMinutes > 0 && currentSlotIndex < timeSlots.length) {
      const slotDuration = Math.min(remainingMinutes, SLOT_DURATION);
      
      if (!usedSlots.has(currentSlotIndex)) {
        timeSlots[currentSlotIndex].tasks.push({
          id: task.id,
          name: task.name,
          category: task.category,
          priority: task.priority,
          minutes: slotDuration,
          isPartial: task.isPartial
        });
        usedSlots.add(currentSlotIndex);
      } else {
        timeSlots[currentSlotIndex].tasks.push({
          id: task.id,
          name: task.name,
          category: task.category,
          priority: task.priority,
          minutes: slotDuration,
          isPartial: task.isPartial
        });
      }
      
      remainingMinutes -= SLOT_DURATION;
      
      if (remainingMinutes > 0) {
        currentSlotIndex++;
      }
    }
    
    currentSlotIndex++;
    
    if (currentSlotIndex >= timeSlots.length) {
      currentSlotIndex = 0;
    }
  });
  
  // Calculate category totals
  const categoryTotals = {};
  scheduledTasks.forEach(task => {
    if (!categoryTotals[task.category]) {
      categoryTotals[task.category] = 0;
    }
    categoryTotals[task.category] += task.scheduledMinutes;
  });
  
  return {
    timeSlots,
    scheduledTasks,
    unscheduledTasks,
    categoryTotals,
    totalSlots: timeSlots.length
  };
}

/**
 * Get category utilization percentages
 */
function getCategoryUtilization(allotments, scheduledTasks) {
  const utilization = {};
  const totals = {};
  
  Object.keys(allotments).forEach(cat => {
    totals[cat] = 0;
    utilization[cat] = 0;
  });
  
  scheduledTasks.forEach(task => {
    if (totals[task.category] !== undefined) {
      totals[task.category] += task.scheduledMinutes || task.estimatedMinutes;
    }
  });
  
  Object.keys(allotments).forEach(cat => {
    if (allotments[cat] > 0) {
      utilization[cat] = Math.round((totals[cat] / allotments[cat]) * 100);
    }
  });
  
  return utilization;
}

/**
 * Format minutes to readable duration
 */
function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateTimeSlots,
    getDayBounds,
    generateDailySchedule,
    getCategoryUtilization,
    formatDuration,
    PRIORITY_ORDER,
    SLOT_DURATION
  };
}