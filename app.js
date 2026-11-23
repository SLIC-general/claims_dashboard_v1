/* Motor Claims Intelligence
   Hierarchy: Zone (Senior Engineer) -> Region (Regional Engineer) -> Branch -> Technical Officer */
let D, ORG, CATS, ZONES, B, ENG, TOS, REG;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const f = n => Number(n).toLocaleString('en-US');
const money = n => 'Rs. ' + (n / 1e6).toFixed(1) + 'M';
const pct = n => Number(n).toFixed(2) + '%';
const sum = (a, k) => a.reduce((s, x) => s + (+x[k] || 0), 0);
const ratio = (n, d) => d > 0 ? 100 * n / d : null;
const percentage = n => n === null || !Number.isFinite(n) ? '—' : pct(n);
const settings = { positive: 75, attention: 65, minimumRankingVolume: 30 };
const tone = n => n === null ? 'neutral' : n >= settings.positive ? 'positive' : n >= settings.attention ? 'attention' : 'negative';
const progress = n => `<div class="meter"><i style="width:${Math.max(0, Math.min(100, n || 0))}%"></i></div>`;
const empty = m => `<div class="empty">${m || 'No data available for this selection.'}</div>`;

let current = null, mode = 'monthly', level = 0, path = [], focus = 'bee';
const expanded = new Set();

/* ---------- Categories ---------- */
const info = [
  ['bee', 'Bee Express', '#F5A623', 'Entitled claims & successful offers'],
  ['video', 'Video Inspection', '#7956E8', 'VI team Bee Express offers'],
  ['sa', 'SA Pending', '#3478F6', 'Outstanding SA jobs (latest snapshot)'],
  ['ratio', 'Claim Ratio', '#00A8B5', 'Island claim ratio vs target'],
  ['cil', 'Cash in Lieu', '#159D70', 'Claims, offers & savings'],
  ['parts', 'Spare Parts', '#F47745', 'Received and processed parts'],
  ['consistency', 'Pending Consistency', '#5365DB', 'Pending reconciliations'],
  ['errors', 'TO Errors', '#E4478A', 'Quality exceptions'],
  ['offers', 'Special Offers', '#14A88A', 'Offer acceptance'],
  ['documents', 'Document Tracking', '#388FC5', 'Document completeness'],
];
const catInfo = k => info.find(i => i[0] === k);
const iconPaths = {
  bee: '<path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z"/>',
  video: '<rect x="3" y="5" width="12" height="14" rx="3"/><path d="m15 9 6-3v12l-6-3M7 9h4m-4 4h2"/>',
  sa: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ratio: '<path d="M4 4v16h16M8 15l4-5 4 2 4-7"/>',
  cil: '<rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M5 9v6m14-6v6"/>',
  parts: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9"/>',
  consistency: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6m-6 4h6m-6 4h3"/>',
  errors: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
  offers: '<path d="M3 4h8l10 10-7 7L3 10V4Z"/><circle cx="7.5" cy="8" r="1"/>',
  documents: '<path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h7m-7 4h4"/>',
  alert: '<path d="M10.3 4.6 2.8 17.5a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v5m0 2.5v1"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[k]}</svg>`;
const colLabels = { bee: ['Entitled', 'Successful', 'Unsuccessful'], video: ['Claims', 'Offers', 'No offer'], sa: ['Assigned', 'Completed', 'Pending'], ratio: ['Volume', 'Processed', 'Pending'], cil: ['Claims', 'Settled', 'Pending'], parts: ['Received', 'Processed', 'Outstanding'], consistency: ['Cases', 'Reconciled', 'Pending'], errors: ['Volume', 'Processed', 'Pending'], offers: ['Offers', 'Successful', 'Pending'], documents: ['Required', 'Complete', 'Outstanding'] };
const unsupported = k => k === 'ratio' || k === 'errors';
const countBased = k => k === 'sa' || k === 'consistency' || k === 'cil';
// How branches are ranked: completion rate by default, SA by pending jobs, Cash in Lieu by saving.
const rankCfg = k => k === 'sa' ? { score: r => r.pending, better: 'low', top: 'Fewest pending', low: 'Most pending', fmt: r => f(r.pending) + ' pending' }
  : k === 'cil' ? { score: r => r.saving, better: 'high', top: 'Highest saving', low: 'Lowest saving', fmt: r => money(r.saving || 0) }
  : { score: r => r.rate, better: 'high', top: 'Top performers', low: 'Needs attention', fmt: r => pct(r.rate), minVol: true };
function rankList(key, rows) {
  const c = rankCfg(key);
  return rows.filter(r => c.score(r) != null && (!c.minVol || r.total >= (mode === 'daily' ? 1 : settings.minimumRankingVolume))).sort((a, b) => c.better === 'low' ? c.score(a) - c.score(b) : c.score(b) - c.score(a));
}
// Snapshot date of the SA figures in the selected period ("May 27, 2026").
function saAsOf() { const a = CATS.sa?.asOf || {}; return Object.keys(a).filter(p => inPeriod(p)).sort().map(p => a[p]).pop() || ''; }
// Island-level claim ratio for the selected period (the source has no branch split).
function ratioIsland() {
  const m = CATS.ratio?.islandMonthly; if (!m || getZone() !== 'all' || pick) return null;
  const rows = m.filter(x => inPeriod(x.period)); if (!rows.length) return null;
  const full = rows.every(x => x.premium && x.claims), prem = sum(rows, 'premium'), cl = sum(rows, 'claims');
  return { ratio: full ? 100 * cl / prem : sum(rows, 'ratio') / rows.length, premium: full ? prem : null, claims: full ? cl : null, months: rows.length, target: CATS.ratio.target || 75 };
}
const zoneColors = ['#0fa3ad', '#f2a516', '#ee4a5e', '#6c5ce7'];
const zoneColor = z => zoneColors[ZONES.indexOf(z) % zoneColors.length];

/* ---------- Scope & period ---------- */
const getZone = () => $('zoneFilter').value;
/* Scope = zone + optional pick of a branch, engineer or technical officer (from the search box). */
let pick = null; // { type: 'branch'|'engineer'|'to', id }
const toById = id => TOS.find(t => t.id === id);
const getBranch = () => pick ? 'picked' : 'all';
const pickMatches = r => !pick || (pick.type === 'branch' ? r.branchId === pick.id : pick.type === 'engineer' ? !!engById(pick.id)?.branchIds.includes(r.branchId) : r.branchId === toById(pick.id)?.branchId);
const regionById = id => REG.find(r => r.id === id);
const userById = id => (D.users?.users || []).find(u => u.id === id);
const regionEngineers = r => (r?.engineerIds || []).map(id => userById(id)?.name).filter(Boolean).join(' / ');
const zoneByName = n => ORG.zones.find(z => z.name === n);
const zoneSE = n => userById(zoneByName(n)?.seniorEngineerId)?.name || '';
const pickLabel = () => !pick ? '' : pick.type === 'branch' ? branchById(pick.id)?.name : pick.type === 'engineer' ? engById(pick.id)?.name : toById(pick.id)?.name;
const branchById = id => B.find(b => b.id === id);
const engById = id => ENG.find(e => e.id === id);
const periodText = () => $('period').value;
const periodLabel = () => $('period').selectedOptions[0]?.textContent || '';
const scopeLabel = () => pick ? pickLabel() : getZone() === 'all' ? 'All Island' : getZone();
// Daily view: the feed is monthly, so a month's records are spread over its days with stable,
// weekday-weighted shares (Sundays and Saturdays get less). Snapshot categories (SA) keep the snapshot.
const inPeriod = (p, sel = periodText(), view = mode) => view === 'yearly' ? !!p?.startsWith(sel + '-') : view === 'daily' ? p === sel || p === sel.slice(0, 7) : p === sel;
const seeded = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const monthDays = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
function dayShare(seed, ym, day) {
  const w = Array.from({ length: monthDays(ym) }, (_, i) => { const dow = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, i + 1).getDay(); return (dow === 0 ? 0.15 : dow === 6 ? 0.5 : 1) * (0.6 + 0.8 * seeded(seed + '|' + ym + '|' + (i + 1))); });
  return w[day - 1] / w.reduce((a, b) => a + b, 0);
}
function toDaily(recs, sel, ds) {
  const ym = sel.slice(0, 7), day = +sel.slice(8, 10);
  if (ds?.pendingOnly) return recs;
  return recs.flatMap(r => {
    if (r.period === sel) return [r];
    if (r.id) return Math.floor(seeded(r.id) * monthDays(ym)) + 1 === day ? [{ ...r, period: sel }] : []; // alerts: one day each
    const s = dayShare(r.branchId || '', ym, day), total = Math.round((r.total || 0) * s), completed = r.total ? Math.max(0, Math.min(total, Math.floor(total * Math.min(1, (r.completed / r.total) * (0.96 + 0.08 * seeded(sel + (r.branchId || '')))) + seeded((r.branchId || '') + sel + 'c')))) : 0;
    const d = { ...r, period: sel, daily: true, total, completed, pending: r.pending === (r.total || 0) - (r.completed || 0) ? total - completed : Math.round((r.pending || 0) * s), amount: Math.round((r.amount || 0) * s), rate: total ? +(completed / total * 100).toFixed(2) : null };
    if (r.saving) d.saving = Math.round(r.saving * s * 100) / 100;
    return d.total || d.pending || d.amount ? [d] : [];
  });
}
function periodRecords(ds, sel = periodText(), view = mode) {
  const recs = (ds?.records || []).filter(r => inPeriod(r.period, sel, view));
  return view === 'daily' ? toDaily(recs, sel, ds) : recs;
}
const inScope = r => (getZone() === 'all' || r.zone === getZone()) && pickMatches(r);
const scopedBranches = () => B.filter(b => inScope({ ...b, branchId: b.id }));
const scopedTOs = () => pick?.type === 'to' ? TOS.filter(t => t.id === pick.id) : TOS.filter(inScope);
function recordsFor(key, sel = periodText(), view = mode) {
  const ds = key === 'alerts' ? D.alerts : CATS[key];
  let recs = periodRecords(ds, sel, view);
  // Snapshot data (SA pending) is a stock, not a flow: a year shows its latest snapshot, not the sum.
  if (ds?.pendingOnly && view === 'yearly' && recs.length) { const last = recs.reduce((m, r) => r.period > m ? r.period : m, ''); recs = recs.filter(r => r.period === last); }
  return recs.filter(inScope);
}
const totals = rows => { const t = sum(rows, 'total'), d = sum(rows, 'completed'); return { total: t, done: d, pending: sum(rows, 'pending'), amount: sum(rows, 'amount'), saving: sum(rows, 'saving'), rate: ratio(d, t) }; };

