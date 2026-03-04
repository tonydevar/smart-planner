'use strict';

const { Router } = require('express');
const { detectCategory, estimateDuration, generateSubtasks } = require('../../ai-helper');

const router = Router();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash-lite';

async function callOpenRouter(systemPrompt, userMessage) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const body = JSON.stringify({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/tonydevar/smart-planner',
      'X-Title': 'Smart Planner',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenRouter');
  return JSON.parse(content);
}

// POST /api/ai/estimate
// Returns { estimatedMinutes, suggestedCategory, suggestedSubtasks: [{ name }] }
router.post('/estimate', async (req, res) => {
  const { name = '', description = '' } = req.body;

  const systemPrompt = `You are a task estimation assistant. Given a task name and description, respond ONLY with valid JSON in this exact shape:
{
  "estimatedMinutes": <integer>,
  "suggestedCategory": "<one of: explore|learn|build|integrate|office-hours|other>",
  "suggestedSubtasks": [{ "name": "<string>" }, ...]
}
Provide 3-5 subtasks. Be concise.`;

  const userMessage = `Task name: ${name}\nDescription: ${description}`;

  try {
    const result = await callOpenRouter(systemPrompt, userMessage);

    // Validate and normalise
    const estimatedMinutes  = Number.isInteger(result.estimatedMinutes) ? result.estimatedMinutes : 30;
    const suggestedCategory = result.suggestedCategory || detectCategory(name, description);
    const suggestedSubtasks = Array.isArray(result.suggestedSubtasks)
      ? result.suggestedSubtasks.map(s => ({ name: String(s.name || '') })).filter(s => s.name)
      : [];

    return res.json({ estimatedMinutes, suggestedCategory, suggestedSubtasks });
  } catch {
    // Keyword-based fallback
    const category         = detectCategory(name, description);
    const estimatedMinutes = estimateDuration(name, description, category);
    const subtasks         = generateSubtasks(name, description, category);

    return res.json({
      estimatedMinutes,
      suggestedCategory:  category,
      suggestedSubtasks:  subtasks.map(s => ({ name: s.name })),
    });
  }
});

// POST /api/ai/subtasks
// Returns { subtasks: [{ name }] }
router.post('/subtasks', async (req, res) => {
  const { name = '', description = '', category = 'other' } = req.body;

  const systemPrompt = `You are a task breakdown assistant. Given a task name, description, and category, respond ONLY with valid JSON in this exact shape:
{
  "subtasks": [{ "name": "<string>" }, ...]
}
Provide 3-6 specific, actionable subtasks. Be concise.`;

  const userMessage = `Task name: ${name}\nDescription: ${description}\nCategory: ${category}`;

  try {
    const result = await callOpenRouter(systemPrompt, userMessage);
    const subtasks = Array.isArray(result.subtasks)
      ? result.subtasks.map(s => ({ name: String(s.name || '') })).filter(s => s.name)
      : [];

    return res.json({ subtasks });
  } catch {
    // Keyword-based fallback
    const detectedCategory = category || detectCategory(name, description);
    const fallback         = generateSubtasks(name, description, detectedCategory);

    return res.json({ subtasks: fallback.map(s => ({ name: s.name })) });
  }
});

module.exports = router;
