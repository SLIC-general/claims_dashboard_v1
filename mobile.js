/* Mobile app shell (≤ 700px).
   A native-style layer on top of app.js: it reuses the data, filters and
   calculations defined there and only owns layout, navigation and motion. */
(() => {
  const mq = matchMedia('(max-width: 700px)');
  const state = { view: 'home', tab: 'home', rankTab: 'top', stype: 'branch', built: false, key: '', sheet: false };
  const open = new Set();
  const tap = () => { try { navigator.vibrate?.(6); } catch (e) { /* unsupported */ } };

  /* ---------- Small view helpers ---------- */
  const ring = (p, color, size = 56) => {
    const v = Math.max(0, Math.min(100, p || 0));
    return `<svg class="m-ring" viewBox="0 0 36 36" width="${size}" height="${size}" aria-hidden="true"><circle cx="18" cy="18" r="15.9" class="m-ring-bg"/><circle cx="18" cy="18" r="15.9" pathLength="100" class="m-ring-fg" style="stroke:${color};--off:${100 - v}"/></svg>`;
  };
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const I = {
    home: svg('<path d="M3 11 12 4l9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8Z"/>'),
    zones: svg('<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2v4.3M12 11.5H5v5.3M12 11.5h7v5.3"/>'),
    rank: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>'),
    bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    back: svg('<path d="m15 18-6-6 6-6"/>'),
    chev: svg('<path d="m9 18 6-6-6-6"/>'),
    down: svg('<path d="m6 9 6 6 6-6"/>'),
    phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
    logout: svg('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>'),
  };
  // Illustrated profile picture (replace with <img src="..."> once user photos are available).
  const AVATAR = `<svg class="m-avatar-img" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="avBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe3a3"/><stop offset="1" stop-color="#ffc2b5"/></linearGradient></defs>
    <rect width="64" height="64" fill="url(#avBg)"/>
    <path d="M10 64c1-12 10-19 22-19s21 7 22 19Z" fill="#0a7c86"/>
    <path d="M27 44h10l-1 6-4 3-4-3Z" fill="#fff"/>
    <path d="M28 38h8v8a4 4 0 0 1-8 0Z" fill="#e0a27e"/>
    <ellipse cx="32" cy="28" rx="11" ry="12.5" fill="#f0b892"/>
    <path d="M20.5 27c-1-9 4.5-15 11.5-15 7.5 0 12.5 5 11.5 15-1.5-5-5-8-11.5-8.5-6 .5-10 3.5-11.5 8.5Z" fill="#2b2320"/>
    <ellipse cx="20.8" cy="29" rx="1.8" ry="2.6" fill="#e6a982"/><ellipse cx="43.2" cy="29" rx="1.8" ry="2.6" fill="#e6a982"/>
    <circle cx="27.8" cy="29" r="1.3" fill="#2b2320"/><circle cx="36.2" cy="29" r="1.3" fill="#2b2320"/>
    <path d="M28.5 34.5q3.5 2.6 7 0" stroke="#b5654a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`;
  // Adds a stagger index to the element's first tag, merging with any inline style already there.
  const stagger = (html, i) => {
    const end = html.indexOf('>'), tag = html.slice(0, end);
    return (tag.includes('style="') ? tag.replace('style="', `style="--i:${i};`) : tag.replace(/^<(\w+)/, `<$1 style="--i:${i}"`)) + html.slice(end);
  };
  const rateOf = k => headline(k).rate;

  /* ---------- Shell ---------- */
  function build() {
    const el = document.createElement('div');
    el.id = 'm-app';
    el.innerHTML = `
      <header class="m-head">
        <div class="m-head-row">
          <img src="assets/slic-general.png" class="m-logo" alt="SLIC General" />
          <div class="m-titles"><h1 id="mTitle">Claims Dashboard</h1><small id="mScope"></small></div><div class="m-headbar" id="mHeadBar"></div>
          <div class="m-profile">
            <button class="m-avatar-btn" id="mAvatarBtn" onclick="M.menu(event)" aria-label="Account menu" aria-haspopup="menu" aria-expanded="false">${AVATAR}<i class="m-online"></i></button>
            <div class="m-menu" id="mMenu" role="menu">
              <div class="m-menu-head"><span class="m-avatar-btn">${AVATAR}</span><span><b id="mUserName">Signed in</b><small id="mUserRole">Motor Claims</small></span></div>
              <button role="menuitem" onclick="M.profile()">${I.user}My Profile</button>
              <button role="menuitem" onclick="M.menu(); Auth.toast('Profile editing will be available once accounts are managed centrally.')">${I.edit}Edit Profile</button>
              <button role="menuitem" onclick="M.menu(); Auth.toast('Account management will be available once accounts are managed centrally.')">${I.gear}Manage Account</button>
              <button role="menuitem" class="m-logout" onclick="Auth.logout()">${I.logout}Logout</button>
            </div>
          </div>
        </div>
        <div class="m-chips">
          <label class="m-chip m-chip-select"><span id="mPeriodLabel"></span>${I.down}<select id="mPeriod" aria-label="Reporting period"></select></label>
          <div class="m-seg" role="group" aria-label="Period type"><button id="mDay" onclick="M.mode('daily')">Daily</button><button id="mMonth" onclick="M.mode('monthly')">Monthly</button><button id="mYear" onclick="M.mode('yearly')">Yearly</button></div>
        </div>
      </header>
      <main class="m-main" id="mMain"></main>
      <nav class="m-tabbar" aria-label="Main">
        <button data-tab="home" onclick="M.tab('home')">${I.home}<span>Home</span></button>
        <button data-tab="zones" onclick="M.tab('zones')">${I.zones}<span>Zones</span></button>
        <button class="m-fab" onclick="M.sheet(true)" aria-label="Search and filters">${I.search}<i class="m-fab-dot" id="mFabDot"></i></button>
        <button data-tab="branches" onclick="M.tab('branches')">${I.rank}<span>Branches</span></button>
        <button data-tab="alerts" onclick="M.tab('alerts')">${I.bell}<span>Alerts</span><i class="m-tab-badge" id="mTabBadge"></i></button>
      </nav>
      <div class="m-backdrop" id="mBackdrop" onclick="M.sheet(false)"></div>
      <section class="m-sheet" id="mSheet" role="dialog" aria-modal="true" aria-labelledby="mSheetTitle">
        <div class="m-grab" id="mGrab"><span></span></div>
        <div class="m-sheet-head"><h2 id="mSheetTitle">Search &amp; filter</h2><button class="m-link" onclick="M.clearAll()">Clear all</button></div>
        <div class="m-zone-chips" id="mZoneChips"></div>
        <div class="m-seg m-stype" id="mSType" role="tablist" aria-label="Search for">
          <button data-t="branch" onclick="M.stype('branch')">Branch</button><button data-t="engineer" onclick="M.stype('engineer')">Engineer</button><button data-t="to" onclick="M.stype('to')">TO</button>
        </div>
        <form class="m-search-row" onsubmit="event.preventDefault(); M.go()">
          <div class="m-search">${I.search}<input id="mSearch" type="search" autocomplete="off" enterkeyhint="search" oninput="M.search()" /></div>
          <button type="submit" class="m-search-btn">Search</button>
        </form>
        <div id="mPick"></div>
        <div class="m-results" id="mResults"></div>
      </section>`;
    document.body.append(el);
    $('mPeriod').addEventListener('change', e => { tap(); $('period').value = e.target.value; refresh(); });
    // Drag the sheet down to dismiss it.
    let y0 = null, dy = 0;
    const sheet = $('mSheet');
    $('mGrab').addEventListener('touchstart', e => { y0 = e.touches[0].clientY; sheet.style.transition = 'none'; }, { passive: true });
    $('mGrab').addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
    $('mGrab').addEventListener('touchend', () => { sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 90) M.sheet(false); y0 = null; dy = 0; });
    addEventListener('popstate', onBack);
    initPullToRefresh(el);
    // Keep the search sheet above the on-screen keyboard (visual viewport shrinks, layout doesn't).
    const vv = window.visualViewport;
    if (vv) {
      const fit = () => {
        const kb = Math.max(0, innerHeight - vv.height - vv.offsetTop);
        el.style.setProperty('--kb', kb + 'px');
        el.style.setProperty('--vvh', vv.height + 'px');
        el.classList.toggle('kb-open', kb > 80);
      };
      vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
    }
    document.addEventListener('click', e => { if (!e.target.closest('.m-profile')) M.menu(); });
    state.built = true;
  }

  /* ---------- Pull to refresh ---------- */
  async function reloadData() {
    if (location.protocol === 'file:') { await new Promise(r => setTimeout(r, 700)); refresh(); return; }
    setData(await fetchData(true));
    const top = $('mMain').scrollTop;
    refresh(); // same view key → no slide animation
    $('mMain').scrollTop = top;
  }
  function initPullToRefresh(root) {
    const ptr = document.createElement('div');
    ptr.className = 'm-ptr';
    ptr.innerHTML = `<span class="m-ptr-spin">${svg('<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4h-4"/>')}</span>`;
    root.insertBefore(ptr, $('mMain'));
    const main = $('mMain'), MAX = 110, TRIGGER = 70;
    let y0 = null, d = 0, busy = false;
    const set = v => { d = v; ptr.style.setProperty('--d', v + 'px'); main.style.transform = v ? `translateY(${v * 0.6}px)` : ''; ptr.style.setProperty('--p', Math.min(1, v / TRIGGER)); ptr.classList.toggle('ready', v >= TRIGGER); };
    main.addEventListener('touchstart', e => { if (busy || state.sheet || main.scrollTop > 0) return; y0 = e.touches[0].clientY; ptr.style.top = main.offsetTop + 'px'; ptr.classList.add('drag'); }, { passive: true });
    main.addEventListener('touchmove', e => {
      if (y0 === null) return;
      const dy = e.touches[0].clientY - y0;
      if (dy <= 0 || main.scrollTop > 0) { set(0); return; }
      if (e.cancelable) e.preventDefault(); // stop the browser's own pull/overscroll
      set(Math.min(MAX, dy * 0.5));
    }, { passive: false });
    main.addEventListener('touchend', async () => {
      if (y0 === null) return;
      y0 = null; ptr.classList.remove('drag');
      if (d < TRIGGER) { set(0); return; }
      busy = true; tap(); ptr.classList.add('loading'); set(56);
      try { await Promise.all([reloadData(), new Promise(r => setTimeout(r, 600))]); ptr.classList.add('done'); }
      catch (err) { console.error(err); ptr.classList.add('fail'); }
      setTimeout(() => { set(0); setTimeout(() => { ptr.classList.remove('loading', 'done', 'fail'); busy = false; }, 300); }, 450);
    });
  }

  /* ---------- History: hardware/browser back steps through the app ---------- */
  const push = () => history.pushState({ m: true }, '');
  function onBack() {
    if (!mq.matches) return;
    if (state.sheet) { closeSheet(); return; }
    if (state.view === 'detail') {
      if (level > 0) { goUp(); return; }
      state.view = state.tab === 'alerts' ? 'home' : state.tab;
      if (state.tab === 'alerts') state.tab = 'home';
      state.dir = 'back';
      home();
    }
  }

  /* ---------- Render ---------- */
  function render() {
    if (!mq.matches || !D) return;
    if (!state.built) build();
    syncHeader();
    const key = [state.view, state.tab, current, level, path.join('/'), focus, state.rankTab].join('|');
    const main = $('mMain');
    const html = state.view === 'detail' && current ? detailView() : state.view === 'zones' ? zonesView() : state.view === 'branches' ? branchesView() : homeView();
    if (key !== state.key) {
      main.classList.remove('m-enter', 'm-enter-back');
      void main.offsetWidth; // restart the animation
      main.classList.add(state.dir === 'back' ? 'm-enter-back' : 'm-enter');
      main.scrollTop = 0;
      state.key = key; state.dir = '';
    }
    main.innerHTML = html;
    // Detail screens: lift the back button + title into the coloured header.
    const bar = main.querySelector(':scope > .m-appbar');
    $('mHeadBar').replaceChildren(...(bar ? [bar] : []));
    $('m-app').classList.toggle('has-bar', !!bar);
    wireSlider(); wireOv();
    $('m-app').classList.toggle('is-ov', !!document.getElementById('mOvTrack'));
    $('m-app').classList.toggle('is-home', state.view === 'home' || (state.view !== 'detail' && state.view !== 'zones' && state.view !== 'branches'));
    document.querySelectorAll('.m-tabbar [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === (state.view === 'detail' && current === 'alerts' ? 'alerts' : state.tab)));
    if (state.sheet) renderSheet();
  }
  function syncHeader() {
    const p = $('period');
    if ($('mPeriod').innerHTML !== p.innerHTML) $('mPeriod').innerHTML = p.innerHTML;
    $('mPeriod').value = p.value;
    $('mPeriodLabel').textContent = periodLabel();
    $('mDay').classList.toggle('on', mode === 'daily');
    $('mMonth').classList.toggle('on', mode === 'monthly');
    $('mYear').classList.toggle('on', mode === 'yearly');
    $('mScope').textContent = 'Motor Claims · ' + scopeLabel();
    const a = alertCounts();
    $('mTabBadge').textContent = a.all > 99 ? '99+' : a.all || '';
    $('mTabBadge').hidden = !a.all;
    $('mFabDot').hidden = !(pick || getZone() !== 'all');
    if (Auth.user) {
      $('mUserName').textContent = Auth.user.name;
      $('mUserRole').textContent = Auth.user.title || Auth.roleLabel();
      // Screen permissions from roles.json
      document.querySelectorAll('.m-tabbar [data-tab]').forEach(b => { b.hidden = b.dataset.tab !== 'home' && !Auth.can(b.dataset.tab); });
      document.querySelector('.m-tabbar .m-fab').hidden = branchLocked() || !Auth.can('search');
    }
  }
  /* "Your branch / region / zone" ranking card for scoped users */
  function standingCard(key, compact) {
    const s = standing(key);
    if (!s) return '';
    const d = s.rate - s.islandRate, noun = { branch: 'Your branch', region: 'Your region', zone: 'Your zone' }[s.kind];
    return `<button class="m-card m-standing ${compact ? 'compact' : ''}" onclick="M.mine()">
      <span class="m-st-main"><small>${noun} · ${esc(catInfo(key)[1])}</small><b>${esc(s.label)}</b></span>
      <span class="m-st-cell"><b>#${s.rank}</b><small>of ${s.of}</small></span>
      ${s.inner ? `<span class="m-st-cell"><b>#${s.inner.rank}</b><small>in ${esc(s.inner.label)}</small></span>` : ''}
      <span class="m-st-cell"><b class="${tone(s.rate)}">${s.rate.toFixed(1)}%</b><small class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'}${Math.abs(d).toFixed(1)}</small></span></button>`;
  }

  /* Home: hero + alerts + categories */
  function homeView() {
    const a = alertCounts();
    const alert = `<button class="m-card m-alert" onclick="M.tab('alerts')"><span class="m-alert-ico">${icon('alert')}</span>
      <span class="m-alert-text"><b>Critical Alerts</b><small>${a.all ? `${f(a.all)} open · ${esc(scopeLabel())}` : 'No alerts this period'}</small></span>
      <span class="m-alert-stats"><span><b>${a.all ? a.critical : '—'}</b>Critical</span><span><b>${a.all ? a.breached : '—'}</b>SLA</span><span><b>${a.all ? a.overdue : '—'}</b>&gt;48h</span></span></button>`;
    const tiles = info.map(([key, t, c], i) => {
      const hh = headline(key), rows = hh.absent ? [] : recordsFor(key), tt = totals(rows);
      // Rank chip: own unit's island rank for scoped users, leading zone for island-wide users.
      const s = hh.absent ? null : standing(key);
      let chip = '';
      if (s) chip = `<span class="m-tile-rank ${tone(s.rate)}" title="${esc(s.label)} rank">#${s.rank}<small>/${s.of}</small></span>`;
      else if (!hh.absent && rows.length && !countBased(key)) { const z = bestZone(key); if (z) chip = `<span class="m-tile-rank lead" title="Leading zone">▲ ${esc(short(z.z))}</span>`; }
      let stats;
      if (hh.absent) stats = `<span class="m-tstats muted"><em>Not in data feed</em></span>`;
      else if (!rows.length) stats = `<span class="m-tstats"><em>${esc(hh.secondary)}</em></span>`;
      else if (key === 'sa' && CATS.sa.pendingOnly) stats = `<span class="m-tstats"><em>as at ${esc(saAsOf().replace(/, \d{4}$/, ''))}</em><em>${(n => f(n) + (n === 1 ? ' branch' : ' branches'))(new Set(rows.map(r => r.branchId)).size)}</em></span>`;
      else if (key === 'cil') stats = `<span class="m-tstats"><em><i class="dot positive"></i>saving ${money(tt.saving)}</em><em>${f(tt.total)} claims</em></span>`;
      else if (countBased(key)) stats = `<span class="m-tstats">${chip || `<em><i class="dot ${tone(tt.rate)}"></i>${pctShort(tt.rate)} cleared</em>`}<em>${chip ? pctShort(tt.rate) + ' cleared' : kf(tt.total) + ' cases'}</em></span>`;
      else stats = `<span class="m-tstats">${chip}<em>${kf(tt.done)}<small>/${kf(tt.total)}</small></em></span>`;
      const bar = !hh.absent && rows.length && !countBased(key) ? `<span class="m-tile-bar"><i class="${tone(hh.rate)}" style="width:${Math.max(0, Math.min(100, hh.rate || 0))}%"></i></span>` : '';
      return stagger(`<button class="m-tile m-tile3 ${hh.absent ? 'absent' : ''}" style="--accent:${c}" onclick="M.cat('${key}')"><span class="m-tile-ico">${icon(key)}</span><span class="m-tile-name">${t}</span><b>${hh.value}</b>${stats}${bar}</button>`, i);
    }).join('');
    return `${alert}${heroSlider()}<div class="m-tiles">${tiles}</div>`;
  }

  /* ---------- Number helpers ---------- */
  const kf = n => (n = +n || 0) >= 1e5 ? Math.round(n / 1e3) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : f(n);
  const pctShort = r => r === null || r === undefined ? '—' : Math.round(r) + '%';
  const short = s => String(s || '').replace(/ Zone$/, '').replace(/Spare Parts Unit/, 'SPU');
  const agg = list => { const t = list.reduce((a, r) => (a.total += r.total || 0, a.done += r.done || 0, a.pending += r.pending || 0, a.amount += r.amount || 0, a.saving += r.saving || 0, a), { total: 0, done: 0, pending: 0, amount: 0, saving: 0 }); t.rate = t.total ? t.done / t.total * 100 : null; return t; };
  const valOf = (key, o) => key === 'sa' || key === 'consistency' ? f(o.pending) : key === 'cil' ? money(o.amount) : percentage(o.rate);
  function bestZone(key) {
    const rows = branchRows(key, true);
    return ZONES.map(z => ({ z, ...agg(rows.filter(r => r.zone === z)) })).filter(x => x.rate !== null).sort((a, b) => b.rate - a.rate)[0] || null;
  }

  /* ---------- Hero slider: one slide per category, content depends on the role ---------- */
  function slideFor(key) {
    const [, title, accent] = catInfo(key), hh = headline(key);
    if (hh.absent || key === 'alerts') return '';
    const s = standing(key);
    const cell = (b, sm, cls = '') => `<span class="m-sl-cell"><b class="${cls}">${b}</b><small>${sm}</small></span>`;
    if (s) {
      const d = s.rate - s.islandRate, noun = { branch: 'Your branch', region: 'Your region', zone: 'Your zone' }[s.kind];
      return `<button class="m-slide" style="--accent:${accent}" onclick="M.cat('${key}')">
        <span class="m-sl-ico">${icon(key)}</span>
        <span class="m-sl-main"><small>${noun} · ${esc(title)}</small><b>${esc(s.label)}</b></span>
        ${cell('#' + s.rank, 'of ' + s.of)}
        ${s.inner ? cell('#' + s.inner.rank, 'in ' + esc(short(s.inner.label))) : ''}
        <span class="m-sl-cell"><b class="${tone(s.rate)}">${s.rate.toFixed(1)}%</b><small class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'}${Math.abs(d).toFixed(1)} vs island</small></span></button>`;
    }
    // Island-wide roles: overall rate, leading zone and branches needing attention.
    const rows = branchRows(key, true), ranked = rows.filter(r => r.rate !== null && r.total >= settings.minimumRankingVolume).sort((a, b) => b.rate - a.rate);
    const z = bestZone(key), low = ranked.filter(r => r.rate < settings.attention).length;
    if (key === 'sa' || key === 'cil') {
      const by = key === 'sa' ? 'pending' : 'saving', lead = [...rows].sort((a, b) => (b[by] || 0) - (a[by] || 0))[0];
      return `<button class="m-slide island" style="--accent:${accent}" onclick="M.cat('${key}')">
        <span class="m-sl-ico">${icon(key)}</span>
        <span class="m-sl-main"><small>${esc(scopeLabel())} · ${esc(title)}</small><b>${hh.value}</b></span>
        ${lead ? cell(esc(lead.name), key === 'sa' ? `most · ${f(lead.pending)}` : 'top saving') : ''}
        ${key === 'sa' ? cell(f(rows.length), 'branches') : cell(esc(money(agg(rows).saving)), 'saving', 'positive')}</button>`;
    }
    return `<button class="m-slide island" style="--accent:${accent}" onclick="M.cat('${key}')">
      <span class="m-sl-ico">${icon(key)}</span>
      <span class="m-sl-main"><small>${esc(scopeLabel())} · ${esc(title)}</small><b>${hh.value}</b></span>
      ${z ? cell(esc(short(z.z)), 'top zone') : ''}
      ${ranked.length ? cell(esc(ranked[0].name), 'top branch') : ''}
      ${countBased(key) ? '' : cell(String(low), 'below ' + settings.attention + '%', low ? 'negative' : 'positive')}</button>`;
  }
  function heroSlider() {
    const order = [focus, ...info.map(i => i[0]).filter(k => k !== focus)];
    const slides = order.map(slideFor).filter(Boolean);
    if (!slides.length) return '';
    const role = Auth.islandWide() ? 'island' : Auth.role?.scope || 'island';
    return `<div class="m-slider role-${role}" data-n="${slides.length}"><div class="m-sl-track" id="mSlTrack">${slides.join('')}</div>
      <div class="m-sl-dots">${slides.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div></div>`;
  }
  // Swipe left / right on the overview panes to switch tabs.
  function wireOv() {
    const tr = document.getElementById('mOvTrack'); if (!tr) return;
    let x0 = null, y0 = 0;
    tr.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    tr.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const btns = [...document.querySelectorAll('#mOvTabs button')], i = btns.findIndex(b => b.classList.contains('on')) + (dx < 0 ? 1 : -1);
      if (btns[i]) btns[i].click();
    }, { passive: true });
  }
  // Auto-advance every 4.5 s; touching the slider pauses it for 8 s.
  let slPause = 0;
  function wireSlider() {
    const tr = $('mSlTrack'); if (!tr || tr.dataset.wired) return;
    tr.dataset.wired = 1;
    const dots = tr.parentElement.querySelectorAll('.m-sl-dots i');
    tr.addEventListener('scroll', () => { const i = Math.round(tr.scrollLeft / tr.clientWidth); dots.forEach((d, j) => d.classList.toggle('on', j === i)); }, { passive: true });
    tr.addEventListener('touchstart', () => { slPause = Date.now() + 8000; }, { passive: true });
  }
  setInterval(() => {
    const tr = document.getElementById('mSlTrack');
    if (!tr || Date.now() < slPause || state.sheet || document.hidden || !tr.clientWidth) return;
    const n = tr.children.length, i = Math.round(tr.scrollLeft / tr.clientWidth);
    tr.scrollTo({ left: ((i + 1) % n) * tr.clientWidth, behavior: 'smooth' });
  }, 4500);

  /* Category chips shared by Zones / Branches */
  const catChips = () => `<div class="m-catbar">${info.map(([k, t, c]) => `<button class="${k === focus ? 'on' : ''}" style="--accent:${c}" onclick="M.focus('${k}')" title="${t}">${icon(k)}<span>${t}</span></button>`).join('')}</div>`;

  /* Zones: zone status cards, expandable to branches */
  function zonesView() {
    const L = colLabels[focus], rows = branchRows(focus, !Auth.islandWide()), all = reTotal(rows); // scoped users compare against everyone
    if (!rows.length) return `<div class="m-sticky">${catChips()}</div>` + empty(unsupported(focus) ? `${catInfo(focus)[1]} figures are not yet in the data feed.` : 'No records for the selected period and scope.');
    const zones = ZONES.map(z => { const br = rows.filter(r => r.zone === z); return { z, br, ...reTotal(br) }; }).filter(x => x.br.length).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
    const cards = zones.map((x, i) => {
      const d = x.rate !== null && all.rate !== null ? x.rate - all.rate : null, color = zoneColor(x.z);
      const regs = REG.filter(r => x.br.some(b => b.regionId === r.id)).map(r => { const rb = x.br.filter(b => b.regionId === r.id); return { r, rb, ...reTotal(rb) }; }).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
      const brs = regs.map(g => `<button class="m-brow ${!Auth.islandWide() && g.rb.some(b => Auth.inMyScope(b.id)) ? 'mine' : ''}" onclick="M.region('${esc(x.z)}','${g.r.id}')"><span><b>${esc(g.r.name)}</b><small>${esc(regionEngineers(g.r))} · ${g.rb.length} branch${g.rb.length === 1 ? '' : 'es'} · ${f(g.total)} ${L[0].toLowerCase()}</small></span><span class="pill ${tone(g.rate)}">${g.rate === null ? '—' : g.rate.toFixed(1)}</span></button>`).join('');
      return stagger(`<div class="m-card m-zone ${open.has(x.z) ? 'open' : ''}" data-zone="${esc(x.z)}">
        <button class="m-zone-head" onclick="M.toggle(this)" aria-expanded="${open.has(x.z)}">${ring(x.rate, color, 52)}
          <span class="m-zone-text"><b>${esc(x.z)}</b><small>${esc(zoneSE(x.z))} · ${regs.length} region${regs.length === 1 ? '' : 's'} · ${x.br.length} branch${x.br.length === 1 ? '' : 'es'}</small><small>${f(x.done)} / ${f(x.total)} ${L[1].toLowerCase()}</small>
          ${d === null ? '' : `<em class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)} pp vs average</em>`}</span>
          <span class="m-zone-rate ${tone(x.rate)}">${percentage(x.rate)}</span><span class="m-caret">${I.down}</span></button>
        <div class="m-collapse"><div>${brs}</div></div></div>`, i);
    }).join('');
    return `<div class="m-sticky">${catChips()}</div><div class="m-section"><h3>Zone status</h3><small>${esc(Auth.islandWide() ? scopeLabel() : getZone() === 'all' ? 'All Island' : getZone())} · ${percentage(all.rate)}</small></div>${cards}`;
  }

  /* Branches: top / bottom rankings */
  function branchesView() {
    const L = colLabels[focus];
    const ranked = rankList(focus, branchRows(focus, true)), rc = rankCfg(focus), mx = Math.max(...ranked.map(r => rc.score(r) || 0), 1);
    if (!ranked.length) return `<div class="m-sticky">${catChips()}</div>` + empty('Not enough volume to rank branches.');
    const top = ranked.slice(0, 10), bottom = ranked.slice(Math.min(10, Math.floor(ranked.length / 2))).slice(-10).reverse();
    const list = (state.rankTab === 'top' ? top : bottom).map((r, i) => stagger(`<button class="m-card m-rank ${state.rankTab === 'top' ? '' : 'low'} ${Auth.canOpenBranch(r.id) ? '' : 'locked'} ${!Auth.islandWide() && Auth.inMyScope(r.id) ? 'mine' : ''}" onclick="M.branch('${esc(r.zone)}','${r.id}')"><span class="m-rank-num">${ranked.indexOf(r) + 1}</span>
      <span class="m-rank-text"><b>${esc(r.name)}</b><small>${esc(r.region || '')}${rc.minVol ? ` · ${f(r.total)} ${L[0].toLowerCase()}` : ''}</small>${progress(rc.minVol ? r.rate : 100 * (rc.score(r) || 0) / mx)}</span><strong>${rc.fmt(r)}</strong></button>`, i)).join('');
    return `<div class="m-sticky">${catChips()}<div class="m-seg m-seg-wide"><button class="${state.rankTab === 'top' ? 'on' : ''}" onclick="M.rank('top')">▲ ${rc.top}</button><button class="${state.rankTab === 'low' ? 'on' : ''}" onclick="M.rank('low')">▼ ${rc.low}</button></div></div>${standingCard(focus)}${list}`;
  }

  /* Category overview (level 0): everything one or two taps away.
     Hero figures → own unit (by role) → zone ▸ region ▸ branch tree inline, or top / bottom rankings. */
  function overview(key) {
    const L = colLabels[key], rows = branchRows(key, true), [, , accent] = catInfo(key);
    let all = agg(rows);
    const kpis = metrics().map(([l, v], i) => stagger(`<div class="m-kpi"><small>${l}</small><b>${v}</b></div>`, i)).join('');
    if (!rows.length) {
      const msg = key === 'ratio' && ratioIsland() ? 'Claim ratio is reported at All Island level only. Branch and region ratios are not in the data feed yet.' : unsupported(key) ? `${catInfo(key)[1]} figures are not yet in the data feed.` : key === 'video' && videoSourceActive() ? `Reported at All Island level only: ${headline('video').secondary}.` : 'No records for the selected period and scope.';
      return `<div class="m-kpis">${kpis}</div>${empty(msg)}`;
    }
    const hh = headline(key), u = Auth.user, scope = Auth.islandWide() ? 'island' : Auth.role?.scope;
    const own = scope === 'island' ? rows : rows.filter(r => Auth.inMyScope(r.id));
    if (own.length) all = agg(own);
    const st = standing(key), lbl = countBased(key) ? { sa: 'Pending SA jobs', consistency: 'Pending cases', cil: 'Offer amount' }[key] : key === 'bee' || key === 'video' ? 'Offer rate' : 'Completion rate';
    const dIs = st ? st.rate - st.islandRate : null;
    const hero = `<div class="m-card m-ovhero2" style="--accent:${accent}">
      <div class="m-h2-top"><span class="m-ovring">${ring(all.rate, accent, 50)}<b>${pctShort(all.rate)}</b></span>
        <span class="m-h2-main"><small>${lbl}</small><b>${hh.value}</b></span>
        ${st ? `<button class="m-h2-ranks" onclick="M.mine()" aria-label="Open my breakdown"><span><b>#${st.rank}<i>/${st.of}</i></b><small>Island</small></span>${st.inner ? `<span><b>#${st.inner.rank}<i>/${st.inner.of}</i></b><small>${esc(short(st.inner.label))}</small></span>` : ''}</button>` : ''}</div>
      <div class="m-h2-stats">${countBased(key) ? metrics().slice(1).map(([l, v]) => `<span><b>${esc(v)}</b><small>${esc(l)}</small></span>`).join('') : `<span><b>${kf(all.total)}</b><small>${esc(L[0])}</small></span><span><b>${kf(all.done)}</b><small>${esc(L[1])}</small></span><span><b>${kf(all.pending)}</b><small>${esc(L[2])}</small></span>`}${dIs === null ? '' : `<span class="${dIs >= 0 ? 'up' : 'down'}"><b>${dIs >= 0 ? '▲' : '▼'}${Math.abs(dIs).toFixed(1)}</b><small>vs island</small></span>`}</div>
    </div>`;
    const bline = (r, rank) => `<button class="m-bline ${Auth.canOpenBranch(r.id) ? '' : 'locked'} ${scope !== 'island' && Auth.inMyScope(r.id) ? 'mine' : ''}" onclick="M.branch('${esc(r.zone)}','${r.id}')">
        ${rank ? `<span class="m-bl-rank">${rank}</span>` : ''}<span class="m-bl-text"><b>${esc(r.name)}${Auth.canOpenBranch(r.id) ? '' : ' <i class="lock">🔒</i>'}</b><small>${esc(r.region || r.id)}${key === 'sa' ? '' : ` · ${f(r.total)} ${esc(L[0].toLowerCase())}`}${key === 'cil' ? ` · saving ${money(r.saving || 0)}` : ''}</small>
        ${countBased(key) ? '' : `<span class="m-tbar"><i class="${tone(r.rate)}" style="width:${Math.max(0, Math.min(100, r.rate || 0))}%"></i></span>`}</span><span class="m-bl-val ${countBased(key) ? '' : tone(r.rate)}">${valOf(key, r)}</span></button>`;
    // Own unit, by role
    let mine = '';
    if (scope === 'branch' && u?.branchId) {
      const r = rows.find(x => x.id === u.branchId), team = TOS.filter(t => t.branchId === u.branchId);
      mine = `<div class="m-section"><h3>Your branch</h3><small>Tap for full breakdown</small></div>${r ? bline(r) : empty('No records for your branch this period.')}
        ${team.length ? `<div class="m-card m-team">${team.map(t => `<div class="m-team-row"><span class="m-team-av">${esc(t.name.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(-2).map(s => s[0]).join(''))}</span><span><b>${esc(t.name)}</b><small>${t.toCode ? 'TO ' + esc(t.toCode) + ' · ' : ''}EPF ${esc(t.epf)}</small></span>${t.mobile ? `<a href="tel:${esc(t.mobile)}" aria-label="Call">${I.phone}</a>` : ''}</div>`).join('')}</div>` : ''}`;
    } else if (scope === 'region' && u?.regionIds?.length) {
      const my = rows.filter(r => u.regionIds.includes(r.regionId)).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
      mine = `<div class="m-section"><h3>Your branches</h3><small>${my.length} · ${pctShort(agg(my).rate)} overall</small></div>${my.map(r => bline(r)).join('') || empty('No records for your region this period.')}`;
    }
    // Tabs: own unit (scoped roles) · by zone · top 10 · bottom 10 — all rendered, slid with a transform.
    const tabs = [];
    if (mine) tabs.push(['mine', scope === 'branch' ? 'My branch' : 'My branches', mine.replace(/^\s*<div class="m-section">.*?<\/div>/s, '')]);
    const ranked = rankList(key, rows);
    const rlist = list => list.map(r => `<div class="m-card m-rankwrap">${bline(r, ranked.indexOf(r) + 1)}</div>`).join('') || empty('Not enough volume to rank branches.');
    let ex;
    {
      const rateTag = o => `<span class="m-acc-val ${countBased(key) ? '' : tone(o.rate)}">${valOf(key, o)}</span>`;
      ex = ZONES.map(z => ({ z, br: rows.filter(r => r.zone === z) })).filter(x => x.br.length).map(x => ({ ...x, ...agg(x.br) })).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1)).map((x, i) => {
        const regs = REG.filter(r => x.br.some(b => b.regionId === r.id)).map(r => { const rb = x.br.filter(b => b.regionId === r.id); return { r, rb, ...agg(rb) }; }).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
        const inner = regs.map(g => `<div class="m-acc m-acc2 ${open.has('r:' + g.r.id) ? 'open' : ''}" data-k="r:${g.r.id}"><button class="m-acc-head" onclick="M.tg(this)"><span class="m-acc-text"><b>${esc(g.r.name)}</b><small>${esc(regionEngineers(g.r))} · ${g.rb.length} br.</small></span>${rateTag(g)}<span class="m-caret">${I.down}</span></button>
          <div class="m-collapse"><div>${g.rb.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1)).map(r => bline(r)).join('')}</div></div></div>`).join('');
        return stagger(`<div class="m-card m-acc ${open.has('z:' + x.z) ? 'open' : ''}" data-k="z:${esc(x.z)}"><button class="m-acc-head" onclick="M.tg(this)">${ring(x.rate, zoneColor(x.z), 40)}<span class="m-acc-text"><b>${esc(x.z)}</b><small>${esc(zoneSE(x.z))} · ${regs.length} reg. · ${x.br.length} br.</small></span>${rateTag(x)}<span class="m-caret">${I.down}</span></button>
          <div class="m-collapse"><div>${inner}</div></div></div>`, i);
      }).join('');
    }
    tabs.push(['zone', 'Zones', ex], ['top', key === 'sa' ? '▲ Fewest' : key === 'cil' ? '▲ Top saving' : '▲ Top 10', rlist(ranked.slice(0, 10))], ['low', key === 'sa' ? '▼ Most pending' : key === 'cil' ? '▼ Lowest' : '▼ Bottom 10', rlist(ranked.slice(-10).reverse())]);
    let idx = tabs.findIndex(t => t[0] === state.ovTab); if (idx < 0) idx = 0;
    const seg = `<div class="m-ovtabs" id="mOvTabs" style="--n:${tabs.length};--i:${idx}"><i class="m-ovind"></i>${tabs.map(([k, l], i) => `<button class="${i === idx ? 'on' : ''}" onclick="M.ov('${k}',${i})">${l}</button>`).join('')}</div>`;
    const panels = `<div class="m-ovpanes"><div class="m-ovtrack" id="mOvTrack" style="--i:${idx}">${tabs.map(t => `<div class="m-ovpane">${t[2]}</div>`).join('')}</div></div>`;
    return `<div class="m-ovtop">${hero}${seg}</div>${panels}`;
  }

  /* Detail: KPIs + Zone → Branch → Engineer → TO */
  function detailView() {
    const isA = current === 'alerts', [, title, accent] = isA ? ['alerts', 'Critical Alerts', '#ee4a5e'] : catInfo(current);
    const levels = ['Zones', 'Regions', 'Branches', 'Technical officers', 'Officer profile'];
    const names = path.map((p, i) => i === 1 ? regionById(p)?.name : i === 2 ? branchById(p)?.name : i === 3 ? toById(p)?.name : p);
    const kpis = metrics().map(([l, v], i) => stagger(`<div class="m-kpi"><small>${l}</small><b>${v}</b></div>`, i)).join('');
    let body;
    if (level === 0 && !isA) return `<div class="m-appbar" style="--accent:${accent}"><button class="m-back" onclick="history.back()" aria-label="Back">${I.back}</button><div><h2>${title}</h2><small>${esc(periodLabel() + ' · ' + scopeLabel())}</small></div></div>${overview(current)}`;
    if (level === 4) {
      const o = toById(path[3]), br = branchById(o?.branchId);
      const facts = [['TO code', o?.toCode || '—'], ['EPF no.', o?.epf || '—'], ['Branch', br ? `${br.name} (${br.id})` : ''], ['Region', br?.region], ['Zone', o?.zone], ['Regional engineer', regionEngineers(regionById(br?.regionId))], ['Senior engineer', zoneSE(o?.zone)]];
      body = `<div class="m-card m-officer"><div class="m-avatar" style="--accent:${accent}">${esc((o?.name || '?').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(-2).map(s => s[0]).join(''))}</div><h3>${esc(o?.name || 'Officer')}</h3>
        ${o?.mobile ? `<a class="m-call" href="tel:${esc(o.mobile)}">${I.phone} Call ${esc(o.mobile)}</a>` : ''}
        <dl>${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl></div>
        ${empty('Officer-level figures are not yet in the data feed. Branch totals are one level up.')}`;
    } else {
      const nodes = nodeItems();
      body = nodes.length ? nodes.map((n, i) => { const s = nodeStat(n); return stagger(`<button class="m-card m-node ${n.locked ? 'locked' : ''}" onclick="M.drill('${esc(n.id)}')">${level === 0 ? `<i class="m-node-dot" style="background:${zoneColor(n.id)}"></i>` : ''}<span class="m-node-text"><b>${esc(n.label)}${n.locked ? ' <i class="lock">🔒</i>' : ''}</b><small>${esc(n.sub)}</small>${s.percent !== null && s.percent !== undefined ? progress(s.percent) : ''}</span><span class="m-node-val"><b>${s.value}</b><small>${esc(s.secondary)}</small></span><span class="m-chev">${I.chev}</span></button>`, i); }).join('') : empty('Nothing at this level for the selected filters.');
      if (isA && level === 0) {
        const a = recordsFor('alerts').sort((x, y) => y.ageHours - x.ageHours).slice(0, 30);
        body += `<div class="m-section"><h3>Exception register</h3><small>Oldest first</small></div>` + a.map(r => `<div class="m-card m-exc"><span class="m-sev ${r.severity === 'Critical' ? 'crit' : ''}">${esc(r.severity)}</span><span><b>${esc(r.id)}</b><small>${esc(branchById(r.branchId)?.name || r.zone)} · ${r.ageHours}h</small></span><em>${esc(r.status)}</em></div>`).join('');
      }
    }
    return `<div class="m-appbar" style="--accent:${accent}"><button class="m-back" onclick="history.back()" aria-label="Back">${I.back}</button><div><h2>${title}</h2><small>${level === 0 ? esc(periodLabel() + ' · ' + scopeLabel()) : esc(names.join(' › '))}</small></div></div>
      ${level === 0 ? `<div class="m-kpis">${kpis}</div>${isA ? '' : standingCard(current)}` : ''}
      <div class="m-section"><h3>${levels[level]}</h3>${level < 4 ? '<small>Tap to drill down</small>' : ''}</div>${body}`;
  }

  /* ---------- Search sheet ---------- */
  function renderSheet() {
    $('mZoneChips').innerHTML = ['all', ...ZONES].map(z => `<button class="${getZone() === z ? 'on' : ''}" onclick="M.zone('${esc(z)}')">${z === 'all' ? 'All Island' : esc(z)}</button>`).join('');
    $('mPick').innerHTML = pick ? `<div class="m-picked"><span class="sr-type ${pick.type}">${pick.type === 'to' ? 'TO' : pick.type === 'engineer' ? 'ENG' : 'BR'}</span><b>${esc(pickLabel())}</b><button onclick="M.unpick()" aria-label="Remove">${I.close}</button></div>` : '';
    const t = state.stype;
    document.querySelectorAll('#mSType button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    $('mSearch').placeholder = { branch: 'Search branch or region…', engineer: 'Search engineer or region…', to: 'Search TO name, code, EPF or mobile…' }[t];
    const q = $('mSearch').value.trim();
    const res = q ? typedSearch(q, t) : [];
    const badge = { to: 'TO', engineer: 'ENG', branch: 'BR' }[t];
    $('mResults').innerHTML = !q ? '' : res.length
      ? res.map((r, i) => `<button class="m-res" onclick="M.choose(${i})"><span class="sr-type ${r.type}">${badge}</span><span><b>${esc(r.label)}</b><small>${esc(r.meta)}</small></span></button>`).join('')
      : `<div class="sr-empty">No ${groupName[t].toLowerCase()} match “${esc(q)}”.</div>`;
    state.results = res;
  }
  // Search one entity type within the selected zone (live, while typing).
  function typedSearch(q, type) {
    q = q.toLowerCase();
    const z = getZone(), inZone = zone => z === 'all' || zone === z;
    const hit = (...s) => s.some(x => String(x || '').toLowerCase().includes(q));
    if (type === 'branch') return B.filter(b => inZone(b.zone) && hit(b.name, b.region)).slice(0, 25)
      .map(b => ({ type, id: b.id, label: b.name, meta: `${b.zone} · ${engById(b.engineerId)?.name || ''} · ${(n => n + (n === 1 ? ' TO' : ' TOs'))(TOS.filter(t => t.branchId === b.id).length)}` }));
    if (type === 'engineer') return ENG.filter(e => B.some(b => b.engineerId === e.id && inZone(b.zone)) && hit(e.name, ...(e.regions || []))).slice(0, 25)
      .map(e => ({ type, id: e.id, label: e.name, meta: `${(e.regions || []).join(', ')} · ${e.branchIds?.length || 0} branches` }));
    return TOS.filter(t => inZone(t.zone) && Auth.canOpenBranch(t.branchId) && hit(t.name, t.toCode, t.epf, t.mobile)).slice(0, 25)
      .map(t => ({ type, id: t.id, label: t.name, meta: `${t.toCode ? 'TO ' + t.toCode + ' · ' : ''}EPF ${t.epf} · ${branchById(t.branchId)?.name || ''}` }));
  }
  function closeSheet() {
    state.sheet = false;
    document.getElementById('m-app').classList.remove('sheet-open');
    $('mSearch').blur();
  }

  /* ---------- Public actions ---------- */
  window.M = {
    tab(t) {
      tap();
      if (t === 'alerts') { state.tab = 'alerts'; state.view = 'detail'; push(); openAlerts(); return; }
      if (state.view === 'detail') { current = null; level = 0; path = []; }
      state.tab = t; state.view = t; home();
    },
    cat(k) {
      tap(); focus = k; state.view = 'detail'; state.ovTab = null;
      // Pre-open the signed-in user's own zone / region in the explorer.
      open.clear();
      const u = Auth.user, sc = Auth.islandWide() ? '' : Auth.role?.scope;
      const zn = id => ORG.zones.find(z => z.id === id)?.name;
      if (sc === 'zone' && u.zoneId) open.add('z:' + zn(u.zoneId));
      if (sc === 'region') (u.regionIds || []).forEach(r => { open.add('r:' + r); open.add('z:' + zn(regionById(r)?.zoneId)); });
      if (sc === 'branch' && u.branchId) { const b = branchById(u.branchId); open.add('r:' + b?.regionId); open.add('z:' + b?.zone); }
      push(); openCategory(k);
    },
    ov(t, i) {
      tap(); state.ovTab = t;
      const tb = $('mOvTabs'), tr = $('mOvTrack'); if (!tb || !tr) return;
      tb.style.setProperty('--i', i); tr.style.setProperty('--i', i);
      tb.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === i));
      tr.children[i].scrollTop = 0;
    },
    tg(btn) { tap(); const a = btn.closest('.m-acc'), k = a.dataset.k; a.classList.toggle('open'); open.has(k) ? open.delete(k) : open.add(k); },
    focus(k) { tap(); focus = k; open.clear(); render(); },
    // History: one entry per drill level so Back walks up Zone › Region › Branch › TO.
    branch(z, b) { tap(); if (!Auth.canOpenBranch(b)) return Auth.deny(); state.view = 'detail'; push(); push(); push(); push(); openBranch(focus, z, b); },
    region(z, r) { tap(); state.view = 'detail'; push(); push(); push(); openRegion(focus, z, r); },
    drill(id) { tap(); if (level === 2 && !Auth.canOpenBranch(id)) return Auth.deny(); push(); drill(id); },
    // Open the signed-in user's own branch / region / zone for the focused category.
    mine() {
      const u = Auth.user, kind = Auth.role?.scope; if (!u) return;
      if (kind === 'branch' && u.branchId) { const b = branchById(u.branchId); return M.branch(b.zone, b.id); }
      if (kind === 'region' && u.regionIds?.length) { const r = regionById(u.regionIds[0]); return M.region(ORG.zones.find(z => z.id === r.zoneId)?.name, r.id); }
      M.cat(focus);
    },
    profile() {
      M.menu();
      const u = Auth.user, t = u && toById(u.id);
      if (t) { tap(); current = focus; path = [t.zone, t.regionId, t.branchId, t.id]; level = 4; state.view = 'detail'; push(); push(); push(); push(); push(); refresh(); return; }
      Auth.toast(`${u?.name || ''} · ${u?.title || Auth.roleLabel()}${u?.epf ? ' · EPF ' + u.epf : ''}`);
    },
    toggle(btn) { tap(); const card = btn.closest('.m-zone'), z = card.dataset.zone; card.classList.toggle('open'); btn.setAttribute('aria-expanded', card.classList.contains('open')); open.has(z) ? open.delete(z) : open.add(z); },
    rank(t) { tap(); state.rankTab = t; render(); },
    mode(m) { tap(); setMode(m); },
    menu(e) {
      e?.stopPropagation();
      const show = !!e && !$('mMenu').classList.contains('open');
      $('mMenu').classList.toggle('open', show);
      $('mAvatarBtn').setAttribute('aria-expanded', show);
      if (e) tap();
    },
    sheet(show) {
      tap();
      if (!show) { if (state.sheet) history.back(); return; }
      state.sheet = true; push();
      document.getElementById('m-app').classList.add('sheet-open');
      $('mSearch').value = ''; renderSheet();
      setTimeout(() => $('mSearch').focus({ preventScroll: true }), 320);
    },
    search() { renderSheet(); },
    stype(t) { tap(); state.stype = t; renderSheet(); $('mSearch').focus({ preventScroll: true }); },
    // Search button / Enter: open the best match; with nothing typed just apply the zone and close.
    go() {
      if (!$('mSearch').value.trim()) { tap(); M.sheet(false); return; }
      if (state.results?.length) M.choose(0);
    },
    zone(z) { tap(); $('zoneFilter').value = z; zoneChanged(); renderSheet(); },
    unpick() { tap(); clearPick(); renderSheet(); },
    clearAll() { tap(); resetFilters(); $('mSearch').value = ''; renderSheet(); },
    choose(i) {
      tap();
      const r = state.results[i]; if (!r) return;
      pick = { type: r.type, id: r.id }; renderPick();
      level = 0; path = []; open.clear();
      if (r.type === 'branch') {
        // Branch → category detail at that branch (sheet's history entry + 3 drill levels).
        const b = branchById(r.id);
        if (!Auth.canOpenBranch(b.id)) { history.back(); refresh(); return Auth.deny(); }
        closeSheet(); state.view = 'detail'; push(); push(); push();
        openBranch(focus, b.zone, b.id);
      } else if (r.type === 'engineer') {
        // Engineer → Zones tab, filtered to their branches and expanded.
        ZONES.forEach(z => open.add(z));
        state.tab = 'zones'; state.view = 'zones'; current = null;
        history.back(); refresh();
      } else if (r.type === 'to') {
        // Reuse the sheet's history entry plus one per drill level, so Back walks up the hierarchy.
        closeSheet();
        const t = toById(r.id);
        current = focus; path = [t.zone, t.regionId, t.branchId, t.id]; level = 4;
        state.view = 'detail';
        push(); push(); push(); push();
        refresh();
      } else { history.back(); refresh(); }
    },
  };

  /* Re-render the mobile shell whenever app.js renders. */
  for (const fn of ['renderHome', 'renderDetail']) {
    const orig = window[fn];
    window[fn] = function (...args) { const r = orig.apply(this, args); render(); return r; };
  }
  const origGoUp = window.goUp;
  window.goUp = function () { state.dir = 'back'; return origGoUp(); };
  mq.addEventListener('change', () => { state.key = ''; if (mq.matches && D) render(); });
})();
