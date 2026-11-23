// Imports category data from the "SLIC Motor Claims Engineering Dashboard" HTML into data/<category>.json.
//   node tools/import-engineering.cjs "<path to SLIC Motor Claims Engineering Dashboard.html>"
// Then run: node tools/build-org.cjs   (regenerates data/local-fallback.js)
//
// What is imported (all periods 2026):
//   bee    Bee Express  — TO-wise entitled / successful, Jan–Oct, summed to branch
//   video  Video Inspection — VI team officers' Bee Express claims / offers, Jan–Oct, summed to branch
//   sa     SA Pending   — TO-wise outstanding SA jobs, latest daily snapshot of each month (May, Jun)
//   cil    Cash in Lieu — engineer-wise claims / offer / saving, Jan–Jun, attributed to the region's main branch
//   ratio  Claim Ratio  — island-level monthly ratio, premium and claims (no branch split in the source)
// Branch matching: the record's branch name first, then the TO code / officer name in users.json.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), P = p => path.join(ROOT, p);
const read = p => JSON.parse(fs.readFileSync(P(p), 'utf8'));
const write = (p, d) => fs.writeFileSync(P(p), JSON.stringify(d, null, 2) + '\n');

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('Usage: node tools/import-engineering.cjs "<dashboard.html>"'); process.exit(1); }

/* ---------- Evaluate the dashboard's data scripts in a sandbox ---------- */
const html = fs.readFileSync(src, 'utf8');
const code = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n;\n');
const noop = () => null, el = new Proxy({}, { get: () => noop });
const ctx = vm.createContext({
  console, JSON, Math, Date, Set, Map, Object, Array, Number, String, setTimeout: noop, setInterval: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  document: { addEventListener: noop, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => el },
  window: {}, navigator: {}, Chart: function () {}, alert: noop, confirm: () => false, prompt: noop,
});
vm.runInContext(code + `\n;this.__out = { SLIC_DATA, BEE_ALLISLAND, CIL_DATA, SA_TO_DATA, TOP_TO_RAW, BEE_RAW_BY_NAME, BEE_VI_TEAM: [...BEE_VI_TEAM] };`, ctx, { timeout: 10000 });
const S = ctx.__out;

/* ---------- Organisation lookups ---------- */
const manifest = read('data.json'), org = read(manifest.organisation), users = read(manifest.users).users;
const zoneOf = id => org.zones.find(z => z.id === id), regOf = id => org.regions.find(r => r.id === id);
const norm = s => String(s || '').toLowerCase().replace(/main branch|main|branch/g, '').replace(/[^a-z]/g, '');
const ALIAS = { headoffice: 'Head Office', ho: 'Head Office', awissawella: 'Avissawella', bibile: 'Bibila', dikwella: 'Dickwella', kadawata: 'Kadawatha', jaela: 'Ja-Ela', vavunia: 'Vavuniya', higurakgoda: 'Hingurakgoda' };
const byName = new Map(org.branches.map(b => [norm(b.name), b]));
const branchByName = n => { const k = norm(n); return byName.get(k) || (ALIAS[k] && byName.get(norm(ALIAS[k]))) || null; };
const TOs = users.filter(u => u.role === 'TO' && u.branchId);
const toByCode = new Map(TOs.filter(t => t.toCode).map(t => [String(t.toCode), t]));
const toByName = new Map(TOs.map(t => [norm(t.name), t]));
const branchById = id => org.branches.find(b => b.id === id);
const resolve = ({ branch, code, name, region }) =>
  branchByName(branch) ||
  (code != null && toByCode.has(String(code)) && branchById(toByCode.get(String(code)).branchId)) ||
  (name && toByName.has(norm(name)) && branchById(toByName.get(norm(name)).branchId)) ||
  (region && branchByName(region)) || null;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const period = mk => `2026-${String(MONTHS.indexOf(mk) + 1).padStart(2, '0')}`;
