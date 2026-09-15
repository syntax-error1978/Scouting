'use strict';

/* ---------- Constants ---------- */

const DEPARTMENTS = ['28', '29', '30'];
const VAK_COUNT = 20;
const DUP_COUNT = 4;

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

/* ---------- Data layer ---------- */

function defaultData() {
  const departments = {};
  DEPARTMENTS.forEach(dep => {
    const vakken = {};
    for (let i = 1; i <= VAK_COUNT; i++) {
      vakken[i] = { card: { side: 'A', sideStartDate: todayStr() }, readings: [] };
    }
    const duponchelia = {};
    for (let i = 1; i <= DUP_COUNT; i++) {
      duponchelia[i] = { pheromoneStartDate: todayStr(), readings: [] };
    }
    departments[dep] = { vakken, duponchelia };
  });
  return { departments };
}

function defaultSettings() {
  return { cardMaxDays: 14, pheromoneMaxDays: 42, defaultEmails: '' };
}

let data = loadData();
let settings = loadSettings();

function loadData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    // fill in any missing departments/vakken (e.g. after upgrades)
    const base = defaultData();
    DEPARTMENTS.forEach(dep => {
      if (!parsed.departments[dep]) parsed.departments[dep] = base.departments[dep];
    });
    return parsed;
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

/* ---------- State ---------- */

let currentAfdeling = DEPARTMENTS[0];
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
      if (btn.dataset.tab === 'analyse') renderAnalyse();
    });
  });
}

/* ---------- Scouten tab: selectors ---------- */

function initSelectors() {
  const afdelingSelect = document.getElementById('afdelingSelect');
  afdelingSelect.innerHTML = DEPARTMENTS.map(d => `<option value="${d}">Afdeling ${d}</option>`).join('');
  afdelingSelect.value = currentAfdeling;
  afdelingSelect.addEventListener('change', () => {
    currentAfdeling = afdelingSelect.value;
    renderVakSelect();
    renderScoutenTab();
  });

  renderVakSelect();

  document.getElementById('vakSelect').addEventListener('change', e => {
    currentVak = e.target.value;
    renderScoutenTab();
  });

  document.getElementById('tellingDatum').value = todayStr();
}

function initDupSelector() {
  const dupSelect = document.getElementById('dupSelect');
  let opts = '';
  for (let i = 1; i <= DUP_COUNT; i++) opts += `<option value="${i}">Vangbak ${i}</option>`;
  dupSelect.innerHTML = opts;
  dupSelect.value = currentDup;
  dupSelect.addEventListener('change', e => {
    currentDup = e.target.value;
    renderDuponchelia();
  });
}

function renderVakSelect() {
  const vakSelect = document.getElementById('vakSelect');
  let opts = '';
  for (let i = 1; i <= VAK_COUNT; i++) opts += `<option value="${i}">Vak ${i}</option>`;
  vakSelect.innerHTML = opts;
  vakSelect.value = currentVak;
  if (vakSelect.value !== String(currentVak)) { currentVak = '1'; vakSelect.value = '1'; }
}

function getVak(afdeling, vak) {
  return data.departments[afdeling].vakken[vak];
}

/* ---------- Card status ---------- */

function renderCardStatus() {
  const vak = getVak(currentAfdeling, currentVak);
  document.getElementById('vakTitel').textContent = `— Afd. ${currentAfdeling}, Vak ${currentVak}`;
  const days = daysSince(vak.card.sideStartDate);
  const maxDays = settings.cardMaxDays;
  const warn = days !== null && days >= maxDays;
  document.getElementById('cardStatusBody').innerHTML = `
    <div class="status-line"><span>Huidige kant</span><span class="val">${vak.card.side}</span></div>
    <div class="status-line"><span>In gebruik sinds</span><span class="val">${fmtDate(vak.card.sideStartDate)}</span></div>
    <div class="status-line"><span>Dagen in gebruik</span><span class="val">${days} ${warn ? `<span class="badge warn">⚠️ draaien/vervangen</span>` : `<span class="badge ok">OK</span>`}</span></div>
  `;
}

