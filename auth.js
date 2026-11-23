/* Sign-in and role-based access.
   Users sign in with their EPF number (or loginId until an EPF is recorded) and the common password.
   NOTE: this runs in the browser, so it controls what the dashboard shows but is not a security
   boundary — protect the data on the server before exposing it beyond the internal network. */
const Auth = (() => {
  const KEY = 'slic-claims-session';
  let user = null, role = null, scope = null; // scope: Set of branch ids, or null for island-wide
  let USERS = [], ROLES = {}, cfg = {};

  /* ---------- SHA-256 (Web Crypto, with a small fallback for non-secure origins) ---------- */
  async function sha256(text) {
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    const K = [], H = [], isPrime = n => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
    for (let n = 2, c = 0; c < 64; n++) if (isPrime(n)) { if (c < 8) H[c] = (Math.pow(n, 1 / 2) * 2 ** 32) | 0; K[c++] = (Math.pow(n, 1 / 3) * 2 ** 32) | 0; }
    const bytes = [...new TextEncoder().encode(text)], len = bytes.length * 8;
    bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (len >>> (i * 8)) & 255);
    const r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
      const w = [];
      for (let i = 0; i < 64; i++) {
        if (i < 16) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
        else { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  /* ---------- Scope ---------- */
  function computeScope(u, rl) {
    const kind = rl?.scope || 'branch';
    if (kind === 'island') return null;
    if (kind === 'zone') {
      const z = ORG.zones.find(x => x.id === u.zoneId);
      if (!z || z.type === 'unit') return null; // Spare Parts Unit works island-wide
      return new Set(B.filter(b => b.zoneId === u.zoneId).map(b => b.id));
    }
    if (kind === 'region') return new Set(B.filter(b => (u.regionIds || []).includes(b.regionId)).map(b => b.id));
    return new Set(u.branchId ? [u.branchId] : []);
  }
  const findUser = id => {
    const q = String(id || '').trim().toLowerCase();
    if (!q) return null;
    return USERS.find(u => String(u.epf || '').toLowerCase() === q) || USERS.find(u => String(u.loginId || '').toLowerCase() === q) || null;
  };
  function setUser(u) {
    user = u; role = ROLES[u.role] || ROLES.TO || {}; scope = computeScope(u, role);
  }

  /* ---------- Session ---------- */
  function restore() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!s || Date.now() > s.expires) return null;
      const u = USERS.find(x => x.id === s.userId && x.active !== false);
      return u || null;
    } catch (e) { return null; }
  }
  function save(u) {
    try { localStorage.setItem(KEY, JSON.stringify({ userId: u.id, expires: Date.now() + (cfg.sessionHours || 12) * 3600e3 })); } catch (e) { /* storage blocked */ }
  }
  function logout() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    location.reload();
  }

  /* ---------- Sign-in screen ---------- */
  function showLogin(onReady) {
    document.body.classList.add('auth-locked');
    const el = document.createElement('div');
    el.id = 'login';
    el.innerHTML = `
      <form class="login-card" novalidate>
        <img src="assets/slic-general.png" alt="SLIC General" class="login-logo" />
        <h1>Motor Claims Dashboard</h1>
        <p class="login-sub">Sign in with your EPF number</p>
        <label for="loginId">EPF number</label>
        <input id="loginId" name="username" inputmode="text" autocomplete="username" placeholder="e.g. 30946" required />
        <label for="loginPw">Password</label>
        <div class="login-pw"><input id="loginPw" name="password" type="password" autocomplete="current-password" placeholder="Common password" required />
          <button type="button" class="login-eye" aria-label="Show password" aria-pressed="false">Show</button></div>
        <div class="login-error" role="alert" aria-live="assertive"></div>
        <button type="submit" class="login-btn">Sign in</button>
        <p class="login-foot">SLIC General · Motor Engineering</p>
      </form>`;
    document.body.append(el);
    const form = el.querySelector('form'), err = el.querySelector('.login-error'), btn = el.querySelector('.login-btn');
    const eye = el.querySelector('.login-eye'), pw = el.querySelector('#loginPw');
    eye.onclick = () => { const show = pw.type === 'password'; pw.type = show ? 'text' : 'password'; eye.textContent = show ? 'Hide' : 'Show'; eye.setAttribute('aria-pressed', show); };
    setTimeout(() => el.querySelector('#loginId').focus(), 50);
    form.onsubmit = async e => {
      e.preventDefault();
      err.textContent = '';
      const id = el.querySelector('#loginId').value, pass = pw.value;
      if (!id.trim() || !pass) { err.textContent = 'Enter your EPF number and password.'; return; }
      btn.disabled = true; btn.textContent = 'Signing in…';
      const u = findUser(id);
      const ok = u && (await sha256(pass)) === cfg.commonPasswordSha256;
      btn.disabled = false; btn.textContent = 'Sign in';
      if (!u) { err.textContent = 'This EPF number is not registered for the dashboard.'; return; }
      if (u.active === false) { err.textContent = 'This account is inactive. Contact the administrator.'; return; }
      if (!ok) { err.textContent = 'Incorrect password.'; pw.select(); return; }
      save(u); setUser(u);
      el.classList.add('out');
      setTimeout(() => { el.remove(); document.body.classList.remove('auth-locked'); onReady(); }, 260);
    };
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    let t = document.getElementById('appToast');
    if (!t) { t = document.createElement('div'); t.id = 'appToast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  return {
    start(onReady) {
      USERS = D.users?.users || []; ROLES = D.roles?.roles || {}; cfg = D.auth || {};
      const u = restore();
      if (u) { setUser(u); onReady(); } else showLogin(onReady);
    },
    logout, toast,
    get user() { return user; },
    get role() { return role; },
    get users() { return USERS; },
    roleLabel: u => ROLES[(u || user)?.role]?.label || (u || user)?.role || '',
    /* Island-wide users see everything; others are limited to their scope for breakdowns. */
    islandWide: () => scope === null,
    scopeBranches: () => scope,
    inMyScope: branchId => scope === null || scope.has(branchId),
    canOpenBranch(branchId) { return scope === null || role.branchDetail === 'all' || scope.has(branchId); },
    showsOthers: () => scope === null || role.otherBranches !== 'hidden',
    can: screen => !role?.screens || role.screens.includes(screen),
    deny(what = 'branch') { toast(what === 'branch' ? 'Branch breakdown is limited to your own scope. Totals and rankings are still visible.' : 'You do not have access to this section.'); },
    /* The scope a user lands on after sign-in and after "Clear". */
    homeScope() {
      if (!user || scope === null) return { zone: 'all', pick: null };
      const kind = role.scope;
      if (kind === 'zone') return { zone: ORG.zones.find(z => z.id === user.zoneId)?.name || 'all', pick: null };
      if (kind === 'region') return { zone: 'all', pick: { type: 'engineer', id: user.id } };
      return { zone: 'all', pick: user.branchId ? { type: 'branch', id: user.branchId } : null };
    },
    initials(u = user) { return (u?.name || '?').replace(/^(Mr|Mrs|Ms)\.?\s*/i, '').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(-2).map(s => s[0]).join('').toUpperCase(); },
  };
})();
