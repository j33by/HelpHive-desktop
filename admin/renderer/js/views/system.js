import { h, get, clear, loading, errorBox, num, dur, icon } from '../lib.js';
import { state } from '../state.js';

export default function system(root) {
  const head = h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', 'System'), h('div', { class: 'sub' }, 'Is everything the console depends on up?')), h('button', { class: 'btn', onClick: () => load() }, icon('refresh'), 'Check again'));
  const body = h('div', { class: 'page-body' });
  root.append(head, body);

  const card = (label, ok, value, detail) => h('div', { class: 'kpi' }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, h('span', { class: ok ? 'dot' : 'dot off' }), value), h('div', { class: 'd' }, detail));

  async function load() {
    clear(body).append(loading(6));
    try {
      const r = await get('/system');
      clear(body).append(
        h('div', { class: 'grid g-4' },
          card('Neon database', r.neon.ok, r.neon.ok ? 'Online' : 'Down', r.neon.ok ? `${r.neon.ms} ms round trip` : 'Comments, notifications and logs are unavailable'),
          card('Supabase', r.supabase.ok, r.supabase.ok ? 'Online' : 'Down', r.supabase.ok ? `${r.supabase.ms} ms round trip` : 'Users and posts are unavailable'),
          card('API server', true, `up ${dur(r.server.uptimeSeconds)}`, `Node ${r.server.node} · ${r.server.memoryMb} MB`),
          card('Admin sessions', true, num(r.counts.sessions), 'Active in the last 30 minutes')),
        h('div', { class: 'grid g-2', style: 'margin-top:12px' },
          h('div', { class: 'card' }, h('header', h('h3', 'Records')), h('div', { class: 'body' }, h('dl', { class: 'kv' },
            h('dt', 'Admin accounts'), h('dd', num(r.counts.admins)), h('dt', 'Audit log entries'), h('dd', num(r.counts.logs)), h('dt', 'Moderation actions'), h('dd', num(r.counts.actions)), h('dt', 'Last audit entry'), h('dd', r.counts.last_log ? new Date(r.counts.last_log).toLocaleString() : '—')))),
          h('div', { class: 'card' }, h('header', h('h3', 'This console')), h('div', { class: 'body' }, h('dl', { class: 'kv' },
            h('dt', 'Server'), h('dd', state.server), h('dt', 'Signed in as'), h('dd', `${state.admin.name} (${state.admin.role})`), h('dt', 'DB pool'), h('dd', `${r.server.poolTotal} connections, ${r.server.poolIdle} idle, ${r.server.poolWaiting} waiting`))))));
    } catch (e) { clear(body).append(errorBox(e, load)); }
  }
  load();
  return { refresh: load };
}