function initCardActions() {
  document.getElementById('btnGedraaid').addEventListener('click', () => {
    const vak = getVak(currentAfdeling, currentVak);
    const effDate = document.getElementById('tellingDatum').value || todayStr();
    vak.card.side = vak.card.side === 'A' ? 'B' : 'A';
    vak.card.sideStartDate = effDate;
    saveData();
    renderCardStatus();
    toast(`Kaart gedraaid naar kant ${vak.card.side}`);
  });

  document.getElementById('btnVervangen').addEventListener('click', () => {
    const vak = getVak(currentAfdeling, currentVak);
    const effDate = document.getElementById('tellingDatum').value || todayStr();
    vak.card.side = 'A';
    vak.card.sideStartDate = effDate;
    saveData();
    renderCardStatus();
    toast('Nieuwe vangkaart geplaatst');
  });
}

/* ---------- Telling form ---------- */

function initTellingForm() {
  document.getElementById('tellingForm').addEventListener('submit', e => {
    e.preventDefault();
    const vak = getVak(currentAfdeling, currentVak);
    const reading = {
      id: genId(),
      date: document.getElementById('tellingDatum').value || todayStr(),
      side: vak.card.side,
      trips: Number(document.getElementById('inputTrips').value) || 0,
      luis: Number(document.getElementById('inputLuis').value) || 0,
      wolluis: Number(document.getElementById('inputWolluis').value) || 0,
      witteVlieg: Number(document.getElementById('inputWitteVlieg').value) || 0,
      notitie: document.getElementById('inputNotitie').value.trim()
    };
    vak.readings.push(reading);
    saveData();
    renderVakHistorie();
    document.getElementById('tellingForm').reset();
    document.getElementById('tellingDatum').value = todayStr();
    toast('Telling opgeslagen');
  });
}

