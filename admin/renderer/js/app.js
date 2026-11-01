import { h, $, api, get, clear, icon, toast, fail, modal, field, setUnauthorizedHandler, busy, debounce } from './lib.js';
import { state, can } from './state.js';

import dashboard from './views/dashboard.js';
import users from './views/users.js';
import content from './views/content.js';
import events from './views/events.js';
import inbox from './views/inbox.js';
import control from './views/control.js';
import logs from './views/logs.js';
import team from './views/team.js';
import settings from './views/settings.js';
import system from './views/system.js';
import release from './views/release.js';
import { openUserDrawer } from './views/users.js';

const VIEWS = {
  dashboard: { label: 'Dashboard', icon: 'dashboard', key: 1, group: 'Overview', make: dashboard },
  users: { label: 'Users', icon: 'users', key: 2, group: 'Moderation', make: users, perm: 'users.view' },
  content: { label: 'Content', icon: 'content', key: 3, group: 'Moderation', make: content, perm: 'content.view' },
  inbox: { label: 'Inbox', icon: 'inbox', key: 5, group: 'Moderation', make: inbox, perm: 'reports' },
  control: { label: 'Control', icon: 'control', key: 6, group: 'Moderation', make: control, perm: 'control.own' },
  events: { label: 'Events', icon: 'events', key: 4, group: 'Broadcast', make: events, perm: 'announce' },
  logs: { label: 'Audit log', icon: 'logs', key: 7, group: 'Administration', make: logs, perm: 'logs' },
  team: { label: 'Team', icon: 'team', key: 8, group: 'Administration', make: team, perm: 'team' },
  settings: { label: 'Settings', icon: 'settings', key: 9, group: 'Administration', make: settings, perm: 'team' },
  system: { label: 'System', icon: 'system', key: 0, group: 'Administration', make: system, perm: 'system' },
  release: { label: 'App version', icon: 'download', key: '', group: 'Administration', make: release, perm: 'release' },
};

const appEl = $('#app');
const statusEl = $('#status');
let current = null;
let view = null;
let lastInput = Date.now();
let timers = [];
let cfg = {};

// ---------------------------------------------------------------------------
// status bar
// ---------------------------------------------------------------------------
function drawStatus() {
  clear(statusEl);
  if (!state.admin) { statusEl.append(h('span', 'Not signed in'), h('span', { class: 'sp' }), h('span', `v${cfg.version ?? ''}`)); return; }
  statusEl.append(
    h('span', h('span', { class: 'dot' }), 'Connected'), h('span', state.server),
    h('span', { class: 'sp' }),
    h('span', `Idle sign-out after ${state.meta.sessionIdleMinutes} min`),
    h('span', `${state.admin.name} · ${state.admin.role}`), h('span', `v${cfg.version ?? ''}`));
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------
function showLogin(message, bad = false) {
  timers.forEach(clearInterval); timers = [];
  view?.destroy?.(); view = null; current = null;
  state.admin = null; state.meta = null;
  document.querySelectorAll('.drawer, .scrim, .modal-wrap').forEach((e) => e.remove());
  drawStatus();

  const server = h('input', { class: 'input', value: cfg.serverUrl ?? '', placeholder: 'https://your-server.onrender.com', spellcheck: false });
  const email = h('input', { class: 'input', type: 'email', value: cfg.email ?? '', placeholder: 'you@company.com', autocomplete: 'username' });
  const pw = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Password' });
  const msg = h('div', { class: 'msg' + (bad ? ' bad' : '') }, message ?? '');
  const go = h('button', { class: 'btn primary block', type: 'submit' }, 'Sign in');
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    msg.className = 'msg'; msg.textContent = 'Signing in…';
    const r = await busy(go, () => window.hh.login({ server: server.value, email: email.value, password: pw.value }));
    pw.value = '';
    if (!r.ok) { msg.className = 'msg bad'; msg.textContent = r.error; pw.focus(); return; }
    state.admin = r.data.admin; state.server = r.data.server;
    try { state.meta = await get('/meta'); } catch (err) { msg.className = 'msg bad'; msg.textContent = err.message; return; }
    cfg.serverUrl = state.server; cfg.email = email.value;
    boot();
  } },
    h('h1', 'Sign in'), h('p', { class: 'lead' }, 'HelpHive administration console'),
    h('label', { class: 'f' }, h('span', 'Email'), email),
    h('label', { class: 'f' }, h('span', 'Password'), pw),
    h('details', { class: 'conn', open: !cfg.serverUrl }, h('summary', 'Server'), h('label', { class: 'f' }, h('span', 'Server address'), server)),
    go, msg,
    h('div', { class: 'hint' }, 'Activity in this console is recorded in the audit log.'));

  clear(appEl).append(h('div', { id: 'login' }, h('div', { class: 'hero' }, h('img', { src: 'assets/wasp-full.png', alt: '' }), h('div', { class: 'tag' }, 'Restricted access · authorised staff only')), form));
  (cfg.email ? pw : email).focus();
}

