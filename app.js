'use strict';

/* ---------- Constants ---------- */

const DEFAULT_VAK_COUNT = 20;
const DEFAULT_DUP_COUNT = 4;

// Small schematic SVG silhouettes (no matching emoji exists for these pests).
const BUG_ICONS = {
  trips: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="none" stroke="#d4a017" stroke-width="1" stroke-linecap="round"><ellipse cx="13" cy="12" rx="7.5" ry="1.8" fill="#d4a017" stroke="none"/><circle cx="5.5" cy="12" r="1.6" fill="#8a6d0f" stroke="none"/><line x1="4.2" y1="10.5" x2="2" y2="8.5"/><line x1="4.2" y1="13.5" x2="2" y2="15.5"/><line x1="9" y1="10.5" x2="9" y2="7.5"/><line x1="12" y1="10.5" x2="12" y2="7.2"/><line x1="15" y1="10.5" x2="15" y2="7.5"/><line x1="9" y1="13.5" x2="9" y2="16.5"/><line x1="12" y1="13.5" x2="12" y2="16.8"/><line x1="15" y1="13.5" x2="15" y2="16.5"/></g></svg>`,
  luis: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><ellipse cx="12" cy="14.5" rx="6" ry="7" fill="#2e7d32"/><circle cx="12" cy="6" r="2.4" fill="#1e5c22"/><line x1="10.5" y1="4.3" x2="8.5" y2="1.8" stroke="#1e5c22" stroke-width="1" stroke-linecap="round"/><line x1="13.5" y1="4.3" x2="15.5" y2="1.8" stroke="#1e5c22" stroke-width="1" stroke-linecap="round"/></svg>`,
  wolluis: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g stroke="#8d7bb0" stroke-width="1.1" stroke-linecap="round"><line x1="19" y1="12" x2="23" y2="12"/><line x1="17.7" y1="14.9" x2="20.1" y2="16.7"/><line x1="14.2" y1="16.8" x2="15.1" y2="19.6"/><line x1="9.8" y1="16.8" x2="8.9" y2="19.6"/><line x1="6.3" y1="14.9" x2="3.9" y2="16.7"/><line x1="5" y1="12" x2="1" y2="12"/><line x1="6.3" y1="9.1" x2="3.9" y2="7.3"/><line x1="9.8" y1="7.2" x2="8.9" y2="4.4"/><line x1="14.2" y1="7.2" x2="15.1" y2="4.4"/><line x1="17.7" y1="9.1" x2="20.1" y2="7.3"/></g><ellipse cx="12" cy="12" rx="7" ry="5" fill="#f4f1ea" stroke="#8d7bb0" stroke-width="1"/></svg>`,
  witteVlieg: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><polygon points="12,8 3,18 12,14" fill="#eef8fd" stroke="#3fa9d6" stroke-width="1"/><polygon points="12,8 21,18 12,14" fill="#eef8fd" stroke="#3fa9d6" stroke-width="1"/><line x1="12" y1="8" x2="12" y2="18" stroke="#4a4a4a" stroke-width="1"/><circle cx="12" cy="6.8" r="1.3" fill="#4a4a4a"/><line x1="11" y1="5.5" x2="9" y2="3" stroke="#4a4a4a" stroke-width="0.8" stroke-linecap="round"/><line x1="13" y1="5.5" x2="15" y2="3" stroke="#4a4a4a" stroke-width="0.8" stroke-linecap="round"/></svg>`
};

const INSECTS = [
  { key: 'trips', label: 'Trips', color: '#d4a017' },
  { key: 'luis', label: 'Luis', color: '#2e7d32' },
  { key: 'wolluis', label: 'Wolluis', color: '#8d7bb0' },
  { key: 'witteVlieg', label: 'Witte vlieg', color: '#4fc3f7' }
];

function bugIcon(key) {
  return `<span class="bug-icon">${BUG_ICONS[key] || ''}</span>`;
}

function renderBugIconPlaceholders() {
  document.querySelectorAll('[data-bug]').forEach(el => {
    el.innerHTML = BUG_ICONS[el.dataset.bug] || '';
  });
}

const DATA_KEY = 'scouting_data_v1';
const SETTINGS_KEY = 'scouting_settings_v1';

/* ---------- Utilities ---------- */

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr + 'T00:00:00');
  const now = new Date(todayStr() + 'T00:00:00');
  return Math.round((now - then) / 86400000);
}

function genId() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}

