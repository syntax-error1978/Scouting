import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH || './data/scouting.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    access_code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    name TEXT NOT NULL,
    vak_count INTEGER NOT NULL DEFAULT 20,
    duponchelia_count INTEGER NOT NULL DEFAULT 4,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vak_state (
    department_id TEXT NOT NULL,
    vak_num INTEGER NOT NULL,
    side TEXT NOT NULL DEFAULT 'A',
    side_start_date TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (department_id, vak_num)
  );

  CREATE TABLE IF NOT EXISTS readings (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    vak_num INTEGER NOT NULL,
    date TEXT NOT NULL,
    side TEXT NOT NULL,
    trips INTEGER NOT NULL DEFAULT 0,
    luis INTEGER NOT NULL DEFAULT 0,
    wolluis INTEGER NOT NULL DEFAULT 0,
    witte_vlieg INTEGER NOT NULL DEFAULT 0,
    notitie TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS duponchelia_state (
    department_id TEXT NOT NULL,
    trap_num INTEGER NOT NULL,
    pheromone_start_date TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (department_id, trap_num)
  );

  CREATE TABLE IF NOT EXISTS duponchelia_readings (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    trap_num INTEGER NOT NULL,
    date TEXT NOT NULL,
    aantal INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_departments_location ON departments(location_id);
  CREATE INDEX IF NOT EXISTS idx_readings_dept ON readings(department_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_dup_readings_dept ON duponchelia_readings(department_id, created_at);
`);
