// Builds the organisation, users and roles from data/source/operational-chain.js
// and re-maps every category / alert record to the new branch codes.
//   node tools/build-org.cjs            (run from the project root)
// users.json is the master user list after the first run: existing EPF / mobile / role edits
// are preserved (matched by user id) when the script is re-run.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const P = p => path.join(root, p);
const read = p => JSON.parse(fs.readFileSync(P(p), 'utf8'));
const write = (p, d) => fs.writeFileSync(P(p), JSON.stringify(d, null, 2) + '\n');
const { Z, TO, LEADERS } = require('../data/source/operational-chain.js');

const manifest = read('data.json');
const oldOrg = read(manifest.organisation);
const branchName = n => (n === 'H/O' ? 'Head Office' : n);

/* ---------- Users: leadership, senior engineers, regional engineers ---------- */
const users = [];
const addUser = u => { users.push({ id: u.id, epf: u.epf ?? '', toCode: u.toCode ?? '', name: u.name, mobile: u.mobile ?? '', role: u.role, title: u.title, zoneId: u.zoneId ?? null, regionIds: u.regionIds ?? [], branchId: u.branchId ?? null, loginId: u.loginId ?? '', active: true }); return u.id; };
addUser({ id: 'AGM-01', loginId: 'AGM', name: LEADERS.agm, role: 'AGM', title: 'AGM – Technical' });
addUser({ id: 'DCME-01', loginId: 'DCME', name: LEADERS.dcme, role: 'DCME', title: 'Deputy Chief Motor Engineer' });

const zones = Z.map(z => {
  const seniorEngineerId = addUser({ id: 'SE-' + z.code, loginId: 'SE-' + z.code, name: z.se, role: 'SENIOR_ENGINEER', title: z.unit ? 'Senior Engineer – Spare Parts Unit' : `Senior Engineer – ${z.name} Zone`, zoneId: z.code });
  return { id: z.code, name: z.name, type: z.unit ? 'unit' : 'zone', seniorEngineerId, regionCount: z.unit ? 0 : z.nreg || z.regs.length };
});

// Regional engineers: one user per person, linked to every region they cover.
const reByName = new Map();
let reSeq = 0;
const regionalEngineer = (name, regionId, zoneId) => {
  if (!reByName.has(name)) {
    reSeq++;
    const id = 'RE-' + String(reSeq).padStart(2, '0');
    addUser({ id, loginId: id, name, role: 'REGIONAL_ENGINEER', title: 'Regional Engineer', zoneId });
    reByName.set(name, id);
  }
  const u = users.find(x => x.id === reByName.get(name));
  if (!u.regionIds.includes(regionId)) u.regionIds.push(regionId);
  return u.id;
};

const regions = [];
for (const z of Z) for (const r of z.regs) {
  const [code, name, engineer, , , , note, subs, extra] = r;
  const engineerIds = [], subRegions = [];
  if (subs) subs.forEach(([sc, en]) => { const id = regionalEngineer(en, code, z.code); engineerIds.push(id); subRegions.push({ code: sc, engineerId: id }); });
  else engineerIds.push(regionalEngineer(engineer, code, z.code));
  if (extra) engineerIds.push(regionalEngineer(extra, code, z.code));
  regions.push({ id: code, name, zoneId: z.code, engineerIds, countsAs: subs ? subs.length : 1, ...(subRegions.length ? { subRegions } : {}), ...(note ? { note } : {}) });
}

/* ---------- Branches and technical officers ---------- */
const branches = [];
for (const t of TO) {
  const [, , , brId, brName, regionId, , zoneId] = t;
  if (!branches.some(b => b.id === brId)) branches.push({ id: brId, name: branchName(brName), regionId, zoneId, active: true });
}
for (const [epf, toCode, name, branchId, , regionId, , zoneId, , mobile] of TO) {
  addUser({ id: 'TO-' + epf, epf: String(epf), toCode: toCode === '' ? '' : String(toCode), name, mobile: String(mobile || ''), role: 'TO', title: 'Technical Officer', zoneId, regionIds: [regionId], branchId });
}

// Keep manual edits from an existing users.json (EPF, mobile, role, active, extra users).
const usersPath = 'data/users.json';
if (fs.existsSync(P(usersPath))) {
  const prev = read(usersPath).users || [];
  for (const p of prev) {
    const u = users.find(x => x.id === p.id);
    if (!u) { users.push(p); continue; }
    for (const k of ['name', 'epf', 'mobile', 'toCode', 'role', 'title', 'active', 'loginId']) if (p[k] !== undefined && p[k] !== '' && p[k] !== u[k]) u[k] = p[k];
  }
}