const unmatched = {};
const miss = (k, v) => { (unmatched[k] ||= new Set()).add(v); };

// Sum rows into branch × period records.
function build(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = r.branch.id + '|' + r.period;
    const t = m.get(k) || { branchId: r.branch.id, period: r.period, total: 0, completed: 0, pending: 0, amount: 0, saving: 0 };
    t.total += r.total || 0; t.completed += r.completed || 0; t.pending += r.pending || 0; t.amount += r.amount || 0; t.saving += r.saving || 0;
    m.set(k, t);
  }
  return [...m.values()].map(t => {
    const b = branchById(t.branchId), z = zoneOf(b.zoneId), rg = regOf(b.regionId);
    const rec = { branchId: b.id, zone: z?.name, zoneId: b.zoneId, region: rg?.name, regionId: b.regionId, period: t.period, total: t.total, completed: t.completed, pending: t.pending, amount: Math.round(t.amount), rate: t.total ? +(t.completed / t.total * 100).toFixed(2) : null };
    if (t.saving) rec.saving = Math.round(t.saving * 100) / 100;
    return rec;
  }).sort((a, b) => a.period.localeCompare(b.period) || a.branchId.localeCompare(b.branchId));
}
const sumBy = (rs, f) => rs.reduce((s, r) => s + (r[f] || 0), 0);

/* ---------- Bee Express: TO-wise, Jan–Oct ---------- */
const beeRows = [];
for (const [mk, regions] of Object.entries(S.TOP_TO_RAW)) for (const list of Object.values(regions)) for (const t of list) {
  const b = resolve({ branch: t.b, code: t.c, name: t.n });
  if (!b) { miss('bee', `${t.b} (TO ${t.c} ${t.n})`); continue; }
  beeRows.push({ branch: b, period: period(mk), total: t.e, completed: t.s, pending: t.e - t.s });
}
const bee = read(manifest.categories.bee);
bee.records = build(beeRows);
bee.source = 'Engineering Dashboard 2026 — Bee Express TO performance (Jan–Oct 2026)';
bee.islandTotals = Object.fromEntries(Object.entries(S.BEE_ALLISLAND).map(([mk, v]) => [period(mk), { entitled: v.claims, successful: v.offers, rate: v.rate, tos: v.tos }]));

/* ---------- Video Inspection team: VI officers' Bee Express offers, Jan–Oct ---------- */
const vidRows = [], vi = new Set(S.BEE_VI_TEAM);
for (const o of Object.values(S.BEE_RAW_BY_NAME)) {
  if (!vi.has(o.n) || vidRows.some(r => r.officer === o.n)) continue;
  const b = resolve({ branch: o.b, name: o.n, region: o.region });
  if (!b) { miss('video', `${o.b} (${o.n})`); continue; }
  o.m.forEach((m, i) => { if (m) vidRows.push({ officer: o.n, branch: b, period: period(MONTHS[i]), total: m[0], completed: m[1], pending: m[0] - m[1] }); });
}
const video = read(manifest.categories.video);
video.records = build(vidRows);
delete video.sourcePeriod; delete video.sourceAllIsland;
video.source = 'Engineering Dashboard 2026 — Video Inspection team (48 officers), Bee Express claims & offers';
video.officers = [...new Set(vidRows.map(r => r.officer))].length;

/* ---------- SA Pending: latest snapshot per month, TO-wise ---------- */
const MON = { Jan: 'jan', Feb: 'feb', Mar: 'mar', Apr: 'apr', May: 'may', Jun: 'jun', Jul: 'jul', Aug: 'aug', Sep: 'sep', Oct: 'oct', Nov: 'nov', Dec: 'dec' };
const latest = {};
S.SA_TO_DATA.forEach(s => { const p = period(MON[s.label.slice(0, 3)]); latest[p] = s; }); // snapshots are in date order
const saRows = [];
for (const [p, s] of Object.entries(latest)) for (const t of s.tos) {
  const b = resolve({ code: t.c, name: t.n, region: t.r });
  if (!b) { miss('sa', `TO ${t.c} ${t.n} (${t.r})`); continue; }
  saRows.push({ branch: b, period: p, pending: t.cnt });
}
const sa = read(manifest.categories.sa);
sa.records = build(saRows);
sa.pendingOnly = true;
sa.asOf = Object.fromEntries(Object.entries(latest).map(([p, s]) => [p, s.label + ', 2026']));
sa.source = 'Engineering Dashboard 2026 — SA Outstanding daily snapshots (latest per month)';

