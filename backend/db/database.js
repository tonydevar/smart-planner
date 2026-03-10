'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Support DB_PATH env variable (default: data/smart-planner.db for backwards compat)
// Can be set to ./data/planner.db as per spec via env
const DB_PATH  = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'smart-planner.db');
const DATA_DIR = path.dirname(DB_PATH);
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
