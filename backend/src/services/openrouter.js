'use strict';

/**
 * openrouter.js — OpenRouter API client for Smart Planner
 *
 * All LLM calls are made server-side from this service.
 * The OPENROUTER_API_KEY is never sent to the frontend.
 *
 * Falls back to heuristic logic (ported from ai-helper.js) when:
 *   - OPENROUTER_API_KEY is not set
 *   - OpenRouter returns a non-200 status
 *   - The response JSON is malformed or missing expected fields
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-3.1-flash-lite-preview';
const REFERER = 'https://github.com/tonydevar/smart-planner';
const APP_TITLE = 'Waypoint';

// ─── Heuristic fallback (ported from ai-helper.js) ───────────────────────────

const CATEGORY_KEYWORDS = {
  explore:        ['research', 'explore', 'discover', 'search', 'investigate', 'survey', 'read', 'article', 'paper', 'study'],
  learn:          ['learn', 'course', 'tutorial', 'video', 'lecture', 'book', 'certification', 'training', 'education'],
  build:          ['build', 'implement', 'code', 'create', 'develop', 'project', 'prototype', 'experiment', 'construct'],
  integrate:      ['integrate', 'combine', 'merge', 'connect', 'bridge', 'synthesize', 'apply'],
  reflect:        ['reflect', 'review', 'analyze', 'evaluate', 'assess', 'journal', 'document', 'summary'],
  'office-hours': ['meeting', 'admin', 'email', 'call', 'schedule', 'sync', 'standup', 'discussion'],
};

const BASE_ESTIMATES = {
  explore:        { quick: 30,  medium: 60,  long: 120 },
  learn:          { quick: 45,  medium: 90,  long: 180 },
  build:          { quick: 60,  medium: 120, long: 240 },
  integrate:      { quick: 30,  medium: 60,  long: 120 },
  reflect:        { quick: 15,  medium: 30,  long: 60  },
  'office-hours': { quick: 15,  medium: 30,  long: 60  },
  other:          { quick: 30,  medium: 60,  long: 120 },
};

const SUBTASK_TEMPLATES = {
  explore:        ['Search for resources', 'Read materials', 'Identify key concepts', 'Take notes', 'Summarize findings'],
  learn:          ['Set up environment', 'Complete module', 'Practice exercises', 'Review concepts', 'Test understanding'],
  build:          ['Plan approach', 'Set up structure', 'Implement features', 'Test functionality', 'Refine code'],
  integrate:      ['Identify integration points', 'Research compatibility', 'Create bridge code', 'Test system', 'Document'],
  reflect:        ['Review progress', 'Identify learnings', 'Note challenges', 'Plan next steps', 'Update docs'],
  'office-hours': ['Prepare agenda', 'Gather materials', 'Conduct meeting', 'Follow up', 'Document outcomes'],
  other:          ['Define requirements', 'Plan approach', 'Execute task', 'Review results', 'Document outcome'],
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
  const longIndicators  = ['complex', 'detailed', 'extensive', 'comprehensive', 'thorough', 'deep'];

  let complexity = 'medium';
  for (const w of quickIndicators) {
    if (text.includes(w)) { complexity = 'quick'; break; }
  }
  if (complexity === 'medium') {
    for (const w of longIndicators) {
      if (text.includes(w)) { complexity = 'long'; break; }
    }
  }

  // Honour explicit time in task text
  const timeMatch = text.match(/(\d+)\s*(hour|hr|h\b|minute|min|m\b)/i);
  if (timeMatch) {
    const value = parseInt(timeMatch[1], 10);
    const unit  = timeMatch[2].toLowerCase();
    return unit.startsWith('h') ? value * 60 : value;
  }

  return estimates[complexity];
}

function generateFallbackSubtasks(name, description, category = 'other') {
  const templates = SUBTASK_TEMPLATES[category] || SUBTASK_TEMPLATES.other;
  // Return 3-5 subtasks deterministically (no random — deterministic for tests)
  return templates.slice(0, Math.min(4, templates.length)).map(n => ({ name: n }));
}

// ─── OpenRouter API call ──────────────────────────────────────────────────────

/**
 * Calls OpenRouter with the given prompts and returns parsed JSON.
 * Throws if the API key is missing, the response is not OK, or JSON is invalid.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<object>}
 */
