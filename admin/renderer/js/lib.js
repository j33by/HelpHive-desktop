// Small toolkit: DOM builder, formatting, api wrapper, modal, drawer, toast.
// Everything user-written goes through textContent, never innerHTML.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs && (attrs.nodeType || typeof attrs === 'string' || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'readOnly') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const $ = (sel, root = document) => root.querySelector(sel);

// ---------- icons (stroke, 24 grid) ----------
const P = {
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.6 3-5.5 6.5-5.5s6 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
  content: '<rect x="4" y="3" width="16" height="18"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  events: '<rect x="3" y="5" width="18" height="16"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  control: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  logs: '<path d="M5 3h11l3 3v15H5z"/><path d="M9 10h7M9 14h7M9 18h4"/>',
  team: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  system: '<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  lock: '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  out: '<path d="M10 4H4v16h6M15 8l4 4-4 4M19 12H9"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M9 3h6l-1 6 3 3H7l3-3zM12 12v9"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  mail: '<rect x="3" y="5" width="18" height="14"/><path d="M3 6l9 7 9-7"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  note: '<path d="M5 3h14v14l-4 4H5z"/><path d="M15 21v-4h4M8 9h8M8 13h5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  copy: '<rect x="8" y="8" width="12" height="12"/><path d="M4 16V4h12"/>',
};
export function icon(name, size) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.6');
  s.setAttribute('stroke-linecap', 'square');
  s.setAttribute('stroke-linejoin', 'miter');
  if (size) { s.setAttribute('width', size); s.setAttribute('height', size); }
  s.innerHTML = P[name] ?? ''; // static, trusted markup
  return s;
}

// ---------- formatting ----------
const dtf = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const df = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
export const fdt = (t) => (t ? dtf.format(new Date(t)) : '—');
export const fd = (t) => (t ? df.format(new Date(t)) : '—');
export const num = (n) => (n == null ? '—' : Number(n).toLocaleString());
export function ago(t) {
  if (!t) return 'never';
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  if (s < 0) return 'in ' + dur(-s);
  if (s < 60) return 'just now';
  return dur(s) + ' ago';
}
export function dur(s) {
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  if (s < 86400 * 45) return `${Math.round(s / 86400)} d`;
  return `${Math.round(s / (86400 * 30))} mo`;
}
export const initials = (u) => (u?.fullName || u?.username || '?').trim().slice(0, 2);
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export const ACTION_LABEL = {
  warn: 'Warning', restrict: 'Restriction', unrestrict: 'Restriction lifted', ban: 'Ban', unban: 'Unban',
  strike: 'Strike', remove_strike: 'Strike removed', delete_post: 'Post removed', delete_comment: 'Comment removed',
  email_change: 'Email changed', password_change: 'Password changed', account_delete: 'Account deleted',
};

export function avatar(u, big) {
  const a = h('div', { class: 'avatar' + (big ? ' lg' : '') });
  if (u?.avatarUrl) {
    const img = h('img', { src: u.avatarUrl, alt: '' });
    img.addEventListener('error', () => { img.remove(); a.textContent = initials(u); });
    a.append(img);
  } else a.textContent = initials(u);
  return a;
}

export function standingBadge(s) {
  if (!s) return h('span', { class: 'badge mute' }, 'Active');
  if (s.status === 'banned') return h('span', { class: 'badge hatch' }, 'Banned');
  if (s.status === 'restricted') return h('span', { class: 'badge solid', title: s.until ? 'until ' + fdt(s.until) : '' }, 'Restricted');
  return h('span', { class: 'badge mute' }, 'Active');
}
export const strikeBadge = (n) => (n > 0 ? h('span', { class: 'badge strike' }, `${n} strike${n > 1 ? 's' : ''}`) : null);

// ---------- api ----------
export class ApiError extends Error { constructor(m, status) { super(m); this.status = status; } }
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(method, route, body) {
  const r = await window.hh.api(method, route, body);
  if (r.ok) return r.data;
  if (r.status === 401) onUnauthorized(r.error);
  throw new ApiError(r.error || 'Something went wrong.', r.status);
}
export const get = (route, params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== '' && v != null) q.set(k, v);
  const s = q.toString();
  return api('GET', route + (s ? `?${s}` : ''));
};

// ---------- toast ----------
export function toast(msg, bad) {
  const box = $('#toasts');
  const t = h('div', { class: 'toast' + (bad ? ' bad' : '') }, msg);
  box.append(t);
  setTimeout(() => t.remove(), bad ? 7000 : 3800);
}
export const fail = (e) => toast(e?.message || String(e), true);

// ---------- busy button ----------
export async function busy(btn, fn) {
  btn.disabled = true; btn.classList.add('spin');
  try { return await fn(); } finally { btn.disabled = false; btn.classList.remove('spin'); }
}

