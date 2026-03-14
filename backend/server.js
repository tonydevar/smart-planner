'use strict';

require('dotenv').config();

const path    = require('path');
const express = require('express');
const cors    = require('cors');

const distPath = path.join(__dirname, '..', 'frontend', 'dist');

if (!require('fs').existsSync(distPath)) {
  process.stderr.write('frontend/dist/ not found — run npm run build in frontend/ first\n');
}

// Run DB schema init + migrations before any route handlers load
const db                 = require('./db/database');
const { runMigration }   = require('./db/migrate');
runMigration(db);

const tasksRouter    = require('./routes/tasks');
const missionsRouter = require('./routes/missions');
const configRouter   = require('./routes/config');
const aiRouter       = require('./routes/ai');
const scheduleRouter = require('./routes/schedule');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve frontend production build
app.use(express.static(distPath));

app.use('/api/tasks',    tasksRouter);
app.use('/api/missions', missionsRouter);
app.use('/api/config',   configRouter);
app.use('/api/ai',       aiRouter);
app.use('/api/schedule', scheduleRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// SPA fallback — must be last route
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  // Server started
});

module.exports = app;