function fmtDate(d) {
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y}`;
}

function escapeCsv(val) {
  const s = String(val ?? '');
  if (/[;"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function escapeHtml(val) {
  return String(val ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Data layer ---------- */

// updatedAt start op een epoch-sentinel (niet "nu"): dit is een automatisch
// aangemaakte standaardstatus, geen echte gebruikersactie. Zo wint een
// binnenkomende serverstatus bij sync altijd van een nooit-aangeraakt vak,
// in plaats van dat het aanmaakmoment ten onrechte als "recentste wijziging"
// telt.
const EPOCH = '1970-01-01T00:00:00.000Z';

function makeVakken(count) {
  const vakken = {};
  for (let i = 1; i <= count; i++) {
    vakken[i] = { card: { side: 'A', sideStartDate: todayStr(), updatedAt: EPOCH }, readings: [] };
  }
  return vakken;
}

function makeDuponchelia(count) {
  const duponchelia = {};
  for (let i = 1; i <= count; i++) {
    duponchelia[i] = { pheromoneStartDate: todayStr(), updatedAt: EPOCH, readings: [] };
  }
  return duponchelia;
}

function makeDepartment(name, vakCount = DEFAULT_VAK_COUNT, duponcheliaCount = DEFAULT_DUP_COUNT) {
  return {
    id: genId(),
    name,
    vakCount,
    duponcheliaCount,
    vakken: makeVakken(vakCount),
    duponchelia: makeDuponchelia(duponcheliaCount)
  };
}

function defaultData() {
  return {
    departments: [
      makeDepartment('28'),
      makeDepartment('29'),
      makeDepartment('30')
    ]
  };
}

function defaultSettings() {
  return { cardMaxDays: 14, pheromoneMaxDays: 42, defaultEmails: '' };
}

// Older versions stored departments as a plain object keyed by department
// name (e.g. {"28": {...}}). Convert that into the current array-of-objects
// shape (stable id, editable name) without losing any recorded data.
function migrateDepartments(oldObj) {
  return Object.keys(oldObj).map(name => {
    const d = oldObj[name] || {};
    const vakken = d.vakken || {};
    const duponchelia = d.duponchelia || {};
    return {
      id: genId(),
      name,
      vakCount: Object.keys(vakken).length,
      duponcheliaCount: Object.keys(duponchelia).length,
      vakken,
      duponchelia
    };
  });
}

// Backfills fields needed for server-sync (updatedAt on state, and
// departmentId/vakNum|trapNum on readings) onto data that predates the
// sync feature, so old local data can be pushed/merged correctly.
function ensureSyncFields(d) {
  d.departments.forEach(dept => {
    Object.keys(dept.vakken).forEach(num => {
      const vak = dept.vakken[num];
      if (!vak.card.updatedAt) vak.card.updatedAt = EPOCH;
      vak.readings.forEach(r => {
        if (r.departmentId === undefined) r.departmentId = dept.id;
        if (r.vakNum === undefined) r.vakNum = Number(num);
      });
    });
    Object.keys(dept.duponchelia).forEach(num => {
      const trap = dept.duponchelia[num];
      if (!trap.updatedAt) trap.updatedAt = EPOCH;
      trap.readings.forEach(r => {
        if (r.departmentId === undefined) r.departmentId = dept.id;
        if (r.trapNum === undefined) r.trapNum = Number(num);
      });
    });
  });
  return d;
}

let data = loadData();
let settings = loadSettings();

function loadData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (parsed.departments && !Array.isArray(parsed.departments)) {
      parsed.departments = migrateDepartments(parsed.departments);
    }
    if (!Array.isArray(parsed.departments)) parsed.departments = [];
    return ensureSyncFields(parsed);
  } catch (e) {
    console.error('Kon data niet laden, begin opnieuw', e);
    return defaultData();
  }
}

function saveData() {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings(), ...JSON.parse(raw) } : defaultSettings();
  } catch (e) {
    return defaultSettings();
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getDept(id) {
  return data.departments.find(d => d.id === id) || null;
}

function deptName(id) {
  const d = getDept(id);
  return d ? d.name : '?';
}

/* ---------- Server sync (fase 1: gedeelde data per kwekerij) ---------- */
//
// Optioneel: als er verbinding is gemaakt met een server (zie Instellingen),
// blijft de app hetzelfde lokale-first gedrag houden (elke actie werkt
// direct en offline), maar worden tellingen en kaart-/feromoonstatus ook
// naar de server gestuurd en van andere scouts opgehaald. Zonder server
// verandert er niets aan het bestaande lokale-only gedrag.

const SERVER_KEY = 'scouting_server_v1';
const PENDING_KEY = 'scouting_pending_push_v1';

function loadServer() {
  try {
    const raw = localStorage.getItem(SERVER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveServer() {
  if (server) localStorage.setItem(SERVER_KEY, JSON.stringify(server));
  else localStorage.removeItem(SERVER_KEY);
}

function emptyPending() {
  return { readings: [], duponcheliaReadings: [], vakStates: [], duponcheliaStates: [] };
}

function loadPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? { ...emptyPending(), ...JSON.parse(raw) } : emptyPending();
  } catch (e) {
    return emptyPending();
  }
}

function savePending() {
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

function pendingCount() {
  return pending.readings.length + pending.duponcheliaReadings.length + pending.vakStates.length + pending.duponcheliaStates.length;
}

let server = loadServer();
let pending = loadPending();

async function apiFetch(baseUrl, code, path, opts = {}) {
  const res = await fetch(baseUrl.replace(/\/$/, '') + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Access-Code': code, ...(opts.headers || {}) }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Serverfout (${res.status})`);
  }
  return res.json();
}

function serverFetch(path, opts) {
  if (!server) return Promise.reject(new Error('Niet verbonden met een server'));
  return apiFetch(server.url, server.accessCode, path, opts);
}

// Vervangt vak/duponchelia-aantallen zodat ze overeenkomen met de server,
// zonder bestaande tellingen/status kwijt te raken (zelfde groei/krimp-
// logica als handmatig beheer, maar zonder bevestigingsvraag).
function reconcileCounts(dept, vakCount, duponcheliaCount) {
  const curVak = Object.keys(dept.vakken).length;
  for (let i = curVak + 1; i <= vakCount; i++) dept.vakken[i] = { card: { side: 'A', sideStartDate: todayStr(), updatedAt: EPOCH }, readings: [] };
  for (let i = vakCount + 1; i <= curVak; i++) delete dept.vakken[i];
  dept.vakCount = vakCount;

  const curDup = Object.keys(dept.duponchelia).length;
  for (let i = curDup + 1; i <= duponcheliaCount; i++) dept.duponchelia[i] = { pheromoneStartDate: todayStr(), updatedAt: EPOCH, readings: [] };
  for (let i = duponcheliaCount + 1; i <= curDup; i++) delete dept.duponchelia[i];
  dept.duponcheliaCount = duponcheliaCount;
  return dept;
}

function makeDepartmentWithId(id, name, vakCount, duponcheliaCount) {
  const dept = makeDepartment(name, vakCount, duponcheliaCount);
  dept.id = id;
  return dept;
}

// Eerste keer verbinden: afdelingen matchen op naam. Lokale afdelingen die
// de server nog niet kent worden aangemaakt op de server; server-afdelingen
// die lokaal nog niet bestaan worden lokaal aangemaakt (leeg). Bij een
// naam-match wordt de lokale historie behouden onder het server-id.
async function connectToServer(url, code) {
  const boot = await apiFetch(url, code, '/api/bootstrap');
  server = { url: url.replace(/\/$/, ''), accessCode: code, locationName: boot.location.name, lastSyncTime: null };

  const serverDepts = boot.departments;
  const serverByName = new Map(serverDepts.map(d => [d.name, d]));
  const localByName = new Map(data.departments.map(d => [d.name, d]));

  const merged = [];
  for (const sd of serverDepts) {
    const local = localByName.get(sd.name);
    if (local) {
      local.id = sd.id;
      reconcileCounts(local, sd.vakCount, sd.duponcheliaCount);
      merged.push(local);
    } else {
      merged.push(makeDepartmentWithId(sd.id, sd.name, sd.vakCount, sd.duponcheliaCount));
    }
  }
  for (const ld of data.departments) {
    if (!serverByName.has(ld.name)) {
      const created = await apiFetch(server.url, server.accessCode, '/api/departments', {
        method: 'POST',
        body: JSON.stringify({ name: ld.name, vakCount: ld.vakCount, duponcheliaCount: ld.duponcheliaCount })
      });
      ld.id = created.id;
      merged.push(ld);
    }
  }

  data.departments = merged;
  saveServer();
  saveData();
  currentAfdeling = data.departments[0] ? data.departments[0].id : null;

  await syncPull();
  await flushPush();
}

function disconnectServer() {
  server = null;
  saveServer();
}

