'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const tasksRouter    = require('./routes/tasks');
const missionsRouter = require('./routes/missions');
const configRouter   = require('./routes/config');
const aiRouter       = require('./routes/ai');
const scheduleRouter = require('./routes/schedule');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/tasks',    tasksRouter);
app.use('/api/missions', missionsRouter);
app.use('/api/config',   configRouter);
app.use('/api/ai',       aiRouter);
app.use('/api/schedule', scheduleRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  // Server started
});

module.exports = app;
