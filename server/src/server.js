import express from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));

// De app draait meestal op hetzelfde domein als deze API (self-hosted),
// maar staat ook toe dat de GitHub Pages-versie tijdelijk tegen een eigen
// server aan praat — vandaar permissieve CORS in plaats van same-origin-only.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Access-Code, X-Admin-Token');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '../public');
app.use(express.static(PUBLIC_DIR));

function nowIso() {
  return new Date().toISOString();
}

function genAccessCode() {
  return randomBytes(4).toString('hex');
}

function ownedDept(locationId, deptId) {
  return db.prepare('SELECT id FROM departments WHERE id = ? AND location_id = ?').get(deptId, locationId);
}

/* ---------- Admin: provision a new kwekerij ---------- */

app.post('/api/locations', (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || req.get('X-Admin-Token') !== adminToken) {
    return res.status(401).json({ error: 'Ongeldig of ontbrekend admin-token' });
  }
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Naam is verplicht' });

  const id = randomUUID();
  const accessCode = genAccessCode();
  db.prepare('INSERT INTO locations (id, name, access_code, created_at) VALUES (?, ?, ?, ?)')
    .run(id, name, accessCode, nowIso());
  res.status(201).json({ id, name, accessCode });
});

/* ---------- Auth: resolve a kwekerij from its toegangscode ---------- */

function requireLocation(req, res, next) {
  const code = req.get('X-Access-Code') || req.query.code;
  if (!code) return res.status(401).json({ error: 'X-Access-Code ontbreekt' });
  const location = db.prepare('SELECT id, name FROM locations WHERE access_code = ?').get(String(code));
  if (!location) return res.status(401).json({ error: 'Ongeldige toegangscode' });
  req.location = location;
  next();
}

app.use('/api/bootstrap', requireLocation);
app.use('/api/departments', requireLocation);
app.use('/api/sync', requireLocation);
app.use('/api/push', requireLocation);

/* ---------- Bootstrap: locatie + afdelingen ophalen ---------- */

app.get('/api/bootstrap', (req, res) => {
  const departments = db.prepare(
    'SELECT id, name, vak_count AS vakCount, duponchelia_count AS duponcheliaCount FROM departments WHERE location_id = ? ORDER BY name'
  ).all(req.location.id);
  res.json({ location: req.location, departments });
});

/* ---------- Afdelingen beheren ---------- */

app.post('/api/departments', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Naam is verplicht' });
  const vakCount = Number(req.body?.vakCount) || 20;
  const duponcheliaCount = Number.isFinite(Number(req.body?.duponcheliaCount)) ? Number(req.body.duponcheliaCount) : 4;

  const id = randomUUID();
  db.prepare(
    'INSERT INTO departments (id, location_id, name, vak_count, duponchelia_count, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.location.id, name, vakCount, duponcheliaCount, nowIso());
  res.status(201).json({ id, name, vakCount, duponcheliaCount });
});