// Haalt alles op dat sinds de laatste sync gewijzigd is en voegt het lokaal
// samen: nieuwe afdelingen/tellingen worden toegevoegd (tellingen zijn
// append-only en gededupliceerd op id), kaart-/feromoonstatus gebruikt
// "laatste wijziging wint" op basis van updatedAt.
async function syncPull() {
  if (!server) return;
  const since = server.lastSyncTime || EPOCH;
  const res = await serverFetch(`/api/sync?since=${encodeURIComponent(since)}`);

  res.departments.forEach(sd => {
    let dept = getDept(sd.id);
    if (!dept) {
      dept = makeDepartmentWithId(sd.id, sd.name, sd.vakCount, sd.duponcheliaCount);
      data.departments.push(dept);
    } else {
      dept.name = sd.name;
      reconcileCounts(dept, sd.vakCount, sd.duponcheliaCount);
    }
  });

  res.vakStates.forEach(vs => {
    const vak = getDept(vs.departmentId)?.vakken[vs.vakNum];
    if (!vak) return;
    if (!vak.card.updatedAt || vs.updatedAt > vak.card.updatedAt) {
      vak.card.side = vs.side;
      vak.card.sideStartDate = vs.sideStartDate;
      vak.card.updatedAt = vs.updatedAt;
    }
  });

  res.duponcheliaStates.forEach(ds => {
    const trap = getDept(ds.departmentId)?.duponchelia[ds.trapNum];
    if (!trap) return;
    if (!trap.updatedAt || ds.updatedAt > trap.updatedAt) {
      trap.pheromoneStartDate = ds.pheromoneStartDate;
      trap.updatedAt = ds.updatedAt;
    }
  });

  res.readings.forEach(r => {
    const vak = getDept(r.departmentId)?.vakken[r.vakNum];
    if (!vak || vak.readings.some(x => x.id === r.id)) return;
    vak.readings.push({ id: r.id, date: r.date, side: r.side, trips: r.trips, luis: r.luis, wolluis: r.wolluis, witteVlieg: r.witteVlieg, notitie: r.notitie, departmentId: r.departmentId, vakNum: r.vakNum });
  });

  res.duponcheliaReadings.forEach(r => {
    const trap = getDept(r.departmentId)?.duponchelia[r.trapNum];
    if (!trap || trap.readings.some(x => x.id === r.id)) return;
    trap.readings.push({ id: r.id, date: r.date, aantal: r.aantal, departmentId: r.departmentId, trapNum: r.trapNum });
  });

  server.lastSyncTime = res.serverTime;
  saveServer();
  saveData();
}

function queueReading(kind, item) {
  pending[kind].push(item);
  savePending();
  flushPush();
}

function queueState(kind, item, matchKeys) {
  pending[kind] = pending[kind].filter(x => !matchKeys.every(k => x[k] === item[k]));
  pending[kind].push(item);
  savePending();
  flushPush();
}

async function flushPush() {
  if (!server || !pendingCount()) return;
  const payload = pending;
  try {
    await serverFetch('/api/push', { method: 'POST', body: JSON.stringify(payload) });
    pending = emptyPending();
    savePending();
  } catch (e) {
    console.warn('Push mislukt, blijft in wachtrij tot de volgende poging', e);
  }
}

/* ---------- State ---------- */

let currentAfdeling = data.departments[0] ? data.departments[0].id : null;
let currentVak = '1';
let currentDup = '1';

/* ---------- Toast ---------- */

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

/* ---------- Tabs ---------- */

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'analyse') {
        renderAnalyse();
        if (server) syncPull().then(renderAnalyse).catch(e => console.warn('Sync bij openen Analyse mislukt', e));
      }
    });
  });
}

/* ---------- Scouten tab: selectors ---------- */

function initSelectors() {
  const afdelingSelect = document.getElementById('afdelingSelect');
  afdelingSelect.addEventListener('change', () => {
    currentAfdeling = afdelingSelect.value;
    renderVakSelect();
    renderDupSelect();
    renderScoutenTab();
  });

  document.getElementById('vakSelect').addEventListener('change', e => {
    currentVak = e.target.value;
    renderScoutenTab();
  });

  document.getElementById('dupSelect').addEventListener('change', e => {
    currentDup = e.target.value;
    renderDuponchelia();
  });

  populateAfdelingSelects();
  document.getElementById('tellingDatum').value = todayStr();
}

// Rebuilds the Scouten- and Analyse-tab afdeling dropdowns from the current
// department list. Called on init and whenever departments are added,
// renamed or removed via Instellingen.
function populateAfdelingSelects() {
  const afdelingSelect = document.getElementById('afdelingSelect');
  const wantedAfdeling = data.departments.some(d => d.id === currentAfdeling) ? currentAfdeling : (data.departments[0] ? data.departments[0].id : null);
  afdelingSelect.innerHTML = '';
  data.departments.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    afdelingSelect.appendChild(opt);
  });
  currentAfdeling = wantedAfdeling;
  if (currentAfdeling) afdelingSelect.value = currentAfdeling;

  const analyseSelect = document.getElementById('analyseAfdelingSelect');
  const keepAnalyseVal = analyseSelect.value;
  analyseSelect.innerHTML = '<option value="alle">Alle afdelingen</option>';
  data.departments.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    analyseSelect.appendChild(opt);
  });
  const stillValid = keepAnalyseVal === 'alle' || data.departments.some(d => d.id === keepAnalyseVal);
  analyseSelect.value = stillValid ? keepAnalyseVal : 'alle';

  renderVakSelect();
  renderDupSelect();
}

function renderVakSelect() {
  const vakSelect = document.getElementById('vakSelect');
  const dept = getDept(currentAfdeling);
  vakSelect.innerHTML = '';
  if (!dept) return;
  for (let i = 1; i <= dept.vakCount; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Vak ${i}`;
    vakSelect.appendChild(opt);
  }
  if (!dept.vakken[currentVak]) currentVak = '1';
  vakSelect.value = currentVak;
}

function renderDupSelect() {
  const dupSelect = document.getElementById('dupSelect');
  const dept = getDept(currentAfdeling);
  dupSelect.innerHTML = '';
  if (!dept) return;
  for (let i = 1; i <= dept.duponcheliaCount; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Vangbak ${i}`;
    dupSelect.appendChild(opt);
  }
  if (!dept.duponchelia[currentDup]) currentDup = '1';
  dupSelect.value = currentDup;
}

function getVak(afdelingId, vak) {
  const dept = getDept(afdelingId);
  return dept ? dept.vakken[vak] : null;
}

/* ---------- Card status ---------- */

function renderCardStatus() {
  const vak = getVak(currentAfdeling, currentVak);
  if (!vak) return;
  document.getElementById('vakTitel').textContent = `— ${deptName(currentAfdeling)}, Vak ${currentVak}`;
  const days = daysSince(vak.card.sideStartDate);
  const maxDays = settings.cardMaxDays;
  const warn = days !== null && days >= maxDays;
  document.getElementById('cardStatusBody').innerHTML = `
    <div class="status-line"><span>Huidige kant</span><span class="val">${vak.card.side}</span></div>
    <div class="status-line"><span>In gebruik sinds</span><span class="val">${fmtDate(vak.card.sideStartDate)}</span></div>
    <div class="status-line"><span>Dagen in gebruik</span><span class="val">${days} ${warn ? `<span class="badge warn">⚠️ draaien/vervangen</span>` : `<span class="badge ok">OK</span>`}</span></div>
  `;
}

function pushVakState(vak) {
  if (!server) return;
  queueState('vakStates', {
    departmentId: currentAfdeling,
    vakNum: Number(currentVak),
    side: vak.card.side,
    sideStartDate: vak.card.sideStartDate,
    updatedAt: vak.card.updatedAt
  }, ['departmentId', 'vakNum']);
}