function renderVakHistorie() {
  const vak = getVak(currentAfdeling, currentVak);
  const list = [...vak.readings].sort((a, b) => b.date.localeCompare(a.date));
  const el = document.getElementById('vakHistorie');
  if (!list.length) {
    el.innerHTML = '<p class="muted">Nog geen tellingen voor dit vak.</p>';
    return;
  }
  el.innerHTML = list.map(r => `
    <div class="hist-item">
      <div>
        <div><strong>${fmtDate(r.date)}</strong> · kant ${r.side}</div>
        <div class="meta">${bugIcon('trips')}${r.trips} · ${bugIcon('luis')}${r.luis} · ${bugIcon('wolluis')}${r.wolluis} · ${bugIcon('witteVlieg')}${r.witteVlieg}${r.notitie ? ' · ' + r.notitie : ''}</div>
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
  document.getElementById('duponcheliaAfdelingLabel').textContent = `— Afd. ${currentAfdeling}`;
  const dep = data.departments[currentAfdeling];
  const el = document.getElementById('duponcheliaList');
  const maxDays = settings.pheromoneMaxDays;

  const num = currentDup;
  const trap = dep.duponchelia[num];
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
    const trap2 = data.departments[currentAfdeling].duponchelia[num];
    const aantal = Number(document.getElementById(`dupCount-${num}`).value) || 0;
    const date = document.getElementById(`dupDate-${num}`).value || todayStr();
    trap2.readings.push({ id: genId(), date, aantal });
    saveData();
    renderDuponchelia();
    toast(`Telling vangbak ${num} opgeslagen`);
  });

  el.querySelector('[data-replace-pher]').addEventListener('click', () => {
    const trap2 = data.departments[currentAfdeling].duponchelia[num];
    trap2.pheromoneStartDate = todayStr();
    saveData();
    renderDuponchelia();
    toast(`Feromoon vangbak ${num} vervangen`);
  });
}

/* ---------- Render whole Scouten tab ---------- */

function renderScoutenTab() {
  renderCardStatus();
  renderVakHistorie();
  renderDuponchelia();
}

/* ---------- Analyse tab ---------- */

function initAnalyseSelectors() {
  const sel = document.getElementById('analyseAfdelingSelect');
  DEPARTMENTS.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `Afdeling ${d}`;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', renderAnalyse);
  document.getElementById('analysePeriodeSelect').addEventListener('change', renderAnalyse);
}

function getSelectedDepartments() {
  const val = document.getElementById('analyseAfdelingSelect').value;
  return val === 'alle' ? DEPARTMENTS : [val];
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
  deps.forEach(dep => {
    const vakken = data.departments[dep].vakken;
    Object.keys(vakken).forEach(num => {
      const vak = vakken[num];
      const inPeriod = vak.readings.filter(r => !cutoff || r.date >= cutoff);
      const sums = { trips: 0, luis: 0, wolluis: 0, witteVlieg: 0 };
      inPeriod.forEach(r => INSECTS.forEach(i => sums[i.key] += r[i.key]));
      const last = [...vak.readings].sort((a, b) => b.date.localeCompare(a.date))[0];
      rows.push({ dep, num, sums, total: INSECTS.reduce((s, i) => s + sums[i.key], 0), last, card: vak.card });
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
  deps.forEach(dep => {
    const vakken = data.departments[dep].vakken;
    Object.keys(vakken).forEach(num => {
      const days = daysSince(vakken[num].card.sideStartDate);
      if (days >= settings.cardMaxDays) {
        items.push(`🗂️ Afd. ${dep}, Vak ${num}: vangkaart al ${days} dagen op kant ${vakken[num].card.side} — draaien/vervangen.`);
      }
    });
    const dup = data.departments[dep].duponchelia;
    Object.keys(dup).forEach(num => {
      const days = daysSince(dup[num].pheromoneStartDate);
      if (days >= settings.pheromoneMaxDays) {
        items.push(`🪤 Afd. ${dep}, Duponchelia vangbak ${num}: feromoon al ${days} dagen oud — vervangen.`);
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
      <td>${r.dep}-${r.num}</td>
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
    bars += `<text x="${x + barW / 2}" y="${180 - 8}" font-size="9" text-anchor="middle" fill="currentColor">${r.dep}-${r.num}</text>`;
  });

  svg.innerHTML = `<g style="color:var(--muted)">${bars}</g>`;
}

function renderDuponcheliaAnalyse(deps, cutoff) {
  const el = document.getElementById('duponcheliaAnalyse');
  const rows = [];
  let html = '';
  deps.forEach(dep => {
    const dup = data.departments[dep].duponchelia;
    Object.keys(dup).forEach(num => {
      const trap = dup[num];
      const inPeriod = trap.readings.filter(r => !cutoff || r.date >= cutoff);
      const total = inPeriod.reduce((s, r) => s + r.aantal, 0);
      const days = daysSince(trap.pheromoneStartDate);
      const warn = days !== null && days >= settings.pheromoneMaxDays;
      rows.push({ label: `${dep}-${num}`, total, warn });
      html += `<div class="status-line"><span>Vangbak ${num} (afd. ${dep})</span><span class="val">${total} in periode ${warn ? '· <span class="badge warn">⚠️ feromoon</span>' : ''}</span></div>`;
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
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h || 1}" style="fill:${h ? color : 'var(--border)'}"><title>Vangbak ${r.label}: ${r.total}${r.warn ? ' (feromoon aan vervanging toe)' : ''}</title></rect>`;
    bars += `<text x="${x + barW / 2}" y="${180 - 8}" font-size="9" text-anchor="middle" fill="currentColor">${r.label}</text>`;
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
  renderDuponcheliaAnalyse(deps, cutoff);
}

/* ---------- Export / share ---------- */

function buildCsv(deps, cutoff) {
  const lines = ['Type;Afdeling;Nummer;Datum;KantOfFeromoon;Trips;Luis;Wolluis;WitteVlieg;AantalDuponchelia;Notitie'];
  deps.forEach(dep => {
    const vakken = data.departments[dep].vakken;
    Object.keys(vakken).forEach(num => {
      vakken[num].readings.filter(r => !cutoff || r.date >= cutoff).forEach(r => {
        lines.push(['Vak', dep, num, r.date, r.side, r.trips, r.luis, r.wolluis, r.witteVlieg, '', r.notitie].map(escapeCsv).join(';'));
      });
    });
    const dup = data.departments[dep].duponchelia;
    Object.keys(dup).forEach(num => {
      dup[num].readings.filter(r => !cutoff || r.date >= cutoff).forEach(r => {
        lines.push(['Duponchelia', dep, num, r.date, '', '', '', '', '', r.aantal, ''].map(escapeCsv).join(';'));
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
  const afdLabel = deps.length === DEPARTMENTS.length ? 'alle afdelingen' : 'afdeling ' + deps.join(', ');

  let text = `Plaagscouting analyse — ${afdLabel} (${periodeLabel})\n`;
  text += `Datum export: ${fmtDate(todayStr())}\n\n`;
  text += `Totalen:\n`;
  INSECTS.forEach(i => { text += `  ${i.label}: ${totals[i.key]}\n`; });

  const top5 = [...rows].sort((a, b) => b.total - a.total).filter(r => r.total > 0).slice(0, 5);
  if (top5.length) {
    text += `\nTop vakken (hoogste aantallen):\n`;
    top5.forEach(r => { text += `  Afd. ${r.dep}, Vak ${r.num}: ${r.total} (T${r.sums.trips} L${r.sums.luis} W${r.sums.wolluis} Wv${r.sums.witteVlieg})\n`; });
  }

  const attentionItems = [];
  deps.forEach(dep => {
    const vakken = data.departments[dep].vakken;
    Object.keys(vakken).forEach(num => {
      const days = daysSince(vakken[num].card.sideStartDate);
      if (days >= settings.cardMaxDays) attentionItems.push(`Afd. ${dep}, Vak ${num}: kaart ${days} dagen oud (kant ${vakken[num].card.side})`);
    });
    const dup = data.departments[dep].duponchelia;
    Object.keys(dup).forEach(num => {
      const days = daysSince(dup[num].pheromoneStartDate);
      if (days >= settings.pheromoneMaxDays) attentionItems.push(`Afd. ${dep}, Duponchelia vangbak ${num}: feromoon ${days} dagen oud`);
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

/* ---------- Settings modal ---------- */

function initSettingsModal() {
  const modal = document.getElementById('settingsModal');
  document.getElementById('copyrightYear').textContent = new Date().getFullYear();
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('defaultEmails').value = settings.defaultEmails;
    document.getElementById('cardMaxDays').value = settings.cardMaxDays;
    document.getElementById('pheromoneMaxDays').value = settings.pheromoneMaxDays;
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
        settings = { ...defaultSettings(), ...(parsed.settings || {}) };
        saveData();
        saveSettings();
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
    renderScoutenTab();
    renderAnalyse();
    toast('Alle data gewist');
    document.getElementById('settingsModal').classList.add('hidden');
  });
}

/* ---------- Service worker ---------- */

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registratie mislukt', err));
    });
  }
}

/* ---------- Init ---------- */

function init() {
  renderBugIconPlaceholders();
  initTabs();
  initSelectors();
  initDupSelector();
  initCardActions();
  initTellingForm();
  initAnalyseSelectors();
  initShareButtons();
  initSettingsModal();
  initServiceWorker();
  renderScoutenTab();
}

document.addEventListener('DOMContentLoaded', init);