/* ---------- Headline per category ---------- */
function videoSourceActive() {
  const v = CATS.video;
  return !!(v.sourcePeriod && v.sourceAllIsland && inPeriod(v.sourcePeriod) && getZone() === 'all' && getBranch() === 'all');
}
function headline(key) {
  const h = { value: '—', secondary: 'Not reported', rate: null, absent: true };
  if (key === 'video' && videoSourceActive()) {
    const s = CATS.video.sourceAllIsland, r = ratio(s.inspections, s.accidents);
    return { value: percentage(r), secondary: `${f(s.inspections)} / ${f(s.accidents)} inspections`, rate: r, absent: false };
  }
  if (key === 'ratio') { const r = ratioIsland(); if (r) return { value: percentage(r.ratio), secondary: `All Island · target ${r.target}%`, rate: null, absent: false }; }
  if (unsupported(key)) return h;
  const rows = recordsFor(key);
  if (!rows.length) return { ...h, secondary: 'No records this period' };
  const t = totals(rows), L = colLabels[key];
  if (key === 'sa' && CATS.sa.pendingOnly) return { value: f(t.pending), secondary: `pending jobs · as at ${saAsOf()}`, rate: null, absent: false };
  if (key === 'cil') return { value: money(t.amount), secondary: `${f(t.total)} claims · saving ${money(t.saving)}`, rate: t.rate, absent: false };
  if (key === 'sa' || key === 'consistency') return { value: f(t.pending), secondary: `${f(t.done)} completed of ${f(t.total)}`, rate: t.rate, absent: false };
  return { value: percentage(t.rate), secondary: `${f(t.done)} / ${f(t.total)} ${L[1].toLowerCase()}`, rate: t.rate, absent: false };
}
const tileFoot = { sa: 'open assignments', consistency: 'pending cases', cil: 'settlement value' };

/* ---------- Init & filters ---------- */
function init() {
  $('zoneFilter').innerHTML = '<option value="all">All zones</option>' + ZONES.map(z => `<option value="${esc(z)}">${esc(z)}</option>`).join('');
  $('sideCategories').innerHTML = info.map(([k, t, c]) => `<button class="sideitem" id="side-${k}" onclick="openCategory('${k}')"><span class="dot" style="--dot:${c}"></span><span class="sidename">${t}</span><span class="sideval" id="sideval-${k}"></span></button>`).join('');
  renderUser();
  applyHomeScope();
  zoneChanged(false);
  setMode('monthly');
  home();
}
function zoneChanged(render = true) {
  // Drop a pick that falls outside the new zone.
  if (pick && getZone() !== 'all') {
    const z = getZone(), ok = pick.type === 'branch' ? branchById(pick.id)?.zone === z : pick.type === 'to' ? toById(pick.id)?.zone === z : !!engById(pick.id)?.branchIds.some(id => branchById(id)?.zone === z);
    if (!ok) pick = null;
  }
  level = 0; path = []; expanded.clear();
  renderPick();
  if (render) refresh();
}