function initCardActions() {
  document.getElementById('btnGedraaid').addEventListener('click', () => {
    const vak = getVak(currentAfdeling, currentVak);
    if (!vak) return;
    const effDate = document.getElementById('tellingDatum').value || todayStr();
    vak.card.side = vak.card.side === 'A' ? 'B' : 'A';
    vak.card.sideStartDate = effDate;
    vak.card.updatedAt = nowIso();
    saveData();
    renderCardStatus();
    pushVakState(vak);
    toast(`Kaart gedraaid naar kant ${vak.card.side}`);
  });

  document.getElementById('btnVervangen').addEventListener('click', () => {
    const vak = getVak(currentAfdeling, currentVak);
    if (!vak) return;
    const effDate = document.getElementById('tellingDatum').value || todayStr();
    vak.card.side = 'A';
    vak.card.sideStartDate = effDate;
    vak.card.updatedAt = nowIso();
    saveData();
    renderCardStatus();
    pushVakState(vak);
    toast('Nieuwe vangkaart geplaatst');
  });
}

/* ---------- Telling form ---------- */

function initTellingForm() {
  document.getElementById('tellingForm').addEventListener('submit', e => {
    e.preventDefault();
    const vak = getVak(currentAfdeling, currentVak);
    if (!vak) return;
    const reading = {
      id: genId(),
      date: document.getElementById('tellingDatum').value || todayStr(),
      side: vak.card.side,
      trips: Number(document.getElementById('inputTrips').value) || 0,
      luis: Number(document.getElementById('inputLuis').value) || 0,
      wolluis: Number(document.getElementById('inputWolluis').value) || 0,
      witteVlieg: Number(document.getElementById('inputWitteVlieg').value) || 0,
      notitie: document.getElementById('inputNotitie').value.trim(),
      departmentId: currentAfdeling,
      vakNum: Number(currentVak)
    };
    vak.readings.push(reading);
    saveData();
    renderVakHistorie();
    document.getElementById('tellingForm').reset();
    document.getElementById('tellingDatum').value = todayStr();
    if (server) queueReading('readings', reading);
    toast('Telling opgeslagen');
  });
}

function renderVakHistorie() {
  const vak = getVak(currentAfdeling, currentVak);
  const el = document.getElementById('vakHistorie');
  if (!vak) { el.innerHTML = ''; return; }
  const list = [...vak.readings].sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) {
    el.innerHTML = '<p class="muted">Nog geen tellingen voor dit vak.</p>';
    return;
  }
  el.innerHTML = list.map(r => `
    <div class="hist-item">
      <div>
        <div><strong>${fmtDate(r.date)}</strong> · kant ${r.side}</div>
        <div class="meta">${bugIcon('trips')}${r.trips} · ${bugIcon('luis')}${r.luis} · ${bugIcon('wolluis')}${r.wolluis} · ${bugIcon('witteVlieg')}${r.witteVlieg}${r.notitie ? ' · ' + escapeHtml(r.notitie) : ''}</div>
      </div>
      <button class="del-btn" data-id="${r.id}" aria-label="Verwijderen">🗑️</button>
    </div>
  `).join('');
  el.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const vak2 = getVak(currentAfdeling, currentVak);
      vak2.readings = vak2.readings.filter(r => r.id !== btn.dataset.id);
      saveData();
      renderVakHistorie();
    });
  });
}

/* ---------- Duponchelia ---------- */

function renderDuponchelia() {
  document.getElementById('duponcheliaAfdelingLabel').textContent = `— ${deptName(currentAfdeling)}`;
  const dept = getDept(currentAfdeling);
  const el = document.getElementById('duponcheliaList');
  if (!dept) { el.innerHTML = ''; return; }
  const maxDays = settings.pheromoneMaxDays;

  const num = currentDup;
  const trap = dept.duponchelia[num];
  if (!trap) { el.innerHTML = ''; return; }
  const days = daysSince(trap.pheromoneStartDate);
  const warn = days !== null && days >= maxDays;
  const lastReading = [...trap.readings].sort((a, b) => b.date.localeCompare(a.date))[0];

  el.innerHTML = `
    <div class="dup-trap">
      <div class="row1">
        <strong>Vangbak ${num}</strong>
        ${warn ? `<span class="badge warn">⚠️ feromoon vervangen</span>` : `<span class="badge ok">feromoon OK (${days}d)</span>`}
      </div>
      <div class="muted" style="margin-bottom:0.5rem;">Feromoon geplaatst: ${fmtDate(trap.pheromoneStartDate)}${lastReading ? ` · Laatste telling: ${lastReading.aantal} op ${fmtDate(lastReading.date)}` : ''}</div>
      <div class="count-row">
        <label class="field-aantal">Aantal
          <input type="number" min="0" inputmode="numeric" id="dupCount-${num}" value="0">
        </label>
        <label class="field-datum">Datum
          <input type="date" id="dupDate-${num}" value="${todayStr()}">
        </label>
        <button class="btn secondary" data-save-dup="${num}">Opslaan</button>
      </div>
      <div class="btn-row" style="margin-top:0.5rem;">
        <button class="btn secondary" data-replace-pher="${num}">🆕 Feromoon vervangen</button>
      </div>
    </div>
  `;

  el.querySelector('[data-save-dup]').addEventListener('click', () => {
    const trap2 = getDept(currentAfdeling).duponchelia[num];
    const aantal = Number(document.getElementById(`dupCount-${num}`).value) || 0;
    const date = document.getElementById(`dupDate-${num}`).value || todayStr();
    const reading = { id: genId(), date, aantal, departmentId: currentAfdeling, trapNum: Number(num) };
    trap2.readings.push(reading);
    saveData();
    renderDuponchelia();
    if (server) queueReading('duponcheliaReadings', reading);
    toast(`Telling vangbak ${num} opgeslagen`);
  });

  el.querySelector('[data-replace-pher]').addEventListener('click', () => {
    const trap2 = getDept(currentAfdeling).duponchelia[num];
    trap2.pheromoneStartDate = todayStr();
    trap2.updatedAt = nowIso();
    saveData();
    renderDuponchelia();
    if (server) {
      queueState('duponcheliaStates', {
        departmentId: currentAfdeling,
        trapNum: Number(num),
        pheromoneStartDate: trap2.pheromoneStartDate,
        updatedAt: trap2.updatedAt
      }, ['departmentId', 'trapNum']);
    }
    toast(`Feromoon vangbak ${num} vervangen`);
  });
}

/* ---------- Render whole Scouten tab ---------- */

function renderScoutenTab() {
  const empty = document.getElementById('scoutenEmpty');
  const hasDept = data.departments.length > 0;
  document.querySelectorAll('#scouten .card:not(#scoutenEmpty)').forEach(c => c.classList.toggle('hidden', !hasDept));
  document.querySelector('#scouten .selectors').classList.toggle('hidden', !hasDept);
  empty.classList.toggle('hidden', hasDept);
  if (!hasDept) return;
  renderCardStatus();
  renderVakHistorie();
  renderDuponchelia();
}

/* ---------- Analyse tab ---------- */

function initAnalyseSelectors() {
  const sel = document.getElementById('analyseAfdelingSelect');
  sel.addEventListener('change', renderAnalyse);
  document.getElementById('analysePeriodeSelect').addEventListener('change', renderAnalyse);
}

