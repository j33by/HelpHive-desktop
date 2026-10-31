import { h, get, clear, icon, fdt, loading, errorBox, empty, pager, debounce, toast, fail, toCsv, saveCsv, api } from '../lib.js';

export default function logs(root) {
  let f = { admin: '', action: '', q: '', from: '', to: '', page: 1 };
  const head = h('div', { class: 'page-head' });
  const body = h('div', { class: 'page-body' });
  root.append(head, body);

  const search = h('input', { class: 'input search', placeholder: 'Search target, admin or details…' });
  const adminSel = h('select', { class: 'select' }, h('option', { value: '' }, 'All admins'));
  const actionSel = h('select', { class: 'select' }, h('option', { value: '' }, 'All actions'));
  const from = h('input', { class: 'input', type: 'date', title: 'From' });
  const to = h('input', { class: 'input', type: 'date', title: 'To' });
  search.addEventListener('input', debounce(() => { f.q = search.value; f.page = 1; load(); }, 300));
  adminSel.addEventListener('change', () => { f.admin = adminSel.value; f.page = 1; load(); });
  actionSel.addEventListener('change', () => { f.action = actionSel.value; f.page = 1; load(); });
  from.addEventListener('change', () => { f.from = from.value ? new Date(from.value + 'T00:00:00').toISOString() : ''; f.page = 1; load(); });
  to.addEventListener('change', () => { f.to = to.value ? new Date(to.value + 'T23:59:59').toISOString() : ''; f.page = 1; load(); });
  const exp = h('button', { class: 'btn', onClick: exportCsv }, icon('download'), 'Export CSV');
  head.append(h('div', { class: 'grow' }, h('h1', 'Audit log'), h('div', { class: 'sub' }, 'Everything admins do is recorded here and cannot be edited or deleted')), exp);

  const box = h('div');
  body.append(h('div', { class: 'toolbar' }, search, adminSel, actionSel, from, to), box);

  (async () => {
    try {
      const [a, t] = await Promise.all([get('/control/admins').catch(() => ({ admins: [] })), get('/logs/actions')]);
      a.admins.forEach((x) => adminSel.append(h('option', { value: x.id }, x.name)));
      const groups = [...new Set(t.actions.map((x) => x.split('.')[0]))];
      groups.forEach((g) => actionSel.append(h('option', { value: `${g}.` }, `${g} (all)`)));
      t.actions.forEach((x) => actionSel.append(h('option', { value: x }, `  ${x}`)));
    } catch { /* filters are optional */ }
  })();

  const summarize = (d) => {
    const parts = [];
    for (const [k, v] of Object.entries(d ?? {})) {
      if (v == null || v === '') continue;
      parts.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }
    return parts.join(' · ');
  };

  async function load() {
    clear(box).append(loading(9));
    try {
      const r = await get('/logs', f);
      clear(box);
      if (!r.logs.length) return box.append(h('div', { class: 'tablewrap' }, empty('No entries', 'Nothing matches these filters.')));
      box.append(h('div', { class: 'tablewrap' }, h('table', { class: 'grid-t' },
        h('thead', h('tr', ['Time', 'Admin', 'Action', 'Target', 'Details', 'IP'].map((t) => h('th', t)))),
        h('tbody', r.logs.map((l) => {
          const det = h('details', { class: 'json' }, h('summary', { class: 'muted trunc', style: 'max-width:350px;cursor:default;list-style:none' }, summarize(l.details) || '—'), h('pre', JSON.stringify(l.details, null, 2)));
          return h('tr',
            h('td', { class: 'nowrap muted' }, fdt(l.createdAt)),
            h('td', l.adminName || h('span', { class: 'dim' }, 'unknown')),
            h('td', h('span', { class: 'badge mono' }, l.action)),
            h('td', { style: 'max-width:230px' }, h('div', { class: 'trunc', title: l.targetLabel ?? '' }, l.targetLabel ?? (l.targetId ? l.targetId.slice(0, 8) : '—'))),
            h('td', { style: 'max-width:360px' }, det),
            h('td', { class: 'mono dim nowrap' }, l.ip ?? ''));
        })))),
        pager({ page: f.page, total: r.total, size: 50, onPage: (n) => { f.page = n; load(); } }));
    } catch (e) { clear(box).append(errorBox(e, load)); }
  }

  async function exportCsv() {
    try {
      const r = await api('GET', '/logs/export?' + new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== 'page')).toString());
      await saveCsv(`helphive-audit-${new Date().toISOString().slice(0, 10)}.csv`, r.csv);
    } catch (e) { fail(e); }
  }

  load();
  return { refresh: load };
}