/* ---------- Search picker (branch / engineer / TO) ---------- */
let results = [], activeIdx = -1;
function searchScope(q) {
  q = q.trim().toLowerCase();
  const z = getZone(), inZone = zone => z === 'all' || zone === z;
  const hit = (...s) => !q || s.some(x => String(x || '').toLowerCase().includes(q));
  const br = B.filter(b => inZone(b.zone) && hit(b.name, b.region)).slice(0, q ? 6 : 4)
    .map(b => ({ type: 'branch', id: b.id, label: b.name, meta: `${b.zone} · ${TOS.filter(t => t.branchId === b.id).length} TOs` }));
  const en = ENG.filter(e => B.some(b => b.engineerId === e.id && inZone(b.zone)) && hit(e.name, ...(e.regions || []))).slice(0, q ? 5 : 3)
    .map(e => ({ type: 'engineer', id: e.id, label: e.name, meta: `${(e.regions || []).join(', ')} · ${e.branchIds?.length || 0} branches` }));
  const to = TOS.filter(t => inZone(t.zone) && Auth.canOpenBranch(t.branchId) && hit(t.name, t.toCode, t.epf, t.mobile)).slice(0, q ? 8 : 3)
    .map(t => ({ type: 'to', id: t.id, label: t.name, meta: `${t.toCode ? 'TO ' + t.toCode + ' · ' : ''}EPF ${t.epf} · ${branchById(t.branchId)?.name || ''}` }));
  return [...br, ...en, ...to];
}
const groupName = { branch: 'Branches', engineer: 'Regional engineers', to: 'Technical officers' };
function openResults() {
  results = searchScope($('scopeSearch').value); activeIdx = results.length ? 0 : -1;
  let last = '';
  $('scopeResults').innerHTML = results.length ? results.map((r, i) => {
    const h = r.type !== last ? `<div class="sr-group">${groupName[r.type]}</div>` : ''; last = r.type;
    return `${h}<button type="button" class="sr-item ${i === activeIdx ? 'active' : ''}" data-i="${i}" onmousedown="event.preventDefault();choosePick(${i})"><span class="sr-type ${r.type}">${r.type === 'to' ? 'TO' : r.type === 'engineer' ? 'ENG' : 'BR'}</span><span class="sr-text"><b>${esc(r.label)}</b><small>${esc(r.meta)}</small></span></button>`;
  }).join('') : '<div class="sr-empty">No branch, engineer or TO matches.</div>';
  $('scopeResults').hidden = false;
  $('scopeSearch').setAttribute('aria-expanded', 'true');
}
function closeResults() { $('scopeResults').hidden = true; $('scopeSearch').setAttribute('aria-expanded', 'false'); }
function searchKey(e) {
  if ($('scopeResults').hidden && e.key !== 'Escape') openResults();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    activeIdx = (activeIdx + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
    $('scopeResults').querySelectorAll('.sr-item').forEach((b, i) => b.classList.toggle('active', i === activeIdx));
    $('scopeResults').querySelector('.sr-item.active')?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); choosePick(activeIdx); }
  else if (e.key === 'Escape') { closeResults(); e.target.blur(); }
}
function choosePick(i) {
  const r = results[i]; if (!r) return;
  pick = { type: r.type, id: r.id };
  $('scopeSearch').value = ''; closeResults(); renderPick();
  level = 0; path = []; expanded.clear();
  if (r.type === 'to' && current !== 'alerts') {
    // Jump straight to the officer's profile within the focused category.
    const t = toById(r.id);
    if (current === null) current = focus;
    path = [t.zone, t.regionId, t.branchId, t.id]; level = 4;
  }
  refresh();
}
const branchLocked = () => Auth.role?.scope === 'branch' && !!Auth.user?.branchId;
function clearPick() {
  if (branchLocked()) return; pick = null; renderPick(); level = 0; path = []; refresh(); }