function getSelectedDepartments() {
  const val = document.getElementById('analyseAfdelingSelect').value;
  return val === 'alle' ? data.departments.map(d => d.id) : [val];
}

function getPeriodCutoff() {
  const val = document.getElementById('analysePeriodeSelect').value;
  if (val === 'alles') return null;
  const days = Number(val);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function collectVakRows(deps, cutoff) {
  const rows = [];
  deps.forEach(depId => {
    const dept = getDept(depId);
    if (!dept) return;
    Object.keys(dept.vakken).forEach(num => {
      const vak = dept.vakken[num];
      const inPeriod = vak.readings.filter(r => !cutoff || r.date >= cutoff);
      const sums = { trips: 0, luis: 0, wolluis: 0, witteVlieg: 0 };
      inPeriod.forEach(r => INSECTS.forEach(i => sums[i.key] += r[i.key]));
      const last = [...vak.readings].sort((a, b) => b.date.localeCompare(a.date))[0];
      rows.push({ dep: depId, depName: dept.name, num, sums, total: INSECTS.reduce((s, i) => s + sums[i.key], 0), last, card: vak.card });
    });
  });
  return rows;
}

function renderTotals(rows) {
  const totals = { trips: 0, luis: 0, wolluis: 0, witteVlieg: 0 };
  rows.forEach(r => INSECTS.forEach(i => totals[i.key] += r.sums[i.key]));
  document.getElementById('totalsGrid').innerHTML = INSECTS.map(i => `
    <div class="total-tile">
      <span class="num">${totals[i.key]}</span>
      <span class="lbl">${bugIcon(i.key)}${i.label}</span>
    </div>
  `).join('');
}

function renderAttention(deps) {
  const items = [];
  deps.forEach(depId => {
    const dept = getDept(depId);
    if (!dept) return;
    Object.keys(dept.vakken).forEach(num => {
      const days = daysSince(dept.vakken[num].card.sideStartDate);
      if (days >= settings.cardMaxDays) {
        items.push(`🗂️ ${escapeHtml(dept.name)}, Vak ${num}: vangkaart al ${days} dagen op kant ${dept.vakken[num].card.side} — draaien/vervangen.`);
      }
    });
    Object.keys(dept.duponchelia).forEach(num => {
      const days = daysSince(dept.duponchelia[num].pheromoneStartDate);
      if (days >= settings.pheromoneMaxDays) {
        items.push(`🪤 ${escapeHtml(dept.name)}, Duponchelia vangbak ${num}: feromoon al ${days} dagen oud — vervangen.`);
      }
    });
  });
  const el = document.getElementById('attentionList');
  el.innerHTML = items.length
    ? items.map(t => `<div class="attention-item">${t}</div>`).join('')
    : '<p class="muted">Geen aandachtspunten. 👍</p>';
}

function renderVakTableAndChart(rows) {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const tbody = document.querySelector('#vakTable tbody');
  tbody.innerHTML = sorted.map(r => `
    <tr>
      <td>${escapeHtml(r.depName)}-${r.num}</td>
      <td>${r.sums.trips}</td>
      <td>${r.sums.luis}</td>
      <td>${r.sums.wolluis}</td>
      <td>${r.sums.witteVlieg}</td>
      <td>${r.last ? fmtDate(r.last.date) : '—'}</td>
    </tr>
  `).join('');

  renderChart(sorted.slice(0, 20));
}

function renderChart(rows) {
  const svg = document.getElementById('chartPerVak');
  const maxTotal = Math.max(1, ...rows.map(r => r.total));
  const barW = 22, gap = 6, leftPad = 4, bottomPad = 26, topPad = 10;
  const width = rows.length * (barW + gap) + leftPad;
  const chartH = 180 - bottomPad - topPad;
  svg.setAttribute('viewBox', `0 0 ${width} 180`);
  svg.setAttribute('width', width);

  let bars = '';
  rows.forEach((r, idx) => {
    const x = leftPad + idx * (barW + gap);
    let yOffset = 0;
    let segs = '';
    INSECTS.forEach(ins => {
      const val = r.sums[ins.key];
      if (val <= 0) return;
      const h = (val / maxTotal) * chartH;
      const y = topPad + chartH - yOffset - h;
      segs += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${ins.color}"><title>${ins.label}: ${val}</title></rect>`;
      yOffset += h;
    });
    if (!segs) {
      segs = `<rect x="${x}" y="${topPad + chartH - 1}" width="${barW}" height="1" fill="var(--border)"></rect>`;
    }
    bars += segs;
    bars += `<text x="${x + barW / 2}" y="${180 - 8}" font-size="9" text-anchor="middle" fill="currentColor">${escapeHtml(r.depName)}-${r.num}</text>`;
  });

  svg.innerHTML = `<g style="color:var(--muted)">${bars}</g>`;
}

function gridColumns(n) {
  return Math.max(1, Math.ceil(Math.sqrt(n)));
}

// Plattegrond-achtige heatmap: één cel per vak, gegroepeerd per afdeling,
// gekleurd van geen kleur (0) tot pastel rood (het hoogste aantal in beeld).
function renderVakHeatmap(rows) {
  const el = document.getElementById('vakHeatmap');
  if (!rows.length) { el.innerHTML = '<p class="muted">Geen data.</p>'; return; }
  const maxTotal = Math.max(1, ...rows.map(r => r.total));

  const groups = [];
  const byDep = new Map();
  rows.forEach(r => {
    if (!byDep.has(r.dep)) {
      const g = { depName: r.depName, items: [] };
      byDep.set(r.dep, g);
      groups.push(g);
    }
    byDep.get(r.dep).items.push(r);
  });

  el.innerHTML = groups.map(g => {
    const cols = gridColumns(g.items.length);
    const cells = g.items.map(r => {
      const intensity = r.total > 0 ? Math.min(1, r.total / maxTotal) : 0;
      const bg = r.total > 0 ? `rgba(224,90,90,${(0.15 + intensity * 0.65).toFixed(2)})` : 'transparent';
      const title = `Vak ${r.num}: ${r.total} (T${r.sums.trips} L${r.sums.luis} W${r.sums.wolluis} Wv${r.sums.witteVlieg})`;
      return `<div class="heatmap-cell" style="background:${bg}" title="${escapeHtml(title)}">${r.num}</div>`;
    }).join('');
    return `
      <div class="heatmap-dept">
        ${groups.length > 1 ? `<div class="heatmap-dept-title">${escapeHtml(g.depName)}</div>` : ''}
        <div class="heatmap-grid" style="grid-template-columns:repeat(${cols}, 1fr)">${cells}</div>
      </div>
    `;
  }).join('');
}

function renderDuponcheliaAnalyse(deps, cutoff) {
  const el = document.getElementById('duponcheliaAnalyse');
  const rows = [];
  let html = '';
  deps.forEach(depId => {
    const dept = getDept(depId);
    if (!dept) return;
    Object.keys(dept.duponchelia).forEach(num => {
      const trap = dept.duponchelia[num];
      const inPeriod = trap.readings.filter(r => !cutoff || r.date >= cutoff);
      const total = inPeriod.reduce((s, r) => s + r.aantal, 0);
      const days = daysSince(trap.pheromoneStartDate);
      const warn = days !== null && days >= settings.pheromoneMaxDays;
      rows.push({ label: `${dept.name}-${num}`, total, warn });
      html += `<div class="status-line"><span>Vangbak ${num} (${escapeHtml(dept.name)})</span><span class="val">${total} in periode ${warn ? '· <span class="badge warn">⚠️ feromoon</span>' : ''}</span></div>`;
    });
  });
  el.innerHTML = html || '<p class="muted">Geen data.</p>';
  renderDupChart(rows);
}

function renderDupChart(rows) {
  const svg = document.getElementById('chartDuponchelia');
  if (!rows.length) { svg.innerHTML = ''; return; }
  const maxTotal = Math.max(1, ...rows.map(r => r.total));
  const barW = 26, gap = 10, leftPad = 4, bottomPad = 26, topPad = 10;
  const width = rows.length * (barW + gap) + leftPad;
  const chartH = 180 - bottomPad - topPad;
  svg.setAttribute('viewBox', `0 0 ${width} 180`);
  svg.setAttribute('width', width);

  let bars = '';
  rows.forEach((r, idx) => {
    const x = leftPad + idx * (barW + gap);
    const h = Math.max((r.total / maxTotal) * chartH, r.total > 0 ? 1 : 0);
    const y = topPad + chartH - h;
    const color = r.warn ? 'var(--accent)' : 'var(--primary)';
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h || 1}" style="fill:${h ? color : 'var(--border)'}"><title>Vangbak ${escapeHtml(r.label)}: ${r.total}${r.warn ? ' (feromoon aan vervanging toe)' : ''}</title></rect>`;
    bars += `<text x="${x + barW / 2}" y="${180 - 8}" font-size="9" text-anchor="middle" fill="currentColor">${escapeHtml(r.label)}</text>`;
  });

  svg.innerHTML = `<g style="color:var(--muted)">${bars}</g>`;
}