app.patch('/api/departments/:id', (req, res) => {
  if (!ownedDept(req.location.id, req.params.id)) return res.status(404).json({ error: 'Afdeling niet gevonden' });

  const fields = [];
  const values = [];
  const { name, vakCount, duponcheliaCount } = req.body || {};
  if (name !== undefined) { fields.push('name = ?'); values.push(String(name).trim()); }
  if (vakCount !== undefined) { fields.push('vak_count = ?'); values.push(Number(vakCount)); }
  if (duponcheliaCount !== undefined) { fields.push('duponchelia_count = ?'); values.push(Number(duponcheliaCount)); }
  if (!fields.length) return res.status(400).json({ error: 'Niets om bij te werken' });

  fields.push('updated_at = ?');
  values.push(nowIso(), req.params.id);
  db.prepare(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

app.delete('/api/departments/:id', (req, res) => {
  if (!ownedDept(req.location.id, req.params.id)) return res.status(404).json({ error: 'Afdeling niet gevonden' });
  const id = req.params.id;
  db.prepare('DELETE FROM readings WHERE department_id = ?').run(id);
  db.prepare('DELETE FROM vak_state WHERE department_id = ?').run(id);
  db.prepare('DELETE FROM duponchelia_readings WHERE department_id = ?').run(id);
  db.prepare('DELETE FROM duponchelia_state WHERE department_id = ?').run(id);
  db.prepare('DELETE FROM departments WHERE id = ?').run(id);
  res.json({ ok: true });
});

/* ---------- Sync: alles ophalen dat gewijzigd is sinds een tijdstip ---------- */

app.get('/api/sync', (req, res) => {
  const since = String(req.query.since || '1970-01-01T00:00:00.000Z');
  const locId = req.location.id;

  const departments = db.prepare(
    'SELECT id, name, vak_count AS vakCount, duponchelia_count AS duponcheliaCount, updated_at AS updatedAt FROM departments WHERE location_id = ? AND updated_at > ?'
  ).all(locId, since);

  const vakStates = db.prepare(
    `SELECT vs.department_id AS departmentId, vs.vak_num AS vakNum, vs.side, vs.side_start_date AS sideStartDate, vs.updated_at AS updatedAt
     FROM vak_state vs JOIN departments d ON d.id = vs.department_id
     WHERE d.location_id = ? AND vs.updated_at > ?`
  ).all(locId, since);

  const duponcheliaStates = db.prepare(
    `SELECT ds.department_id AS departmentId, ds.trap_num AS trapNum, ds.pheromone_start_date AS pheromoneStartDate, ds.updated_at AS updatedAt
     FROM duponchelia_state ds JOIN departments d ON d.id = ds.department_id
     WHERE d.location_id = ? AND ds.updated_at > ?`
  ).all(locId, since);

  const readings = db.prepare(
    `SELECT r.id, r.department_id AS departmentId, r.vak_num AS vakNum, r.date, r.side, r.trips, r.luis, r.wolluis, r.witte_vlieg AS witteVlieg, r.notitie, r.created_at AS createdAt
     FROM readings r JOIN departments d ON d.id = r.department_id
     WHERE d.location_id = ? AND r.created_at > ?`
  ).all(locId, since);

  const duponcheliaReadings = db.prepare(
    `SELECT dr.id, dr.department_id AS departmentId, dr.trap_num AS trapNum, dr.date, dr.aantal, dr.created_at AS createdAt
     FROM duponchelia_readings dr JOIN departments d ON d.id = dr.department_id
     WHERE d.location_id = ? AND dr.created_at > ?`
  ).all(locId, since);

  res.json({ serverTime: nowIso(), departments, vakStates, duponcheliaStates, readings, duponcheliaReadings });
});

/* ---------- Push: lokale wijzigingen versturen ---------- */

app.post('/api/push', (req, res) => {
  const locId = req.location.id;
  const { readings = [], duponcheliaReadings = [], vakStates = [], duponcheliaStates = [] } = req.body || {};

  const insertReading = db.prepare(
    `INSERT OR IGNORE INTO readings (id, department_id, vak_num, date, side, trips, luis, wolluis, witte_vlieg, notitie, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertDupReading = db.prepare(
    `INSERT OR IGNORE INTO duponchelia_readings (id, department_id, trap_num, date, aantal, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const upsertVakState = db.prepare(
    `INSERT INTO vak_state (department_id, vak_num, side, side_start_date, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(department_id, vak_num) DO UPDATE SET side = excluded.side, side_start_date = excluded.side_start_date, updated_at = excluded.updated_at
     WHERE excluded.updated_at > vak_state.updated_at`
  );
  const upsertDupState = db.prepare(
    `INSERT INTO duponchelia_state (department_id, trap_num, pheromone_start_date, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(department_id, trap_num) DO UPDATE SET pheromone_start_date = excluded.pheromone_start_date, updated_at = excluded.updated_at
     WHERE excluded.updated_at > duponchelia_state.updated_at`
  );

  for (const r of readings) {
    if (!r?.id || !ownedDept(locId, r.departmentId)) continue;
    insertReading.run(r.id, r.departmentId, r.vakNum, r.date, r.side, r.trips || 0, r.luis || 0, r.wolluis || 0, r.witteVlieg || 0, r.notitie || '', r.createdAt || nowIso());
  }
  for (const r of duponcheliaReadings) {
    if (!r?.id || !ownedDept(locId, r.departmentId)) continue;
    insertDupReading.run(r.id, r.departmentId, r.trapNum, r.date, r.aantal || 0, r.createdAt || nowIso());
  }
  for (const s of vakStates) {
    if (!ownedDept(locId, s.departmentId)) continue;
    upsertVakState.run(s.departmentId, s.vakNum, s.side, s.sideStartDate, s.updatedAt || nowIso());
  }
  for (const s of duponcheliaStates) {
    if (!ownedDept(locId, s.departmentId)) continue;
    upsertDupState.run(s.departmentId, s.trapNum, s.pheromoneStartDate, s.updatedAt || nowIso());
  }

  res.json({ ok: true, serverTime: nowIso() });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// SPA-fallback: onbekende, niet-API routes serveren de app zelf.
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Plantworld Scout server luistert op poort ${PORT}`);
});