function renderPick() {
  const chip = $('scopeChip');
  if (!pick) { chip.hidden = true; $('scopeSearch').placeholder = 'Search branch, engineer or TO…'; return; }
  chip.hidden = false;
  chip.innerHTML = `<span class="sr-type ${pick.type}">${pick.type === 'to' ? 'TO' : pick.type === 'engineer' ? 'ENG' : 'BR'}</span><b>${esc(pickLabel())}</b><button type="button" onclick="clearPick()" aria-label="Remove ${esc(pickLabel())} filter">×</button>`;
  $('scopeSearch').placeholder = 'Change…';
}
function setMode(m) {
  const prev = periodText();
  mode = m;
  [['dayBtn', 'daily'], ['monthBtn', 'monthly'], ['yearBtn', 'yearly']].forEach(([id, v]) => { $(id).classList.toggle('active', m === v); $(id).setAttribute('aria-pressed', String(m === v)); });
  const avail = [...new Set([...Object.values(CATS).flatMap(c => c.records.map(r => r.period)), CATS.video.sourcePeriod].filter(Boolean))].sort().reverse();
  const latest = avail[0] || '2026-06', y = +latest.slice(0, 4);
  const years = [...new Set([...avail.map(p => p.slice(0, 4)), String(y - 1), String(y - 2)])].sort().reverse();
  const months = years.flatMap(yr => Array.from({ length: 12 }, (_, i) => `${yr}-${String(12 - i).padStart(2, '0')}`));
  // Days: every day of the months that have data, newest first.
  const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const days = avail.flatMap(ym => Array.from({ length: monthDays(ym) }, (_, i) => `${ym}-${String(monthDays(ym) - i).padStart(2, '0')}`));
  const opts = m === 'monthly' ? months : m === 'daily' ? days : years;
  const fmt = p => m === 'monthly' ? new Date(p + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : m === 'daily' ? new Date(p + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : p;
  $('period').innerHTML = opts.map(p => `<option value="${p}">${fmt(p)}</option>`).join('');
  const prevMonth = prev?.length >= 7 ? prev.slice(0, 7) : avail.find(p => prev && p.startsWith(prev)) || latest;
  const next = m === 'yearly' ? (prev || latest).slice(0, 4)
    : m === 'daily' ? (prev?.length === 10 ? prev : days.find(d => d.startsWith(prevMonth) && d <= today) || days.find(d => d.startsWith(prevMonth)) || days.find(d => d <= today) || days[0])
    : prevMonth;
  $('period').value = opts.includes(next) ? next : opts[0];
  refresh();
}
/* Land on the signed-in user's own scope (zone / region / branch). */
function applyHomeScope() {
  const h = Auth.homeScope();
  $('zoneFilter').value = h.zone; pick = h.pick;
}
function resetFilters() {
  applyHomeScope();
  $('scopeSearch').value = ''; closeResults();
  zoneChanged(false);
  setMode('monthly');
  $('period').value = '2026-06';
  refresh();
}
function refresh() {
  if (!D || !$('period').value) return;
  document.querySelectorAll('.filter select').forEach(s => s.classList.toggle('filtered', s.id !== 'period' && s.value !== 'all'));
  if (path.length && getZone() !== 'all' && path[0] !== getZone()) { level = 0; path = []; }
  $('resetBtn').classList.toggle('on', !!pick || getZone() !== 'all' || mode !== 'monthly' || periodText() !== '2026-06');
  $('breadcrumb').textContent = 'MOTOR CLAIMS / ' + scopeLabel().toUpperCase();
  info.forEach(([k]) => { const v = headline(k).value; $('sideval-' + k).textContent = v === '—' ? '' : v; });
  current === null ? renderHome() : renderDetail();
}
function toggleSidebar() {
  const open = document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('.sidebar-toggle').setAttribute('aria-expanded', String(open));
}
function toggleFilters(force) {
  const open = typeof force === 'boolean' ? force : !$('filterToolbar').classList.contains('open');
  $('filterToolbar').classList.toggle('open', open);
  document.querySelector('.filter-launch').setAttribute('aria-expanded', String(open));
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleFilters(false); });

/* ---------- Navigation ---------- */
function setNav(id) {
  document.querySelectorAll('.sideitem').forEach(e => e.classList.remove('active'));
  $(id)?.classList.add('active');
}
function home() {
  current = null; level = 0; path = [];
  $('homeScreen').classList.add('active');
  $('detailScreen').classList.remove('active');
  $('pageTitle').textContent = 'Claims Dashboard';
  setNav('navHome');
  refresh();
}
function openCategory(k) {
  document.querySelector('.sidebar').classList.remove('open');
  document.querySelector('.sidebar-toggle')?.setAttribute('aria-expanded', 'false');
  current = k; level = 0; path = [];
  renderDetail();
}
function openAlerts() { current = 'alerts'; level = 0; path = []; renderDetail(); }
// Levels: 0 zones › 1 regions › 2 branches › 3 technical officers › 4 officer profile
function drill(id) {
  if (level === 2 && !Auth.canOpenBranch(id)) { Auth.deny(); return false; }
  path.push(id); level = Math.min(4, level + 1); renderDetail(); return true;
}
function goUp() { if (level > 0) { level--; path.pop(); renderDetail(); } }
function openRegion(key, z, r) { openCategory(key); path = [z, r]; level = 2; renderDetail(); }
function openBranch(key, z, b) {
  if (!Auth.canOpenBranch(b)) { Auth.deny(); return false; }
  openCategory(key); path = [z, branchById(b)?.regionId, b]; level = 3; renderDetail(); return true;
}

/* ---------- Home ---------- */
function alertCounts() {
  const a = recordsFor('alerts');
  return { all: a.length, critical: a.filter(r => r.severity === 'Critical').length, breached: a.filter(r => r.status === 'Breached').length, overdue: a.filter(r => r.ageHours > 48).length, risk: a.filter(r => r.status === 'At risk').length };
}
function renderAlertBanner() {
  const c = alertCounts(), has = c.all > 0;
  const m = (n, label, cls = '') => `<div class="ab-metric ${cls}"><b>${has ? f(n) : '—'}</b><span>${label}</span></div>`;
  $('alertBanner').innerHTML = `<div class="ab-lead"><span class="ab-icon">${icon('alert')}</span><div><strong>Critical Alerts</strong><small>${has ? `${f(c.all)} open exceptions · ${esc(scopeLabel())}` : 'No alerts for this period'}</small></div></div>
    <div class="ab-metrics">${m(c.critical, 'Critical', 'hot')}${m(c.breached, 'SLA breached')}${m(c.overdue, 'Overdue &gt;48h')}${m(c.risk, 'At risk')}</div>
    <button class="ab-action" onclick="openAlerts()">View alerts <span aria-hidden="true">→</span></button>`;
}
function tile([key, title, accent]) {
  const h = headline(key), active = key === focus;
  const foot = !h.absent && h.rate !== null && !countBased(key) ? progress(h.rate) : `<span class="ctile-sub">${h.absent ? h.secondary : tileFoot[key] || ''}</span>`;
  const status = h.absent || countBased(key) || h.rate === null ? '' : `<span class="dotstatus ${tone(h.rate)}" title="${{ positive: 'On track', attention: 'Watch', negative: 'Below target' }[tone(h.rate)]}"></span>`;
  return `<button class="ctile ${active ? 'active' : ''} ${h.absent ? 'absent' : ''}" style="--accent:${accent}" onclick="setFocus('${key}')" aria-pressed="${active}"><span class="ctile-top"><span class="ctile-ico">${icon(key)}</span><span class="ctile-name">${title}</span>${status}</span><span class="ctile-value">${h.value}</span>${foot}</button>`;
}
function setFocus(k) { focus = k; expanded.clear(); renderHome(); }
function toggleZone(z) { expanded.has(z) ? expanded.delete(z) : expanded.add(z); renderFocus(); }
function renderHome() {
  renderAlertBanner();
  $('tiles').innerHTML = info.map(tile).join('');
  renderFocus();
}
// peers = true ignores the branch / engineer / TO pick so rankings always compare against other branches.
function branchRows(key, peers = false) {
  if (unsupported(key)) return [];
  const m = new Map();
  const rows = peers ? periodRecords(CATS[key]).filter(r => (getZone() === 'all' || r.zone === getZone()) && (Auth.showsOthers() || Auth.inMyScope(r.branchId))) : recordsFor(key);
  rows.forEach(r => { if (!m.has(r.branchId)) m.set(r.branchId, []); m.get(r.branchId).push(r); });
  return [...m].map(([id, rows]) => { const b = branchById(id); return { id, name: b?.name || id, zone: b?.zone || rows[0].zone, regionId: b?.regionId, region: b?.region, engineerId: b?.engineerId, ...totals(rows) }; });
}
const reTotal = list => totals(list.map(r => ({ total: r.total, completed: r.done, pending: r.pending })));
function renderFocus() {
  const [key, title, accent] = catInfo(focus), L = colLabels[key];
  $('focusPanel').style.setProperty('--accent', accent);
  $('focusIcon').innerHTML = icon(key);
  $('focusTitle').textContent = title;
  $('focusSub').textContent = `Zone → Region → Branch → Technical Officer · ${periodLabel()}`;
  $('homeNote').textContent = 'Click a zone to list its regions, then a region to see its branches and technical officers. The marker shows the average.';
  renderStanding('myStanding', key);
  const rows = branchRows(key), all = reTotal(rows);
  if (!rows.length) {
    const msg = key === 'ratio' ? 'Claim ratio requires earned premium and incurred claims amounts, which are not yet in the data feed.'
      : key === 'errors' ? 'TO error records are not yet in the data feed.'
      : key === 'video' && videoSourceActive() ? `Video Inspection is reported at All Island level only for ${periodLabel()}: ${headline('video').secondary}.`
      : 'No records for the selected period and scope.';
    $('homeTable').innerHTML = empty(msg);
    $('homeRank').innerHTML = empty('No branches to rank.');
    return;
  }
  const avg = all.rate;
  const rateCell = r => r === null ? '<td class="num">—</td>' : `<td class="num"><span class="pill ${tone(r)}">${r.toFixed(2)}</span></td>`;
  const bar = r => `<td class="bar-col"><div class="vbar"><i class="${tone(r)}" style="width:${Math.max(0, Math.min(100, r || 0))}%"></i>${avg === null ? '' : `<b style="left:${avg}%"></b>`}</div></td>`;
  const cells = (o, eng, tos) => `<td class="num hide-md">${f(eng)}</td><td class="num hide-md">${f(tos)}</td><td class="num">${f(o.total)}</td><td class="num">${f(o.done)}</td><td class="num">${f(o.pending)}</td>${rateCell(o.rate)}${bar(o.rate)}`;
  const zones = ZONES.map(z => { const br = rows.filter(r => r.zone === z); return { z, br, ...reTotal(br) }; }).filter(x => x.br.length).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  const tosIn = list => TOS.filter(t => list.some(b => b.id === t.branchId)).length;
  // A single zone in scope (zone / region / branch users) is shown open, with its branches listed under each region.
  const single = zones.length === 1;
  // The signed-in user's own regions / branches come first and are highlighted.
  const me = Auth.user, myReg = r => !Auth.islandWide() && (me?.regionIds?.includes(r.id) || (r.engineerIds || []).includes(me?.id));
  const myBr = b => !Auth.islandWide() && (me?.branchId ? b.id === me.branchId : me?.role === 'REGIONAL_ENGINEER' ? me.regionIds?.includes(b.regionId) : false);
  const byMineThenRate = mine => (p, q) => (mine(q) - mine(p)) || ((q.rate ?? -1) - (p.rate ?? -1));
  const tags = (names, cls) => names.length ? `<span class="ptags">${names.map(n => `<span class="ptag ${cls}">${esc(n)}</span>`).join('')}</span>` : '';
  const engNames = r => (r?.engineerIds || []).map(id => userById(id)?.name).filter(Boolean);
  const brRow = b => `<tr class="brow ${myBr(b) ? 'mine' : ''}" onclick="openBranch('${key}','${esc(b.zone)}','${b.id}')"><td><span class="bname"><b>${esc(b.name)}</b>${myBr(b) ? '<em class="mine-tag">Your branch</em>' : ''}${tags(TOS.filter(t => t.branchId === b.id).map(t => t.name), 'to')}</span></td>${cells(b, 1, tosIn([b]))}</tr>`;
  const body = zones.map(x => {
    const open = single || expanded.has(x.z) || !!pick;
    const regs = REG.filter(r => x.br.some(b => b.regionId === r.id)).map(r => { const rb = x.br.filter(b => b.regionId === r.id); return { r, rb, ...reTotal(rb) }; }).sort(byMineThenRate(g => myReg(g.r)));
    const sub = open ? regs.map(g => `<tr class="rrow ${myReg(g.r) ? 'mine' : ''}" onclick="openRegion('${key}','${esc(x.z)}','${g.r.id}')"><td><span class="rname"><b>${esc(g.r.name)}</b>${tags(engNames(g.r), 'eng')}</span></td>${cells(g, g.rb.length, tosIn(g.rb))}</tr>${single ? g.rb.slice().sort(byMineThenRate(myBr)).map(brRow).join('') : ''}`).join('') : '';
    return `<tr class="zrow ${open ? 'open' : ''} ${single ? 'fixed' : ''}" ${single ? '' : `onclick="toggleZone('${esc(x.z)}')"`}><td><span class="zcell"><span class="caret">▸</span><i class="zdot" style="background:${zoneColor(x.z)}"></i><b>${esc(x.z)}</b><small>${esc(zoneSE(x.z))} · ${regs.length} region${regs.length === 1 ? '' : 's'}</small></span></td>${cells(x, x.br.length, tosIn(x.br))}</tr>${sub}`;
  }).join('');
  $('homeTable').innerHTML = `<table class="htable"><thead><tr><th>Zone / Region</th><th class="num hide-md">Branches</th><th class="num hide-md">TOs</th><th class="num">${L[0]}</th><th class="num">${L[1]}</th><th class="num">${L[2]}</th><th class="num">Rate %</th><th class="bar-col">vs average</th></tr></thead><tbody>${body}<tr class="filler" aria-hidden="true"><td colspan="8"></td></tr></tbody><tfoot><tr><td>${esc(scopeLabel())} · ${f(new Set(rows.map(r => r.regionId)).size)} regions</td><td class="num hide-md">${f(rows.length)}</td><td class="num hide-md">${f(scopedTOs().length)}</td><td class="num">${f(all.total)}</td><td class="num">${f(all.done)}</td><td class="num">${f(all.pending)}</td><td class="num">${percentage(avg)}</td><td></td></tr></tfoot></table>`;
  renderRankings('homeRank', key);
}
function renderRankings(id, key) {
  const ranked = rankList(key, branchRows(key, true)), rc = rankCfg(key), mx = Math.max(...ranked.map(r => rc.score(r) || 0), 1);
  if (!ranked.length) { $(id).innerHTML = empty('Not enough volume to rank branches.'); return; }
  const top = ranked.slice(0, 5), bottom = ranked.slice(5).slice(-5).reverse();
  const row = (r, low) => `<button class="rank ${low ? 'low' : ''} ${Auth.canOpenBranch(r.id) ? '' : 'locked'} ${Auth.inMyScope(r.id) && !Auth.islandWide() ? 'mine' : ''}" onclick="openBranch('${key}','${esc(r.zone)}','${r.id}')"><span class="num">${ranked.indexOf(r) + 1}</span><span class="rank-info"><span class="rank-line"><b>${esc(r.name)}</b><strong>${rc.fmt(r)}</strong></span><small>${esc(r.region || '')}${rc.minVol ? ` · ${f(r.total)} ${colLabels[key][0].toLowerCase()}` : ''}</small>${progress(rc.minVol ? r.rate : 100 * (rc.score(r) || 0) / mx)}</span></button>`;
  $(id).innerHTML = `<div class="rank-col"><div class="rank-sub">${rc.top}</div>${top.map(r => row(r)).join('')}</div>${bottom.length ? `<div class="rank-col"><div class="rank-sub low">${rc.low}</div>${bottom.map(r => row(r, true)).join('')}</div>` : ''}`;
}

/* ---------- My standing (scoped users): rank of own branch / region / zone island-wide ---------- */
function standing(key) {
  const u = Auth.user;
  if (!u || Auth.islandWide() || unsupported(key) || key === 'alerts' || key === 'sa' || key === 'cil') return null; // SA / CIL have no completion rate to rank on
  const recs = periodRecords(CATS[key]);
  if (!recs.length) return null;
  const group = by => {
    const m = new Map();
    recs.forEach(r => { const k = by(r); if (!k) return; const t = m.get(k) || { total: 0, done: 0 }; t.total += +r.total || 0; t.done += +r.completed || 0; m.set(k, t); });
    return [...m].map(([id, t]) => ({ id, rate: ratio(t.done, t.total), total: t.total })).filter(x => x.rate !== null).sort((a, b) => b.rate - a.rate);
  };
  const kind = Auth.role.scope, all = totals(recs);
  let list, mine, label, noun, inner = null;
  if (kind === 'branch') {
    list = group(r => r.branchId); mine = u.branchId; label = branchById(mine)?.name; noun = 'branches';
    const z = branchById(mine)?.zoneId; inner = { list: list.filter(x => branchById(x.id)?.zoneId === z), label: ORG.zones.find(x => x.id === z)?.name };
  } else if (kind === 'region') {
    list = group(r => r.regionId); mine = u.regionIds?.[0]; label = (u.regionIds || []).map(id => regionById(id)?.name).join(' & '); noun = 'regions';
    const z = regionById(mine)?.zoneId; inner = { list: list.filter(x => regionById(x.id)?.zoneId === z), label: ORG.zones.find(x => x.id === z)?.name };
  } else {
    list = group(r => r.zoneId); mine = u.zoneId; label = ORG.zones.find(x => x.id === mine)?.name + ' Zone'; noun = 'zones';
  }
  const i = list.findIndex(x => x.id === mine);
  if (i < 0) return null;
  const j = inner ? inner.list.findIndex(x => x.id === mine) : -1;
  return { label, noun, kind, rank: i + 1, of: list.length, rate: list[i].rate, islandRate: all.rate, inner: j >= 0 ? { rank: j + 1, of: inner.list.length, label: inner.label } : null };
}
function renderStanding(id, key) {
  const el = $(id); if (!el) return;
  const s = standing(key);
  el.hidden = !s;
  if (!s) { el.innerHTML = ''; return; }
  const d = s.rate - s.islandRate, noun = { branch: 'Your branch', region: 'Your region', zone: 'Your zone' }[s.kind];
  el.innerHTML = `<div class="st-head"><small>${noun} · ${esc(catInfo(key)[1])}</small><b>${esc(s.label)}</b></div>
    <div class="st-cell"><b>#${s.rank}</b><small>of ${s.of} ${s.noun}</small></div>
    ${s.inner ? `<div class="st-cell"><b>#${s.inner.rank}</b><small>of ${s.inner.of} in ${esc(s.inner.label)}</small></div>` : ''}
    <div class="st-cell"><b class="${tone(s.rate)}">${percentage(s.rate)}</b><small class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)} pp vs island</small></div>`;
}
function renderUser() {
  const u = Auth.user, el = $('sideUser'); if (!el || !u) return;
  el.innerHTML = `<span class="su-avatar">${esc(Auth.initials())}</span><span class="su-text"><b>${esc(u.name)}</b><small>${esc(u.title || Auth.roleLabel())}</small></span><button class="su-out" onclick="Auth.logout()" title="Sign out" aria-label="Sign out">⎋</button>`;
  // Screen permissions from roles.json
  const can = Auth.can;
  ['side-alerts'].forEach(i => { if ($(i)) $(i).hidden = !can('alerts'); });
  if (!can('alerts')) $('alertBanner').hidden = true;
  // Branch-scoped users (TOs) are locked to their own branch: no search, no zone switch.
  const locked = branchLocked();
  document.querySelector('.scope-search').hidden = locked || !can('search');
  $('zoneFilter').closest('.filter').hidden = locked;
}

/* ---------- Detail ---------- */
function showDetail() {
  $('homeScreen').classList.remove('active');
  $('detailScreen').classList.add('active');
  setNav('side-' + current);
  const title = current === 'alerts' ? 'Critical Alerts' : catInfo(current)[1];
  $('pageTitle').textContent = title;
  $('breadcrumb').textContent = 'MOTOR CLAIMS / ' + title.toUpperCase();
  $('detailName').textContent = title;
  $('detailDescription').textContent = current === 'alerts' ? 'Exceptions, SLA risks and escalation' : catInfo(current)[3];
  $('sourceTag').textContent = `${periodLabel()} · ${scopeLabel()}`;
}
function metrics() {
  if (current === 'alerts') {
    const c = alertCounts(), v = n => c.all ? f(n) : '—';
    return [['Open alerts', v(c.all)], ['Critical', v(c.critical)], ['SLA breached', v(c.breached)], ['At risk', v(c.risk)]];
  }
  if (current === 'video' && videoSourceActive()) {
    const v = CATS.video.sourceAllIsland;
    return [['Inspection coverage', headline('video').value], ['Completed inspections', f(v.inspections)], ['Reported accidents', f(v.accidents)], ['Target achievement', pct(v.targetAchievement)]];
  }
  if (current === 'ratio') {
    const r = ratioIsland();
    if (!r) return [['Overall claim ratio', '—'], ['Claims paid', '—'], ['Net premium', '—'], ['vs target', '—']];
    const d = r.ratio - r.target;
    return [['Overall claim ratio', percentage(r.ratio)], ['Claims paid', r.claims ? money(r.claims) : '—'], ['Net premium', r.premium ? money(r.premium) : '—'], [`vs ${r.target}% target`, `${d > 0 ? '+' : ''}${d.toFixed(1)} pp`]];
  }
  if (current === 'sa' && CATS.sa.pendingOnly) {
    const rows = branchRows('sa'), top = [...rows].sort((a, b) => b.pending - a.pending)[0];
    return [['Pending SA jobs', rows.length ? f(sum(rows, 'pending')) : '—'], ['Branches', rows.length ? f(rows.length) : '—'], ['Most pending', top ? `${top.name} ${f(top.pending)}` : '—'], ['As at', saAsOf() || '—']];
  }
  if (current === 'cil') {
    const t = totals(recordsFor('cil')), none = !t.total;
    return [['Offer amount', none ? '—' : money(t.amount)], ['Claims', none ? '—' : f(t.total)], ['Saving', none ? '—' : money(t.saving)], ['Saving rate', none || !t.amount ? '—' : pct(100 * t.saving / t.amount)]];
  }
  if (current === 'errors') return [['Total errors', '—'], ['Error rate', '—'], ['Affected officers', '—'], ['Overdue corrections', '—']];
  const h = headline(current), t = totals(recordsFor(current)), s = n => h.absent ? '—' : f(n), L = colLabels[current];
  const head = { sa: 'Pending assignments', consistency: 'Pending cases', cil: 'Settlement amount', bee: 'Offer rate', video: 'Offer rate' }[current] || 'Completion rate';
  return [[head, h.value], [L[0], s(t.total)], [L[1], s(t.done)], [L[2], s(t.pending)]];
}
function renderDetail() {
  if (!current) return;
  showDetail();
  $('detailKpis').innerHTML = metrics().map(([l, v]) => `<div class="kpi"><small>${l}</small><strong>${v}</strong><em>${v === '—' ? 'Not reported' : periodLabel()}</em></div>`).join('');
  $('levelBack').style.display = level ? 'inline-flex' : 'none';
  renderDrill();
  renderInsights();
}
function nodeItems() {
  const bs = scopedBranches();
  const tosIn = list => TOS.filter(t => list.some(b => b.id === t.branchId)).length;
  if (level === 0) return ZONES.filter(z => bs.some(b => b.zone === z)).map(z => { const zb = bs.filter(b => b.zone === z); return { id: z, label: z, sub: `${zoneSE(z)} · ${new Set(zb.map(b => b.regionId)).size} regions · ${zb.length} branches · ${tosIn(zb)} TOs` }; });
  if (level === 1) return REG.filter(r => bs.some(b => b.zone === path[0] && b.regionId === r.id)).map(r => { const rb = bs.filter(b => b.regionId === r.id); return { id: r.id, label: r.name, sub: `${regionEngineers(r)} · ${rb.length} branches · ${tosIn(rb)} TOs` }; });
  if (level === 2) return bs.filter(b => b.regionId === path[1]).sort((a, b) => a.name.localeCompare(b.name)).map(b => ({ id: b.id, label: b.name, locked: !Auth.canOpenBranch(b.id), sub: `${b.id} · ${TOS.filter(t => t.branchId === b.id).length} technical officers` }));
  if (level === 3) return TOS.filter(t => t.branchId === path[2]).map(t => ({ id: t.id, label: t.name, sub: `${t.toCode ? 'TO ' + t.toCode + ' · ' : ''}EPF ${t.epf}${t.mobile ? ' · ' + t.mobile : ''}` }));
  return [];
}
function nodeStat(n) {
  const a = recordsFor(current).filter(r => level === 0 ? r.zone === n.id : level === 1 ? r.regionId === n.id : level === 2 ? r.branchId === n.id : false);
  if (current === 'alerts') return { value: a.length ? f(a.length) : '—', secondary: 'open alerts', percent: null };
  if (unsupported(current) || !a.length) return { value: '—', secondary: level === 3 ? 'Officer figures not in feed' : 'Not reported', percent: null };
  const t = totals(a);
  const value = current === 'sa' || current === 'consistency' ? f(t.pending) : current === 'cil' ? money(t.amount) : percentage(t.rate);
  return { value, secondary: `${f(t.done)} / ${f(t.total)} ${colLabels[current][1].toLowerCase()}`, percent: t.rate };
}
function renderDrill() {
  const titles = ['Zone performance', 'Region performance', 'Branch performance', 'Technical officers', 'Technical officer'];
  const names = path.map((p, i) => i === 1 ? regionById(p)?.name || p : i === 2 ? branchById(p)?.name || p : i === 3 ? TOS.find(t => t.id === p)?.name || p : p);
  $('drillTitle').textContent = titles[level];
  $('drillSubtitle').textContent = level === 0 ? 'Select a zone to see its regions' : names.join('  ›  ');
  if (level === 4) return renderOfficer();
  const nodes = nodeItems();
  if (level === 0) {
    $('drillBody').innerHTML = '<div class="zonecards">' + nodes.map(n => { const s = nodeStat(n); return `<button class="zonecard" onclick="drill('${esc(n.id)}')"><div class="row"><h4><i class="zdot" style="background:${zoneColor(n.id)}"></i> ${esc(n.label)}</h4><span>→</span></div><div class="big">${s.value}</div><small>${s.secondary}</small>${progress(s.percent)}<small>${n.sub}</small></button>`; }).join('') + '</div>';
    return;
  }
  $('drillBody').innerHTML = (level === 2 ? '<input class="search-branches" type="search" aria-label="Search branches" placeholder="Search branches…" oninput="filterList(this.value)">' : '') +
    (nodes.length ? nodes.map(n => { const s = nodeStat(n); return `<button class="listrow ${n.locked ? 'locked' : ''}" onclick="drill('${esc(n.id)}')"><span><b>${esc(n.label)}${n.locked ? ' <i class="lock" title="Summary only">🔒</i>' : ''}</b><small>${esc(n.sub)}</small></span><span style="text-align:right"><strong>${s.value} ${n.locked ? '' : '→'}</strong><small>${s.secondary}</small></span></button>`; }).join('') : empty('No items at this level for the selected filters.'));
  if (level === 3) renderBranchRegister();
}
function filterList(q) { $('drillBody').querySelectorAll('button.listrow').forEach(r => { r.hidden = !r.textContent.toLowerCase().includes(q.toLowerCase()); }); }
function renderBranchRegister() {
  if (current === 'alerts') return;
  const rows = recordsFor(current).filter(r => r.branchId === path[2]);
  if (!rows.length) return;
  const L = colLabels[current];
  $('drillBody').insertAdjacentHTML('beforeend', `<div class="branch-register"><h4>Branch monthly register</h4><table><thead><tr><th>Month</th><th>${L[0]}</th><th>${L[1]}</th><th>${L[2]}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.period)}</td><td>${f(r.total)}</td><td>${f(r.completed)}</td><td>${f(r.pending)}</td></tr>`).join('')}</tbody></table></div>`);
}
function renderOfficer() {
  const o = TOS.find(t => t.id === path[3]);
  const br = branchById(o?.branchId);
  const facts = [['TO code', o?.toCode || '—'], ['EPF no.', o?.epf || '—'], ['Mobile', o?.mobile ? `<a href="tel:${esc(o.mobile)}">${esc(o.mobile)}</a>` : '—'], ['Branch', esc(br ? `${br.name} (${br.id})` : '—')], ['Region', esc(br?.region || '—')], ['Zone', esc(o?.zone || '—')], ['Regional engineer', esc(regionEngineers(regionById(br?.regionId)) || '—')], ['Senior engineer', esc(zoneSE(o?.zone) || '—')]];
  $('drillBody').innerHTML = `<div class="zonecard"><h4>${esc(o?.name || 'Officer')}</h4><dl class="officer-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><div class="officer-metrics">${['Assigned workload', 'Completed jobs', 'Pending jobs', 'Completion %', 'Target achievement', 'Overdue cases', 'Errors', 'Monthly trend'].map(l => `<div><small>${l}</small><strong>—</strong></div>`).join('')}</div>${empty('Officer-level figures are not yet in the data feed. Branch totals are available one level up.')}</div>`;
}
function renderInsights() {
  if (current !== 'alerts' && !unsupported(current)) {
    $('rightTitle').textContent = 'Top & bottom branches';
    $('rightTop').className = 'rank-list';
    renderRankings('rightTop', current);
    $('bottomTitle').textContent = 'Rate by zone';
    $('rightBottom').innerHTML = ZONES.map(z => { const t = totals(recordsFor(current).filter(r => r.zone === z)); return `<div class="minirow"><span>${esc(z)}</span>${progress(t.rate)}<b>${percentage(t.rate)}</b></div>`; }).join('');
    return;
  }
  $('rightTop').className = '';
  if (current === 'alerts') {
    const a = recordsFor('alerts').sort((x, y) => y.ageHours - x.ageHours);
    $('rightTitle').textContent = 'Exception register';
    $('rightTop').innerHTML = a.length ? a.slice(0, 40).map(r => `<div class="listrow"><span><b>${esc(r.id)} · ${esc(r.severity)}</b><small>${esc(branchById(r.branchId)?.name || r.zone)} · ${r.ageHours} hours</small></span><strong>${esc(r.status)}</strong></div>`).join('') : empty();
    $('bottomTitle').textContent = 'Alerts by zone';
    $('rightBottom').innerHTML = ZONES.map(z => { const n = a.filter(r => r.zone === z).length; return `<div class="minirow"><span>${esc(z)}</span>${progress(a.length ? 100 * n / a.length : 0)}<b>${f(n)}</b></div>`; }).join('');
    return;
  }
  $('rightTitle').textContent = 'Category analysis';
  $('rightTop').innerHTML = empty(current === 'ratio' ? 'Claim ratio requires earned premium and incurred claims amounts, which are not yet in the data feed.' : 'TO error records are not yet in the data feed.');
  $('bottomTitle').textContent = 'Rate by zone';
  $('rightBottom').innerHTML = empty();
}