function renderAnalyse() {
  const deps = getSelectedDepartments();
  const cutoff = getPeriodCutoff();
  const rows = collectVakRows(deps, cutoff);
  renderTotals(rows);
  renderAttention(deps);
  renderVakTableAndChart(rows);
  renderVakHeatmap(rows);
  renderDuponcheliaAnalyse(deps, cutoff);
}

/* ---------- Export / share ---------- */

function buildCsv(deps, cutoff) {
  const lines = ['Type;Afdeling;Nummer;Datum;KantOfFeromoon;Trips;Luis;Wolluis;WitteVlieg;AantalDuponchelia;Notitie'];
  deps.forEach(depId => {
    const dept = getDept(depId);
    if (!dept) return;
    Object.keys(dept.vakken).forEach(num => {
      dept.vakken[num].readings.filter(r => !cutoff || r.date >= cutoff).forEach(r => {
        lines.push(['Vak', dept.name, num, r.date, r.side, r.trips, r.luis, r.wolluis, r.witteVlieg, '', r.notitie].map(escapeCsv).join(';'));
      });
    });
    Object.keys(dept.duponchelia).forEach(num => {
      dept.duponchelia[num].readings.filter(r => !cutoff || r.date >= cutoff).forEach(r => {
        lines.push(['Duponchelia', dept.name, num, r.date, '', '', '', '', '', r.aantal, ''].map(escapeCsv).join(';'));
      });
    });
  });
  return lines.join('\n');
}

function buildSummaryText(deps, cutoff) {
  const rows = collectVakRows(deps, cutoff);
  const totals = { trips: 0, luis: 0, wolluis: 0, witteVlieg: 0 };
  rows.forEach(r => INSECTS.forEach(i => totals[i.key] += r.sums[i.key]));
  const periodeLabel = document.getElementById('analysePeriodeSelect').selectedOptions[0].textContent;
  const afdLabel = deps.length === data.departments.length ? 'alle afdelingen' : 'afdeling ' + deps.map(deptName).join(', ');

  let text = `Plaagscouting analyse — ${afdLabel} (${periodeLabel})\n`;
  text += `Datum export: ${fmtDate(todayStr())}\n\n`;
  text += `Totalen:\n`;
  INSECTS.forEach(i => { text += `  ${i.label}: ${totals[i.key]}\n`; });

  const top5 = [...rows].sort((a, b) => b.total - a.total).filter(r => r.total > 0).slice(0, 5);
  if (top5.length) {
    text += `\nTop vakken (hoogste aantallen):\n`;
    top5.forEach(r => { text += `  ${r.depName}, Vak ${r.num}: ${r.total} (T${r.sums.trips} L${r.sums.luis} W${r.sums.wolluis} Wv${r.sums.witteVlieg})\n`; });
  }

  const attentionItems = [];
  deps.forEach(depId => {
    const dept = getDept(depId);
    if (!dept) return;
    Object.keys(dept.vakken).forEach(num => {
      const days = daysSince(dept.vakken[num].card.sideStartDate);
      if (days >= settings.cardMaxDays) attentionItems.push(`${dept.name}, Vak ${num}: kaart ${days} dagen oud (kant ${dept.vakken[num].card.side})`);
    });
    Object.keys(dept.duponchelia).forEach(num => {
      const days = daysSince(dept.duponchelia[num].pheromoneStartDate);
      if (days >= settings.pheromoneMaxDays) attentionItems.push(`${dept.name}, Duponchelia vangbak ${num}: feromoon ${days} dagen oud`);
    });
  });
  if (attentionItems.length) {
    text += `\nAandachtspunten:\n`;
    attentionItems.forEach(t => { text += `  - ${t}\n`; });
  }

  text += `\n(Volledige data als CSV bijgevoegd)`;
  return text;
}

function downloadCsvBlob(csv, filename) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function shareAnalyse() {
  const deps = getSelectedDepartments();
  const cutoff = getPeriodCutoff();
  const text = buildSummaryText(deps, cutoff);
  const csv = buildCsv(deps, cutoff);
  const filename = `scouting-analyse-${todayStr()}.csv`;

  try {
    if (navigator.canShare) {
      const file = new File([csv], filename, { type: 'text/csv' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Plaagscouting analyse', text, files: [file] });
        return;
      }
    }
    if (navigator.share) {
      await navigator.share({ title: 'Plaagscouting analyse', text });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    console.warn('Delen mislukt, gebruik e-mail fallback', e);
  }

  downloadCsvBlob(csv, filename);
  const emails = settings.defaultEmails || '';
  const subject = encodeURIComponent('Plaagscouting analyse');
  const body = encodeURIComponent(text + '\n\n(CSV-bestand is gedownload — voeg het handmatig toe als bijlage)');
  window.location.href = `mailto:${emails}?subject=${subject}&body=${body}`;
}

function initShareButtons() {
  document.getElementById('btnShareAnalyse').addEventListener('click', shareAnalyse);
  document.getElementById('btnDownloadCsv').addEventListener('click', () => {
    const deps = getSelectedDepartments();
    const cutoff = getPeriodCutoff();
    downloadCsvBlob(buildCsv(deps, cutoff), `scouting-analyse-${todayStr()}.csv`);
  });
}

/* ---------- Grafiek/heatmap toggle (Insecten per vak) ---------- */

function setVakView(view) {
  document.getElementById('vakChartView').classList.toggle('hidden', view !== 'chart');
  document.getElementById('vakHeatmapView').classList.toggle('hidden', view !== 'heatmap');
  document.querySelectorAll('.view-toggle-btn').forEach(b => {
    const active = b.dataset.view === view;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
}

function initVakViewToggle() {
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => setVakView(btn.dataset.view));
  });

  const swipeArea = document.getElementById('vakViewsSwipe');
  let startX = 0, startY = 0, tracking = false;
  swipeArea.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  swipeArea.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const current = document.querySelector('.view-toggle-btn.active').dataset.view;
      if (dx < 0 && current === 'chart') setVakView('heatmap');
      if (dx > 0 && current === 'heatmap') setVakView('chart');
    }
  }, { passive: true });
}

