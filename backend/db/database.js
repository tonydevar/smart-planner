'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'smart-planner.db');
const SCHEMA   = path.join(__dirname, 'schema.sql');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Run schema on every startup (idempotent due to IF NOT EXISTS)
const schema = fs.readFileSync(SCHEMA, 'utf8');
db.exec(schema);

module.exports = db;