// ---------------------------------------------------------------------------
// shell
// ---------------------------------------------------------------------------
function allowed(id) { const v = VIEWS[id]; return v && (!v.perm || can(v.perm)); }

function boot() {
  drawStatus();
  const nav = h('nav', { id: 'nav' }, h('div', { class: 'brand' }, h('img', { src: 'assets/wasp-mark-128.png', alt: '' }), h('div', h('div', { class: 'n' }, 'HelpHive'), h('div', { class: 's' }, 'Admin console'))));
  let group = '';
  for (const [id, v] of Object.entries(VIEWS)) {
    if (!allowed(id)) continue;
    if (v.group !== group) { group = v.group; nav.append(h('div', { class: 'group' }, group)); }
    nav.append(h('a', { dataset: { id }, onClick: () => go(id) }, icon(v.icon), v.label, id === 'inbox' ? h('span', { class: 'ct hidden', id: 'inbox-ct' }) : v.key !== '' ? h('span', { class: 'k' }, `^${v.key}`) : null));
  }
  nav.append(h('div', { class: 'me' }, h('div', { class: 'nm' }, state.admin.name), h('div', { class: 'rl' }, state.admin.role),
    h('div', { class: 'ac' }, h('button', { class: 'btn sm', title: 'Change my password', onClick: () => changePassword() }, icon('key')), h('button', { class: 'btn sm', title: 'Lock and sign out (Ctrl+L)', onClick: () => lock() }, icon('lock'), 'Lock'), h('button', { class: 'btn sm', title: 'Sign out', onClick: () => lock('You signed out.') }, icon('out')))));
  const scrim = h('div', { id: 'navscrim', onClick: () => setNav(false) });
  const mTitle = h('div', { class: 't' }, 'Dashboard');
  const mbar = h('div', { id: 'mbar' }, h('button', { class: 'btn ghost', title: 'Menu', onClick: () => setNav(true) }, icon('menu')), h('img', { src: 'assets/wasp-mark-64.png', alt: '' }), mTitle, h('button', { class: 'btn ghost', title: 'Refresh', onClick: () => view?.refresh?.() }, icon('refresh')));
  const tabbar = h('div', { id: 'tabbar' },
    ['dashboard', 'users', 'inbox', 'control'].filter(allowed).map((id) => h('button', { dataset: { id }, onClick: () => go(id) }, icon(VIEWS[id].icon), VIEWS[id].label, id === 'inbox' ? h('span', { class: 'ct hidden', id: 'inbox-ct2' }) : null)),
    h('button', { onClick: () => setNav(true) }, icon('menu'), 'More'));
  clear(appEl).append(nav, scrim, mbar, h('main', { id: 'main' }), tabbar);
  state.mTitle = mTitle;

  state.nav = go;
  state.openUser = (id) => openUserDrawer(id);
  state.badge = refreshBadge;
  go(allowed('dashboard') ? 'dashboard' : 'users');

  timers.push(setInterval(refreshBadge, 60_000));
  timers.push(setInterval(() => {
    const limit = Math.max(2, state.meta.sessionIdleMinutes - 1) * 60_000;
    if (Date.now() - lastInput > limit) lock('You were signed out after being idle.');
  }, 15_000));
  refreshBadge();
  if (state.admin.mustChangePassword) changePassword(true);
}

function setNav(open) {
  $('#nav')?.classList.toggle('open', open);
  $('#navscrim')?.classList.toggle('open', open);
}

function go(id, params) {
  if (!allowed(id)) return;
  view?.destroy?.();
  current = id;
  setNav(false);
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.id === id));
  document.querySelectorAll('#tabbar button[data-id]').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
  if (state.mTitle) state.mTitle.textContent = VIEWS[id].label;
  const main = clear($('#main'));
  view = VIEWS[id].make(main, params) ?? null;
}

async function refreshBadge() {
  if (!state.admin) return;
  try {
    let n = 0;
    if (can('reports')) n += (await get('/reports', { status: 'open' })).total;
    if (can('appeals')) n += (await get('/appeals', { status: 'pending' })).appeals.length;
    for (const el of [$('#inbox-ct'), $('#inbox-ct2')]) {
      if (el) { el.textContent = n > 99 ? '99+' : n; el.classList.toggle('hidden', !n); }
    }
  } catch { /* quiet */ }
}