/* ---------- Cash in Lieu: engineer-wise, attributed to the region's main branch ---------- */
const CIL_REGION = { '(Unknown)': null, 'Head Office': 'Head Office' };
const CIL_GUESS = { Mendis: 'Badulla', Rashmi: 'Ratnapura' }; // region not given in the source; inferred from the regional engineer
const cilRows = [];
for (const e of S.CIL_DATA.engineers) {
  const regionName = e.region === '(Unknown)' ? CIL_GUESS[e.name] : (CIL_REGION[e.region] ?? e.region);
  const b = regionName && branchByName(regionName);
  if (!b) { miss('cil', `${e.name} (${e.region})`); continue; }
  for (const mk of MONTHS) { const m = e[mk]; if (m && m.claims) cilRows.push({ branch: b, period: period(mk), total: m.claims, completed: m.claims, amount: m.offer, saving: m.saving }); }
}
const cil = read(manifest.categories.cil);
cil.records = build(cilRows);
cil.source = 'Engineering Dashboard 2026 — Cash in Lieu engineer report (Jan–Jun 2026); figures attributed to each engineer\'s region main branch';
cil.islandTotals = Object.fromEntries(Object.entries(S.CIL_DATA.allIsland).map(([mk, v]) => [period(mk), v]));

/* ---------- Claim ratio: island level only ---------- */
const ratio = read(manifest.categories.ratio);
const np = Object.fromEntries(S.SLIC_DATA.netPremium.monthly.map(m => [m.month, m]));
ratio.records = [];
ratio.target = 75;
ratio.islandMonthly = S.SLIC_DATA.ratioTrend.labels.map((l, i) => ({ period: period(l.toLowerCase()), ratio: S.SLIC_DATA.ratioTrend.overall[i], premium: np[l]?.premium ?? null, claims: np[l]?.claims ?? null }));
ratio.source = 'Engineering Dashboard 2026 — island claim ratio trend (Jan–May 2026) and Net Premium report (Jan–Mar 2026)';

for (const [k, d] of Object.entries({ bee, video, sa, cil, ratio })) write(manifest.categories[k], d);

/* ---------- Report ---------- */
const chk = (name, recs, island, f1, f2) => Object.entries(island || {}).map(([p, v]) => {
  const r = recs.filter(x => x.period === p);
  return `${p} ${sumBy(r, f1[0])}/${v[f1[1]]}` + (f2 ? ` ${sumBy(r, f2[0]).toFixed(0)}/${Math.round(v[f2[1]])}` : '');
}).join('  ');
console.log('bee   records', bee.records.length, '| imported / source:', chk('bee', bee.records, bee.islandTotals, ['total', 'entitled']));
console.log('video records', video.records.length, 'officers', video.officers);
console.log('sa    records', sa.records.length, Object.entries(latest).map(([p, s]) => `${p} ${sumBy(sa.records.filter(r => r.period === p), 'pending')}/${s.total} (as at ${s.label})`).join('  '));
console.log('cil   records', cil.records.length, '| imported / source:', chk('cil', cil.records, cil.islandTotals, ['total', 'claims'], ['amount', 'offer']));
console.log('ratio months', ratio.islandMonthly.map(m => m.period + ' ' + m.ratio).join(', '));
for (const [k, s] of Object.entries(unmatched)) console.log('UNMATCHED', k, [...s].join(' | '));