/* ---------- Load ---------- */
/* Fetch every dataset listed in data.json (cache-busted when fresh = true). */
async function fetchData(fresh = false) {
  const read = async p => { const r = await fetch(fresh ? p + (p.includes('?') ? '&' : '?') + 't=' + Date.now() : p, fresh ? { cache: 'no-store' } : {}); if (!r.ok) throw new Error(`Could not load ${p}: ${r.status}`); return r.json(); };
  const manifest = await read('data.json');
  Object.assign(settings, manifest.thresholds);
  const [org, alerts, users, roles, cats] = await Promise.all([read(manifest.organisation), read(manifest.alerts), read(manifest.users), read(manifest.roles), Promise.all(Object.entries(manifest.categories).map(async ([k, p]) => [k, await read(p)]))]);
  return { org, alerts, users, roles, auth: manifest.auth, categories: Object.fromEntries(cats) };
}
/* Build the lookup tables the dashboard uses from the raw datasets. */
function setData(d) {
  D = d; ORG = D.org; CATS = D.categories; REG = ORG.regions;
  const users = D.users?.users || [], zoneById = id => ORG.zones.find(z => z.id === id);
  ZONES = ORG.zones.filter(z => z.type !== 'unit' && ORG.branches.some(b => b.zoneId === z.id)).map(z => z.name);
  B = ORG.branches.map(b => { const r = REG.find(x => x.id === b.regionId); return { ...b, zone: zoneById(b.zoneId)?.name, region: r?.name, engineerId: r?.engineerIds?.[0] }; });
  // Engineers available in search / scope: regional engineers (their regions) and zone senior engineers (their zone).
  ENG = users.filter(u => u.active !== false && (u.role === 'REGIONAL_ENGINEER' || u.role === 'SENIOR_ENGINEER')).map(u => {
    const se = u.role === 'SENIOR_ENGINEER';
    const branchIds = B.filter(b => se ? b.zoneId === u.zoneId : (u.regionIds || []).includes(b.regionId)).map(b => b.id);
    return { ...u, regions: se ? [`${zoneById(u.zoneId)?.name} Zone (Senior Engineer)`] : (u.regionIds || []).map(id => REG.find(r => r.id === id)?.name), branchIds };
  }).filter(e => e.branchIds.length);
  TOS = users.filter(u => u.role === 'TO' && u.active !== false).map(u => { const b = B.find(x => x.id === u.branchId); return { ...u, zone: b?.zone, regionId: b?.regionId, engineerId: b?.engineerId }; });
}
async function loadDashboard() {
  try {
    if (location.protocol === 'file:') {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'data/local-fallback.js'; s.onload = res; s.onerror = rej; document.head.append(s); });
      Object.assign(settings, window.LOCAL_DASHBOARD_DATA.thresholds);
      setData(window.LOCAL_DASHBOARD_DATA);
    } else setData(await fetchData());
    Auth.start(init);
  } catch (e) {
    console.error(e);
    $('tiles').innerHTML = empty('Dashboard data could not be loaded. Check that the data folder is available and reload.');
  }
}
loadDashboard();
