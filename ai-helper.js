/**
 * ai-helper.js - Simulated AI Logic for Smart Planner
 * Provides task estimation and sub-task generation
 */

const CATEGORY_KEYWORDS = {
  explore: ['research', 'explore', 'discover', 'search', 'investigate', 'survey', 'read', 'article', 'paper', 'study'],
  learn: ['learn', 'course', 'tutorial', 'video', 'lecture', 'book', 'certification', 'training', 'education'],
  build: ['build', 'implement', 'code', 'create', 'develop', 'project', 'prototype', 'experiment', 'construct'],
  integrate: ['integrate', 'combine', 'merge', 'connect', 'bridge', 'synthesize', 'apply'],
  reflect: ['reflect', 'review', 'analyze', 'evaluate', 'assess', 'journal', 'document', 'summary'],
  'office-hours': ['meeting', 'admin', 'email', 'call', 'schedule', 'sync', 'standup', 'discussion']
};

const BASE_ESTIMATES = {
  explore: { quick: 30, medium: 60, long: 120 },
  learn: { quick: 45, medium: 90, long: 180 },
  build: { quick: 60, medium: 120, long: 240 },
  integrate: { quick: 30, medium: 60, long: 120 },
  reflect: { quick: 15, medium: 30, long: 60 },
  'office-hours': { quick: 15, medium: 30, long: 60 },
  other: { quick: 30, medium: 60, long: 120 }
};

const SUBTASK_TEMPLATES = {
  explore: ['Search for resources', 'Read materials', 'Identify key concepts', 'Take notes', 'Summarize findings'],
  learn: ['Set up environment', 'Complete module', 'Practice exercises', 'Review concepts', 'Test understanding'],
  build: ['Plan approach', 'Set up structure', 'Implement features', 'Test functionality', 'Refine code'],
  integrate: ['Identify integration points', 'Research compatibility', 'Create bridge code', 'Test system', 'Document'],
  reflect: ['Review progress', 'Identify learnings', 'Note challenges', 'Plan next steps', 'Update docs'],
  'office-hours': ['Prepare agenda', 'Gather materials', 'Conduct meeting', 'Follow up', 'Document outcomes'],
  other: ['Define requirements', 'Plan approach', 'Execute task', 'Review results', 'Document outcome']
};

function detectCategory(name, description) {
  const text = `${name} ${description}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) return category;
    }
  }
  return 'other';
}

function estimateDuration(name, description, category = 'other') {
  const text = `${name} ${description}`.toLowerCase();
  const estimates = BASE_ESTIMATES[category] || BASE_ESTIMATES.other;
  
  const quickIndicators = ['simple', 'quick', 'small', 'brief', 'easy'];
  const longIndicators = ['complex', 'detailed', 'extensive', 'comprehensive', 'thorough', 'deep'];
  
  let complexity = 'medium';
  for (const indicator of quickIndicators) {
    if (text.includes(indicator)) { complexity = 'quick'; break; }
  }
  if (complexity === 'medium') {
    for (const indicator of longIndicators) {
      if (text.includes(indicator)) { complexity = 'long'; break; }
    }
  }
  
  const timeMatch = text.match(/(\d+)\s*(hour|hr|h|minute|min|m)/i);
  if (timeMatch) {
    const value = parseInt(timeMatch[1]);
    const unit = timeMatch[2].toLowerCase();
    return unit.startsWith('h') ? value * 60 : value;
  }
  
  return estimates[complexity];
}

function generateSubtasks(name, description, category = 'other') {
  const templates = SUBTASK_TEMPLATES[category] || SUBTASK_TEMPLATES.other;
  const shuffled = [...templates].sort(() => Math.random() - 0.5);
  const count = Math.min(3 + Math.floor(Math.random() * 3), shuffled.length);
  return shuffled.slice(0, count).map(name => ({
    id: 'sub_' + Math.random().toString(36).substr(2, 9),
    name: name,
    completed: false
  }));
}

function getBreakdownSuggestion(taskName, taskDescription) {
  const category = detectCategory(taskName, taskDescription);
  const estimatedMinutes = estimateDuration(taskName, taskDescription, category);
  const subtasks = generateSubtasks(taskName, taskDescription, category);
  return { category, estimatedMinutes, subtasks };
}

function suggestPriority(name, description) {
  const text = `${name} ${description}`.toLowerCase();
  const highPriorityKeywords = ['urgent', 'critical', 'asap', 'deadline', 'important', 'must', 'required'];
  const lowPriorityKeywords = ['optional', 'nice-to-have', 'whenever', 'later', 'someday'];
  
  for (const keyword of highPriorityKeywords) {
    if (text.includes(keyword)) return 'high';
  }
  for (const keyword of lowPriorityKeywords) {
    if (text.includes(keyword)) return 'low';
  }
  return 'medium';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectCategory, estimateDuration, generateSubtasks, getBreakdownSuggestion, suggestPriority };
}
