// app.js - Smart Planner Application
const AppState = { tasks: [], missions: [], config: { allotments: {} }, currentMissionFilter: null };
document.addEventListener('DOMContentLoaded', init);
function init() { loadData(); setupEventListeners(); render(); }
function loadData() { AppState.tasks = getTasks(); AppState.missions = getMissions(); AppState.config = getConfig(); }
function setupEventListeners() {
  document.getElementById('add-task-btn')?.addEventListener('click', () => openModal('task'));
  document.getElementById('task-form')?.addEventListener('submit', handleTaskSubmit);
  document.querySelector('#task-modal .modal-close')?.addEventListener('click', () => closeModal('task'));
  document.getElementById('add-mission-btn')?.addEventListener('click', () => openModal('mission'));
  document.getElementById('mission-form')?.addEventListener('submit', handleMissionSubmit);
  document.querySelector('#mission-modal .modal-close')?.addEventListener('click', () => closeModal('mission'));
  document.getElementById('config-btn')?.addEventListener('click', () => openModal('config'));
  document.getElementById('config-form')?.addEventListener('submit', handleConfigSubmit);
  document.querySelector('#config-modal .modal-close')?.addEventListener('click', () => closeModal('config'));
  document.getElementById('ai-analyze-btn')?.addEventListener('click', handleAIAnalyze);
  document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if(e.target === o) closeAllModals(); }));
}
function render() { renderTasks(); renderMissions(); renderSchedule(); renderAllotments(); }
function renderTasks() {
  const c = document.getElementById('task-list'); if(!c) return;
  let t = AppState.tasks; if(AppState.currentMissionFilter) t = t.filter(x => x.missionId === AppState.currentMissionFilter);
  if(t.length === 0) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No tasks yet</div><div class="empty-text">Create your first task</div></div>'; return; }
  c.innerHTML = t.map(task => '<div class="task-item fade-in" data-id="'+task.id+'"><div class="task-checkbox '+(task.completed?'checked':'')+'" onclick="toggleTask(\''+task.id+'\')"></div><div class="task-content"><div class="task-name">'+escapeHtml(task.name)+'</div><div class="task-meta"><span class="category-pill category-'+task.category+'">'+task.category.replace('-',' ')+'</span><span class="priority-badge priority-'+task.priority+'">'+task.priority+'</span><span class="task-duration">⏱ '+task.estimatedMinutes+'m</span></div></div><div class="task-actions"><button class="btn btn-ghost btn-icon" onclick="editTask(\''+task.id+'\')" title="Edit">✏️</button><button class="btn btn-ghost btn-icon" onclick="deleteTask(\''+task.id+'\')" title="Delete">🗑️</button></div></div>').join('');
}
function renderMissions() {
  const c = document.getElementById('mission-list'); if(!c) return;
  if(AppState.missions.length === 0) { c.innerHTML = '<div class="empty-state" style="padding:16px"><div class="empty-text">No missions yet</div></div>'; return; }
  c.innerHTML = AppState.missions.map(m => '<div class="mission-item '+(AppState.currentMissionFilter===m.id?'active':'')+'" onclick="filterMission(\''+m.id+'\')"><div class="mission-icon">🎯</div><div class="mission-name">'+escapeHtml(m.name)+'</div><div class="mission-count">'+AppState.tasks.filter(t => t.missionId === m.id).length+'</div></div>').join('');
}
function renderSchedule() {
  const c = document.getElementById('schedule-container'); if(!c) return;
  const d = generateDailySchedule(AppState.config.allotments);
  const slots = d.timeSlots.filter(s => s.tasks.length > 0);
  if(slots.length === 0) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">No scheduled tasks</div><div class="empty-text">Add tasks to generate schedule</div></div>'; return; }
  let h = '<table class="schedule-table"><thead><tr><th>Time</th><th>Schedule</th></tr></thead><tbody>';
  slots.forEach(s => { h += '<tr><td class="time-slot">'+s.time+'</td><td class="schedule-cell">'; s.tasks.forEach(t => { h += '<span class="schedule-task '+t.category+'" title="'+escapeHtml(t.name)+'">'+escapeHtml(t.name)+(t.isPartial?' ⏎':'')+'</span>'; }); h += '</td></tr>'; });
  h += '</tbody></table>'; c.innerHTML = h;
}
function renderAllotments() {
  const c = document.getElementById('allotment-grid'); if(!c) return;
  const d = generateDailySchedule(AppState.config.allotments); const tot = {};
  d.scheduledTasks.forEach(t => { tot[t.category] = (tot[t.category]||0) + t.scheduledMinutes; });
  const cats = Object.keys(AppState.config.allotments);
  c.innerHTML = cats.map(cat => { const a = AppState.config.allotments[cat]||0; const u = tot[cat]||0; const p = a>0?Math.min((u/a)*100,100):0; return '<div class="allotment-item"><div class="allotment-bar-container"><div class="allotment-bar '+cat+'" style="width:'+p+'%"></div></div><div class="allotment-label">'+cat.replace('-',' ')+'</div><div class="allotment-value">'+u+'/'+a+'m</div></div>'; }).join('');
}
function openModal(type) { document.getElementById(type+'-modal')?.classList.add('active'); if(type==='config') loadConfigForm(); }
function closeModal(type) { document.getElementById(type+'-modal')?.classList.remove('active'); }
function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); }
function handleTaskSubmit(e) {
  e.preventDefault(); const f = e.target; const d = { name: f['task-name'].value, description: f['task-description'].value, priority: f['task-priority'].value, category: f['task-category'].value, estimatedMinutes: parseInt(f['task-duration'].value)||30, missionId: f['task-mission'].value||null };
  if(f.dataset.editId) { updateTask(f.dataset.editId, d); } else { createTask(d); }
  f.reset(); delete f.dataset.editId; closeModal('task'); render();
}
function handleMissionSubmit(e) {
  e.preventDefault(); const f = e.target; const d = { name: f['mission-name'].value, description: f['mission-description'].value };
  if(f.dataset.editId) { updateMission(f.dataset.editId, d); } else { createMission(d); }
  f.reset(); delete f.dataset.editId; closeModal('mission'); render();
}
function handleConfigSubmit(e) {
  e.preventDefault(); const f = e.target; const a = {};
  ['explore','learn','build','integrate','reflect','office-hours','other'].forEach(cat => { a[cat] = parseInt(f['allot-'+cat]?.value)||0; });
  updateAllotments(a); closeModal('config'); loadData(); render();
}
function loadConfigForm() {
  const f = document.getElementById('config-form'); if(!f) return;
  ['explore','learn','build','integrate','reflect','office-hours','other'].forEach(cat => { const el = f['allot-'+cat]; if(el) el.value = AppState.config.allotments[cat]||0; });
}
function handleAIAnalyze() {
  const name = document.getElementById('ai-task-name')?.value||''; const desc = document.getElementById('ai-task-desc')?.value||'';
  if(!name) return;
  const suggestion = getBreakdownSuggestion(name, desc);
  const container = document.getElementById('ai-suggestions'); if(container) {
    container.innerHTML = '<div class="ai-suggestion"><span class="ai-suggestion-text">Category: '+suggestion.category+' ('+suggestion.estimatedMinutes+'min)</span><button class="btn btn-ghost ai-accept-btn" onclick="applyAISuggestion()">Apply</button></div>';
  }
  window.currentAIS}
function toggleTask(id) { toggleTaskCompletion(id); loadData(); render(); }
function editTask(id) { const t = getTask(id); if(!t) return; const f = document.getElementById('task-form'); f['task-name'].value = t.name; f['task-description'].value = t.description||''; f['task-priority'].value = t.priority; f['task-category'].value = t.category; f['task-duration'].value = t.estimatedMinutes; f['task-mission'].value = t.missionId||''; f.dataset.editId = id; openModal('task'); }
function deleteTask(id) { if(confirm('Delete this task?')) { deleteTaskFn(id); loadData(); render(); } }
function deleteTaskFn(id) { const tasks = getTasks(); const filtered = tasks.filter(t => t.id !== id); localStorage.setItem('smart-planner-tasks', JSON.stringify(filtered)); }
function filterMission(id) { AppState.currentMissionFilter = AppState.currentMissionFilter === id ? null : id; render(); }
function applyAISuggestion() { const s = window.currentAIS; if(!s) return; const f = document.getElementById('task-form'); if(f['task-category']) f['task-category'].value = s.category; if(f['task-duration']) f['task-duration'].value = s.estimatedMinutes; document.getElementById('ai-suggestions').innerHTML = ''; }
function escapeHtml(str) { if(!str) return ''; return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