/* ---------- Re-map existing records to the new branch codes ---------- */
const newByName = new Map(branches.map(b => [b.name.toLowerCase(), b]));
newByName.set('higurakgoda', newByName.get('hingurakgoda')); // spelling in the earlier dataset
const oldToNew = new Map();
const unmatched = [];
for (const b of oldOrg.branches) {
  const n = newByName.get(b.name.toLowerCase());
  if (n) oldToNew.set(b.id, n); else unmatched.push(b.name);
}
const zoneName = id => zones.find(z => z.id === id)?.name;
const regionName = id => regions.find(r => r.id === id)?.name;
const alreadyNew = oldOrg.regions && oldOrg.metadata?.hierarchy?.includes('region');
const remap = r => {
  const b = alreadyNew ? branches.find(x => x.id === r.branchId) : oldToNew.get(r.branchId);
  if (!b) return false;
  r.branchId = b.id; r.zoneId = b.zoneId; r.zone = zoneName(b.zoneId); r.regionId = b.regionId; r.region = regionName(b.regionId);
  delete r.engineerId;
  return true;
};
const counts = {};
for (const [key, p] of Object.entries(manifest.categories)) {
  const d = read(p);
  const before = d.records.length;
  d.records = d.records.filter(remap);
  counts[key] = `${d.records.length}/${before}`;
  write(p, d);
}
const alerts = read(manifest.alerts);
alerts.records = alerts.records.filter(remap);
write(manifest.alerts, alerts);

/* ---------- Write organisation, users, roles, manifest ---------- */
const org = {
  metadata: {
    source: 'Island Operational Chain – Technical officer List 2026',
    hierarchy: ['zone', 'region', 'branch', 'technicalOfficer'],
    zones: zones.filter(z => z.type === 'zone').length, units: zones.filter(z => z.type === 'unit').length,
    regions: regions.reduce((a, r) => a + r.countsAs, 0), branches: branches.length,
    technicalOfficers: users.filter(u => u.role === 'TO').length,
  },
  leadership: { agmId: 'AGM-01', dcmeId: 'DCME-01' },
  zones, regions, branches,
};
write(manifest.organisation, org);
write(usersPath, { note: 'Master user list. Sign in with EPF (or loginId until an EPF is added) and the common password.', users });

const rolesPath = 'data/roles.json';
if (!fs.existsSync(P(rolesPath))) {
  const all = ['home', 'zones', 'branches', 'alerts', 'search', 'officerContacts'];
  write(rolesPath, {
    note: 'scope: island | zone | region | branch. branchDetail: all = can open any branch breakdown, own = only branches in scope. otherBranches: summary = see other branches as totals and rankings, hidden = only own scope. screens: which parts of the dashboard the role can open.',
    screens: all,
    roles: {
      ADMIN: { label: 'Administrator', level: 0, scope: 'island', branchDetail: 'all', otherBranches: 'summary', screens: all },
      AGM: { label: 'AGM – Technical', level: 1, scope: 'island', branchDetail: 'all', otherBranches: 'summary', screens: all },
      DCME: { label: 'Deputy Chief Motor Engineer', level: 2, scope: 'island', branchDetail: 'all', otherBranches: 'summary', screens: all },
      VIEWER: { label: 'Island viewer', level: 2, scope: 'island', branchDetail: 'all', otherBranches: 'summary', screens: all },
      SENIOR_ENGINEER: { label: 'Senior Engineer', level: 3, scope: 'zone', branchDetail: 'own', otherBranches: 'summary', screens: all },
      REGIONAL_ENGINEER: { label: 'Regional Engineer', level: 4, scope: 'region', branchDetail: 'own', otherBranches: 'summary', screens: all },
      TO: { label: 'Technical Officer', level: 6, scope: 'branch', branchDetail: 'own', otherBranches: 'summary', screens: ['home', 'zones', 'branches', 'alerts', 'search'] },
    },
  });
}

manifest.users = usersPath;
manifest.roles = rolesPath;
if (!manifest.auth) manifest.auth = { commonPasswordSha256: crypto.createHash('sha256').update('Slic@2026').digest('hex'), sessionHours: 12 };
write('data.json', manifest);

// Regenerate the file:// fallback bundle.
const bundle = { org, users: read(usersPath), roles: read(rolesPath), auth: manifest.auth, categories: Object.fromEntries(Object.entries(manifest.categories).map(([k, p]) => [k, read(p)])), alerts: read(manifest.alerts), thresholds: manifest.thresholds };
fs.writeFileSync(P('data/local-fallback.js'), '// Generated by tools/build-org.cjs from the JSON datasets.\nwindow.LOCAL_DASHBOARD_DATA = ' + JSON.stringify(bundle) + ';\n');

console.log('zones', zones.length, 'regions', regions.length, '(counts as', org.metadata.regions + ')', 'branches', branches.length, 'users', users.length,
  'roles', [...new Set(users.map(u => u.role))].map(r => r + ':' + users.filter(u => u.role === r).length).join(' '));
console.log('records kept', counts, 'alerts', alerts.records.length);
if (unmatched.length) console.log('UNMATCHED old branches:', unmatched);