// ---------- modal ----------
let modalDepth = 0;
export function modal({ title, sub, body, actions = [], wide, onClose }) {
  const wrap = h('div', { class: 'modal-wrap' });
  const close = (v) => { wrap.remove(); modalDepth--; document.removeEventListener('keydown', esc, true); onClose?.(v); };
  const esc = (e) => { if (e.key === 'Escape' && wrap === [...document.querySelectorAll('.modal-wrap')].pop()) { e.stopPropagation(); close(); } };
  const foot = h('footer');
  const btns = actions.map((a) => {
    const b = h('button', { class: `btn ${a.kind ?? ''}`, type: 'button' }, a.label);
    b.addEventListener('click', async () => {
      if (a.onClick) { const r = await busy(b, () => a.onClick(close)); return r; }
      close(a.value);
    });
    return b;
  });
  append(foot, btns);
  const m = h('div', { class: 'modal' + (wide ? ' wide' : '') },
    h('header', h('h2', title), sub ? h('p', sub) : null),
    h('div', { class: 'body' }, body),
    actions.length ? foot : null);
  wrap.append(m);
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  document.body.append(wrap);
  modalDepth++;
  document.addEventListener('keydown', esc, true);
  setTimeout(() => (m.querySelector('[autofocus], input, textarea, select') ?? btns[btns.length - 1])?.focus(), 30);
  return { close, el: m, buttons: btns };
}

export function confirmBox({ title, body, yes = 'Confirm', danger }) {
  return new Promise((resolve) => {
    modal({
      title, body: h('div', body),
      actions: [{ label: 'Cancel', value: false }, { label: yes, kind: danger ? 'danger' : 'primary', value: true }],
      onClose: (v) => resolve(Boolean(v)),
    });
  });
}

// ---------- drawer ----------
export function drawer({ title, sub, headerExtra, body, onClose }) {
  const scrim = h('div', { class: 'scrim' });
  const scroll = h('div', { class: 'scroll' }, body);
  const closeBtn = h('button', { class: 'btn ghost sm', title: 'Close (Esc)' }, icon('close'));
  const titleBox = h('div', { class: 'grow' }, h('div', { style: 'font-weight:600;font-size:15px' }, title), sub ? h('div', { class: 'muted' }, sub) : null);
  const el = h('aside', { class: 'drawer' }, h('header', headerExtra ?? null, titleBox, closeBtn), scroll);
  const close = () => { scrim.remove(); el.remove(); document.removeEventListener('keydown', esc); onClose?.(); };
  const esc = (e) => { if (e.key === 'Escape' && !document.querySelector('.modal-wrap')) close(); };
  scrim.addEventListener('mousedown', close);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', esc);
  document.body.append(scrim, el);
  return { close, el, scroll, setTitle: (t, s) => { clear(titleBox); append(titleBox, [h('div', { style: 'font-weight:600;font-size:15px' }, t), s ? h('div', { class: 'muted' }, s) : null]); } };
}

// ---------- misc widgets ----------
export function seg(options, value, onChange) {
  const el = h('div', { class: 'seg' });
  const draw = (v) => {
    clear(el);
    for (const [val, label] of options) {
      el.append(h('button', { type: 'button', class: v === val ? 'on' : '', onClick: () => { draw(val); onChange(val); } }, label));
    }
  };
  draw(value);
  return el;
}

export function tabs(items, value, onChange) {
  const el = h('div', { class: 'tabs' });
  const draw = (v) => {
    clear(el);
    for (const it of items) {
      el.append(h('button', { class: v === it.id ? 'on' : '', onClick: () => { draw(it.id); onChange(it.id); } }, it.label, it.count ? h('span', { class: 'ct' }, it.count) : null));
    }
  };
  draw(value);
  return el;
}

export function pager({ page, total, size, onPage }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(total, page * size);
  return h('div', { class: 'pager' },
    h('span', `${num(from)}–${num(to)} of ${num(total)}`),
    h('span', { class: 'sp' }),
    h('button', { class: 'btn sm', disabled: page <= 1, onClick: () => onPage(page - 1) }, 'Previous'),
    h('span', `Page ${page} / ${pages}`),
    h('button', { class: 'btn sm', disabled: page >= pages, onClick: () => onPage(page + 1) }, 'Next'));
}

export const loading = (rows = 6) => h('div', { class: 'stack', style: 'padding:16px' }, Array.from({ length: rows }, (_, i) => h('div', { class: 'skel', style: `width:${90 - i * 7}%` })));
export const empty = (title, sub) => h('div', { class: 'empty' }, h('b', title), sub ?? '');
export function errorBox(e, retry) {
  return h('div', { class: 'err' }, h('b', 'Could not load this'), e.message, retry ? h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn', onClick: retry }, 'Try again')) : null);
}

export function field(label, control, hint) {
  return h('label', { class: 'f' }, h('span', label), control, hint ? h('span', { class: 'hint' }, hint) : null);
}

export function copyButton(text, label = 'Copy') {
  const b = h('button', { class: 'btn sm', type: 'button' }, icon('copy'), label);
  b.addEventListener('click', async () => { await window.hh.copy(text); toast('Copied to clipboard.'); });
  return b;
}

export function toCsv(rows) {
  const cell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
export async function saveCsv(name, csv) {
  const r = await window.hh.saveFile(name, csv);
  if (r.ok) toast(`Saved to ${r.path}`);
  return r;
}