async function callOpenRouter(systemPrompt, userMessage) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const response = await fetch(OPENROUTER_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': REFERER,
      'X-Title': APP_TITLE,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 200)}`);
  }

  const data    = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty content from OpenRouter');

  return JSON.parse(content);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Estimates task duration and suggests a category.
 *
 * @param {{ name: string, description: string, category?: string }} task
 * @returns {Promise<{ estimatedMinutes: number, reasoning: string, suggestedCategory: string, suggestedSubtasks: Array<{name: string}>, fallback?: boolean }>}
 */
async function estimateTask({ name = '', description = '', category = '' }) {
  const systemPrompt = `You are a task planner for someone transitioning from Software Engineering to Neuroengineering.
Estimate how long this task will take in minutes and suggest a category.
Return ONLY valid JSON in this exact shape:
{
  "estimatedMinutes": <integer, e.g. 90>,
  "reasoning": "<brief explanation>",
  "suggestedCategory": "<one of: explore|learn|build|integrate|reflect|office-hours|other>",
  "suggestedSubtasks": [{ "name": "<subtask name>" }, ...]
}
Provide 3-5 concrete subtasks.`;

  const userMessage = `Task: "${name}"\nDescription: "${description}"\nCategory hint: ${category || 'not specified'}`;

  try {
    const result = await callOpenRouter(systemPrompt, userMessage);

    const estimatedMinutes  = Number.isInteger(result.estimatedMinutes) && result.estimatedMinutes > 0
      ? result.estimatedMinutes
      : estimateDuration(name, description, category || detectCategory(name, description));

    const reasoning          = typeof result.reasoning === 'string' ? result.reasoning : '';
    const suggestedCategory  = typeof result.suggestedCategory === 'string' && result.suggestedCategory
      ? result.suggestedCategory
      : (category || detectCategory(name, description));

    const suggestedSubtasks  = Array.isArray(result.suggestedSubtasks)
      ? result.suggestedSubtasks.map(s => ({ name: String(s.name || '').trim() })).filter(s => s.name)
      : generateFallbackSubtasks(name, description, suggestedCategory);

    return { estimatedMinutes, reasoning, suggestedCategory, suggestedSubtasks };
  } catch {
    const cat = category || detectCategory(name, description);
    return {
      estimatedMinutes: estimateDuration(name, description, cat),
      reasoning:        'Estimated using heuristics (AI unavailable)',
      suggestedCategory: cat,
      suggestedSubtasks: generateFallbackSubtasks(name, description, cat),
      fallback:          true,
    };
  }
}

/**
 * Generates 3-6 concrete sub-tasks for a given task.
 *
 * @param {{ name: string, description: string, category: string }} task
 * @returns {Promise<{ subtasks: Array<{name: string}>, fallback?: boolean }>}
 */
async function generateSubtasksForTask({ name = '', description = '', category = 'other' }) {
  const systemPrompt = `You are a task breakdown assistant for someone transitioning into Neuroengineering.
Break the task into 3-6 concrete, actionable sub-tasks.
Return ONLY valid JSON in this exact shape:
{
  "subtasks": [{ "name": "<specific action>" }, ...]
}`;

  const userMessage = `Task: "${name}"\nDescription: "${description}"\nCategory: ${category} (neuroengineering career transition context)`;

  try {
    const result = await callOpenRouter(systemPrompt, userMessage);

    const subtasks = Array.isArray(result.subtasks)
      ? result.subtasks.map(s => ({ name: String(s.name || '').trim() })).filter(s => s.name)
      : generateFallbackSubtasks(name, description, category);

    if (subtasks.length === 0) {
      return { subtasks: generateFallbackSubtasks(name, description, category), fallback: true };
    }

    return { subtasks };
  } catch {
    return {
      subtasks: generateFallbackSubtasks(name, description, category),
      fallback: true,
    };
  }
}

module.exports = {
  estimateTask,
  generateSubtasksForTask,
  // Exported for testing and direct use
  detectCategory,
  estimateDuration,
  generateFallbackSubtasks,
};