async function lock(message = 'Locked. Sign in to continue.') {
  await window.hh.logout();
  showLogin(message);
}
setUnauthorizedHandler((m) => { if (state.admin) showLogin(m || 'Your session ended. Please sign in again.', true); });

function changePassword(forced) {
  const cur = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', autofocus: true });
  const nw = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const again = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  modal({
    title: forced ? 'Choose your own password' : 'Change my password',
    sub: forced ? 'This account uses a temporary password. Set a new one to continue.' : 'Other sessions of your account are signed out.',
    body: [field('Current password', cur), field('New password (at least 10 characters)', nw), field('Repeat new password', again)],
    actions: [forced ? { label: 'Sign out', value: false } : { label: 'Cancel', value: false }, { label: 'Change password', kind: 'primary', onClick: async (close) => {
      if (nw.value !== again.value) return toast('The two new passwords differ.', true);
      try { await api('POST', '/auth/password', { current: cur.value, next: nw.value }); state.admin.mustChangePassword = false; close(true); toast('Password changed.'); } catch (e) { fail(e); }
    } }],
    onClose: (v) => { if (forced && !v) lock('You signed out.'); },
  });
}

// ---------------------------------------------------------------------------
// command palette
// ---------------------------------------------------------------------------
function palette(initial = '') {
  if (!state.admin || document.querySelector('.cmd')) return;
  const input = h('input', { placeholder: 'Go to… or type a username to find someone', value: initial, spellcheck: false });
  const list = h('div', { class: 'list' });
  const wrap = h('div', { class: 'modal-wrap', style: 'align-items:start' }, h('div', { class: 'cmd' }, input, list));
  let items = [], sel = 0;
  const close = () => wrap.remove();
  const run = () => { const it = items[sel]; if (!it) return; close(); it.run(); };
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    items = [
      ...Object.entries(VIEWS).filter(([id, v]) => allowed(id) && (!q || v.label.toLowerCase().includes(q))).map(([id, v]) => ({ label: `Go to ${v.label}`, key: `Ctrl+${v.key}`, run: () => go(id) })),
      ...(q && can('users.view') ? [{ label: `Find user “${input.value.trim()}”`, key: 'Enter', run: () => go('users', { q: input.value.trim() }) }] : []),
      ...(!q || 'lock'.includes(q) ? [{ label: 'Lock and sign out', key: 'Ctrl+L', run: () => lock() }] : []),
      ...(!q || 'password'.includes(q) ? [{ label: 'Change my password', key: '', run: () => changePassword() }] : []),
    ];
    if (q && items.length > 1 && can('users.view')) { const f = items.findIndex((x) => x.label.startsWith('Find user')); if (f > 0 && !Object.values(VIEWS).some((v) => v.label.toLowerCase().startsWith(q))) { const [x] = items.splice(f, 1); items.unshift(x); } }
    sel = Math.min(sel, items.length - 1);
    clear(list).append(...items.map((it, i) => h('div', { class: 'it' + (i === sel ? ' on' : ''), onMouseenter: () => { sel = i; draw(); }, onClick: run }, it.label, h('span', { class: 'k' }, it.key))));
  };
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') run();
  });
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  document.body.append(wrap); draw(); input.focus();
}

// ---------------------------------------------------------------------------
// phone layout: tables turn into cards, and each cell needs its column name
// ---------------------------------------------------------------------------
function labelTables(root) {
  root.querySelectorAll?.('table.grid-t').forEach((t) => {
    const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    t.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => { if (!td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i] ?? ''); }));
  });
}
new MutationObserver((list) => {
  for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) labelTables(n.matches?.('table.grid-t') ? n.parentElement : n);
}).observe(document.body, { childList: true, subtree: true });

// ---------------------------------------------------------------------------
// wiring
// ---------------------------------------------------------------------------
['mousemove', 'keydown', 'mousedown', 'wheel'].forEach((ev) => window.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true }));
window.addEventListener('keydown', (e) => {
  if (!state.admin) return;
  if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); }
});
if (!window.hh.isElectron) document.documentElement.classList.add('web');
window.hh.on('nav', (id) => { if (state.admin) go(id); });
window.hh.on('refresh', () => { if (state.admin) view?.refresh?.(); });
window.hh.on('lock', () => { if (state.admin) lock(); });
window.hh.on('palette', () => palette());
window.hh.on('find-user', () => { if (state.admin && can('users.view')) go('users'); });

(async () => {
  cfg = await window.hh.config();
  showLogin();
})();