/* ---------- Afdelingen beheren (Instellingen) ---------- */

function renderDeptManageList() {
  const el = document.getElementById('deptManageList');
  if (!data.departments.length) {
    el.innerHTML = '<p class="muted">Nog geen afdelingen. Voeg er hieronder een toe.</p>';
    return;
  }
  el.innerHTML = data.departments.map(d => `
    <div class="dept-row" data-id="${d.id}">
      <input type="text" class="dept-name" value="${escapeHtml(d.name)}" placeholder="Naam afdeling" aria-label="Naam afdeling">
      <label class="dept-mini">Vakken
        <input type="number" min="1" max="200" class="dept-vakcount" value="${d.vakCount}">
      </label>
      <label class="dept-mini">Duponchelia
        <input type="number" min="0" max="50" class="dept-dupcount" value="${d.duponcheliaCount}">
      </label>
      <button class="icon-btn dept-delete" data-id="${d.id}" aria-label="Afdeling verwijderen">🗑️</button>
    </div>
  `).join('');

  el.querySelectorAll('.dept-name').forEach(input => {
    input.addEventListener('change', async () => {
      const dept = getDept(input.closest('.dept-row').dataset.id);
      const newName = input.value.trim();
      if (!dept || !newName) { input.value = dept ? dept.name : ''; return; }
      if (server) {
        try {
          await serverFetch(`/api/departments/${dept.id}`, { method: 'PATCH', body: JSON.stringify({ name: newName }) });
        } catch (e) {
          toast('Kon niet hernoemen op de server: ' + e.message);
          input.value = dept.name;
          return;
        }
      }
      dept.name = newName;
      saveData();
      populateAfdelingSelects();
      renderScoutenTab();
      toast('Afdeling hernoemd');
    });
  });

  el.querySelectorAll('.dept-vakcount').forEach(input => {
    input.addEventListener('change', () => {
      const dept = getDept(input.closest('.dept-row').dataset.id);
      if (!dept) return;
      applyVakCount(dept, input);
    });
  });

  el.querySelectorAll('.dept-dupcount').forEach(input => {
    input.addEventListener('change', () => {
      const dept = getDept(input.closest('.dept-row').dataset.id);
      if (!dept) return;
      applyDupCount(dept, input);
    });
  });

  el.querySelectorAll('.dept-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const dept = getDept(btn.dataset.id);
      if (!dept) return;
      if (!confirm(`Afdeling "${dept.name}" en alle bijbehorende tellingen verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;
      if (server) {
        try {
          await serverFetch(`/api/departments/${dept.id}`, { method: 'DELETE' });
        } catch (e) {
          toast('Kon niet verwijderen op de server: ' + e.message);
          return;
        }
      }
      data.departments = data.departments.filter(d => d.id !== dept.id);
      saveData();
      renderDeptManageList();
      populateAfdelingSelects();
      renderScoutenTab();
      toast('Afdeling verwijderd');
    });
  });
}

async function applyVakCount(dept, input) {
  const newCount = Math.max(1, Number(input.value) || dept.vakCount);
  if (newCount === dept.vakCount) { input.value = newCount; return; }
  if (newCount < dept.vakCount) {
    if (!confirm(`Dit verwijdert de historie van vak ${newCount + 1} t/m ${dept.vakCount} in "${dept.name}". Doorgaan?`)) {
      input.value = dept.vakCount;
      return;
    }
  }
  if (server) {
    try {
      await serverFetch(`/api/departments/${dept.id}`, { method: 'PATCH', body: JSON.stringify({ vakCount: newCount }) });
    } catch (e) {
      toast('Kon niet bijwerken op de server: ' + e.message);
      input.value = dept.vakCount;
      return;
    }
  }
  if (newCount < dept.vakCount) {
    for (let i = newCount + 1; i <= dept.vakCount; i++) delete dept.vakken[i];
  } else {
    for (let i = dept.vakCount + 1; i <= newCount; i++) {
      dept.vakken[i] = { card: { side: 'A', sideStartDate: todayStr(), updatedAt: nowIso() }, readings: [] };
    }
  }
  dept.vakCount = newCount;
  saveData();
  renderVakSelect();
  renderScoutenTab();
  toast('Aantal vakken bijgewerkt');
}

async function applyDupCount(dept, input) {
  const newCount = Math.max(0, Number(input.value) || 0);
  if (newCount === dept.duponcheliaCount) { input.value = newCount; return; }
  if (newCount < dept.duponcheliaCount) {
    if (!confirm(`Dit verwijdert de historie van vangbak ${newCount + 1} t/m ${dept.duponcheliaCount} in "${dept.name}". Doorgaan?`)) {
      input.value = dept.duponcheliaCount;
      return;
    }
  }
  if (server) {
    try {
      await serverFetch(`/api/departments/${dept.id}`, { method: 'PATCH', body: JSON.stringify({ duponcheliaCount: newCount }) });
    } catch (e) {
      toast('Kon niet bijwerken op de server: ' + e.message);
      input.value = dept.duponcheliaCount;
      return;
    }
  }
  if (newCount < dept.duponcheliaCount) {
    for (let i = newCount + 1; i <= dept.duponcheliaCount; i++) delete dept.duponchelia[i];
  } else {
    for (let i = dept.duponcheliaCount + 1; i <= newCount; i++) {
      dept.duponchelia[i] = { pheromoneStartDate: todayStr(), updatedAt: nowIso(), readings: [] };
    }
  }
  dept.duponcheliaCount = newCount;
  saveData();
  renderDupSelect();
  renderScoutenTab();
  toast('Aantal vangbakken bijgewerkt');
}

function initDeptManagement() {
  document.getElementById('btnAddDept').addEventListener('click', async () => {
    const existingNumbers = data.departments.map(d => Number(d.name)).filter(n => !isNaN(n));
    const nextName = existingNumbers.length ? String(Math.max(...existingNumbers) + 1) : 'Nieuwe afdeling';
    let dept;
    if (server) {
      try {
        const created = await serverFetch('/api/departments', {
          method: 'POST',
          body: JSON.stringify({ name: nextName, vakCount: DEFAULT_VAK_COUNT, duponcheliaCount: DEFAULT_DUP_COUNT })
        });
        dept = makeDepartmentWithId(created.id, created.name, created.vakCount, created.duponcheliaCount);
      } catch (e) {
        toast('Kon afdeling niet aanmaken op de server: ' + e.message);
        return;
      }
    } else {
      dept = makeDepartment(nextName);
    }
    data.departments.push(dept);
    saveData();
    renderDeptManageList();
    populateAfdelingSelects();
    currentAfdeling = dept.id;
    document.getElementById('afdelingSelect').value = dept.id;
    renderVakSelect();
    renderDupSelect();
    renderScoutenTab();
    toast(`Afdeling "${nextName}" toegevoegd`);
  });
}

/* ---------- Settings modal ---------- */

function renderServerStatus() {
  const statusEl = document.getElementById('serverStatus');
  const form = document.getElementById('serverConnectForm');
  const actions = document.getElementById('serverConnectedActions');
  const hint = document.getElementById('deptServerHint');
  if (server) {
    const lastSync = server.lastSyncTime ? new Date(server.lastSyncTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : 'nog niet';
    const pendingN = pendingCount();
    statusEl.textContent = `Verbonden met "${server.locationName}" · laatst gesynchroniseerd: ${lastSync}${pendingN ? ` · ${pendingN} wijziging(en) in wachtrij` : ''}`;
    form.classList.add('hidden');
    actions.classList.remove('hidden');
    hint.classList.remove('hidden');
  } else {
    statusEl.textContent = 'Niet verbonden — data blijft alleen lokaal op dit toestel.';
    form.classList.remove('hidden');
    actions.classList.add('hidden');
    hint.classList.add('hidden');
  }
}

function initServerSettings() {
  document.getElementById('btnServerConnect').addEventListener('click', async () => {
    const url = document.getElementById('serverUrl').value.trim();
    const code = document.getElementById('serverCode').value.trim();
    if (!url || !code) { toast('Vul server-URL en toegangscode in'); return; }
    const btn = document.getElementById('btnServerConnect');
    btn.disabled = true;
    try {
      await connectToServer(url, code);
      renderServerStatus();
      renderDeptManageList();
      populateAfdelingSelects();
      renderScoutenTab();
      toast(`Verbonden met "${server.locationName}"`);
    } catch (e) {
      toast('Verbinden mislukt: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btnSyncNow').addEventListener('click', async () => {
    toast('Bezig met synchroniseren...');
    try {
      await flushPush();
      await syncPull();
      renderServerStatus();
      renderScoutenTab();
      renderAnalyse();
      toast('Gesynchroniseerd');
    } catch (e) {
      toast('Synchroniseren mislukt: ' + e.message);
    }
  });

  document.getElementById('btnServerDisconnect').addEventListener('click', () => {
    if (!confirm('Loskoppelen van de server? Lokale data blijft staan, maar wordt niet meer gedeeld.')) return;
    disconnectServer();
    renderServerStatus();
    renderDeptManageList();
    toast('Losgekoppeld van de server');
  });

  window.addEventListener('online', () => {
    if (!server) return;
    flushPush().then(syncPull).catch(e => console.warn('Auto-sync bij weer online mislukt', e));
  });
}

function initSettingsModal() {
  const modal = document.getElementById('settingsModal');
  document.getElementById('copyrightYear').textContent = new Date().getFullYear();
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('defaultEmails').value = settings.defaultEmails;
    document.getElementById('cardMaxDays').value = settings.cardMaxDays;
    document.getElementById('pheromoneMaxDays').value = settings.pheromoneMaxDays;
    renderDeptManageList();
    renderServerStatus();
    modal.classList.remove('hidden');
  });
  document.getElementById('closeSettings').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

  document.getElementById('saveSettings').addEventListener('click', () => {
    settings.defaultEmails = document.getElementById('defaultEmails').value.trim();
    settings.cardMaxDays = Number(document.getElementById('cardMaxDays').value) || 14;
    settings.pheromoneMaxDays = Number(document.getElementById('pheromoneMaxDays').value) || 42;
    saveSettings();
    renderScoutenTab();
    toast('Instellingen opgeslagen');
    modal.classList.add('hidden');
  });

  document.getElementById('btnExportBackup').addEventListener('click', () => {
    const payload = JSON.stringify({ data, settings }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scouting-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });

  document.getElementById('btnImportBackup').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.data || !parsed.data.departments) throw new Error('Ongeldig back-up bestand');
        if (!confirm('Huidige data overschrijven met deze back-up?')) return;
        data = parsed.data;
        if (data.departments && !Array.isArray(data.departments)) {
          data.departments = migrateDepartments(data.departments);
        }
        settings = { ...defaultSettings(), ...(parsed.settings || {}) };
        saveData();
        saveSettings();
        populateAfdelingSelects();
        renderDeptManageList();
        renderScoutenTab();
        renderAnalyse();
        toast('Back-up geïmporteerd');
        document.getElementById('settingsModal').classList.add('hidden');
      } catch (err) {
        alert('Kon back-up niet importeren: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btnResetData').addEventListener('click', () => {
    if (!confirm('Weet je zeker dat je ALLE data wilt wissen? Dit kan niet ongedaan gemaakt worden. Maak eerst een back-up.')) return;
    data = defaultData();
    saveData();
    populateAfdelingSelects();
    renderDeptManageList();
    renderScoutenTab();
    renderAnalyse();
    toast('Alle data gewist');
    document.getElementById('settingsModal').classList.add('hidden');
  });

  document.getElementById('btnCheckUpdate').addEventListener('click', async () => {
    if (!('serviceWorker' in navigator)) { toast('Niet ondersteund in deze browser'); window.location.reload(); return; }
    toast('Bezig met controleren op updates...');
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.update();
    // De service worker activeert nieuwe versies automatisch (skipWaiting) en
    // herlaadt de pagina dan zelf via de controllerchange-listener; deze
    // herlaad-timer is een fallback voor het geval er niets te activeren viel.
    setTimeout(() => window.location.reload(), 800);
  });
}

/* ---------- Service worker ---------- */

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.update();
      }).catch(err => console.warn('SW registratie mislukt', err));

      // Zodra een nieuwe service worker de pagina overneemt (na een update),
      // eenmalig herladen zodat de nieuwe versie direct zichtbaar is —
      // anders blijft een al geopende/geinstalleerde PWA de oude cache tonen.
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    });
  }
}

/* ---------- Init ---------- */

function init() {
  renderBugIconPlaceholders();
  initTabs();
  initSelectors();
  initCardActions();
  initTellingForm();
  initAnalyseSelectors();
  initShareButtons();
  initVakViewToggle();
  initDeptManagement();
  initServerSettings();
  initSettingsModal();
  initServiceWorker();
  renderScoutenTab();

  if (server) {
    flushPush().then(syncPull).then(() => {
      renderScoutenTab();
      populateAfdelingSelects();
    }).catch(e => console.warn('Sync bij opstarten mislukt', e));
  }
}

document.addEventListener('DOMContentLoaded', init);
