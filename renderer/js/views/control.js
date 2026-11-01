import { append, h, get, api, clear, fdt, ago, loading, errorBox, empty, pager, debounce, toast, fail, modal, field, ACTION_LABEL, icon } from '../lib.js';
import { state, can } from '../state.js';
import { undoDialog } from '../actions.js';
import { openUserDrawer } from './users.js';

export default function control(root) {
  let f = { admin: '', type: '', state: 'all', q: '', page: 1 };
  const head = h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', 'Control'), h('div', { class: 'sub' }, can('control.all') ? 'Review what every admin did to people, and undo it' : 'Review and undo your own actions')));
  const body = h('div', { class: 'page-body' });
  root.append(head, body);
  const team = h('div');
  const toolbar = h('div', { class: 'toolbar', style: 'margin-top:16px' });
  const box = h('div');
  body.append(team, toolbar, box);

  const adminSel = h('select', { class: 'select' }, h('option', { value: '' }, 'All admins'));
  const typeSel = h('select', { class: 'select' }, h('option', { value: '' }, 'All actions'), Object.entries(ACTION_LABEL).filter(([k]) => k !== 'account_delete').map(([k, l]) => h('option', { value: k }, l)));
  const stateSel = h('select', { class: 'select' }, [['all', 'Any state'], ['undoable', 'Can be undone'], ['active', 'Not undone'], ['undone', 'Already undone']].map(([v, l]) => h('option', { value: v }, l)));
  const search = h('input', { class: 'input search', placeholder: 'Search person or reason…' });
  adminSel.addEventListener('change', () => { f.admin = adminSel.value; f.page = 1; load(); });
  typeSel.addEventListener('change', () => { f.type = typeSel.value; f.page = 1; load(); });
  stateSel.addEventListener('change', () => { f.state = stateSel.value; f.page = 1; load(); });
  search.addEventListener('input', debounce(() => { f.q = search.value; f.page = 1; load(); }, 300));
  append(toolbar, [can('control.all') ? adminSel : null, typeSel, stateSel, h('span', { class: 'sp' }), search]);

  async function loadTeam() {
    if (!can('control.all')) return;
    try {
      const r = await get('/control/admins');
      while (adminSel.options.length > 1) adminSel.remove(1);
      r.admins.forEach((a) => adminSel.append(h('option', { value: a.id }, a.name)));
      adminSel.value = f.admin;
      clear(team).append(h('div', { class: 'grid g-4' }, r.admins.map((a) => h('div', { class: 'card' }, h('div', { class: 'body' },
        h('div', { class: 'row' }, h('b', a.name), h('span', { class: 'badge mute' }, a.role), a.disabled ? h('span', { class: 'badge hatch' }, 'disabled') : null),
        h('div', { class: 'muted', style: 'margin:6px 0 10px' }, `${a.undoable} can be undone · ${a.undone} undone`, h('br'), a.lastAction ? `Last action ${ago(a.lastAction)}` : 'No actions yet'),
        h('div', { class: 'row' }, h('button', { class: 'btn sm', onClick: () => { f.admin = a.id; adminSel.value = a.id; f.page = 1; load(); } }, 'View'), a.undoable ? h('button', { class: 'btn sm danger', onClick: () => undoAll(a) }, 'Undo everything…') : null))))));
    } catch (e) { clear(team).append(errorBox(e, loadTeam)); }
  }

  const stateOf = (a) => {
    if (a.revertedAt) return h('span', { class: 'badge mute' }, `Undone by ${a.revertedName}`);
    if (a.type === 'restrict') {
      if (a.endedAt) return h('span', { class: 'badge mute' }, 'Lifted early');
      return new Date(a.meta.until) > new Date() ? h('span', { class: 'badge solid' }, `Active until ${fdt(a.meta.until)}`) : h('span', { class: 'badge mute' }, 'Expired');
    }
    if (a.type === 'ban') return a.endedAt ? h('span', { class: 'badge mute' }, 'Lifted') : h('span', { class: 'badge hatch' }, 'In force');
    if (a.type === 'strike') return h('span', { class: 'badge strike' }, `Strike #${a.meta.count}`);
    return h('span', { class: 'badge mute' }, 'Done');
  };

  async function load() {
    clear(box).append(loading(7));
    try {
      const r = await get('/control/actions', f);
      clear(box);
      if (!r.actions.length) return box.append(h('div', { class: 'tablewrap' }, empty('No actions', 'Nothing matches these filters.')));
      box.append(h('div', { class: 'tablewrap' }, h('table', { class: 'grid-t' },
        h('thead', h('tr', ['When', 'Admin', 'Action', 'Person', 'Reason', 'State', ''].map((t) => h('th', t)))),
        h('tbody', r.actions.map((a) => h('tr',
          h('td', { class: 'nowrap muted' }, fdt(a.createdAt)),
          h('td', a.adminName),
          h('td', h('div', { class: 'row gap-4' }, h('span', { class: 'badge' }, ACTION_LABEL[a.type]), a.auto ? h('span', { class: 'badge mute' }, 'auto') : null)),
          h('td', a.type === 'account_delete' ? h('span', { class: 'muted' }, `@${a.username} (deleted)`) : h('a', { href: '#', style: 'color:var(--white);text-decoration:underline;text-underline-offset:2px', onClick: (e) => { e.preventDefault(); openUserDrawer(a.userId, load); } }, `@${a.username}`)),
          h('td', { style: 'max-width:300px' }, h('div', { class: 'trunc', title: a.reason }, a.reason), a.revertReason ? h('div', { class: 'muted trunc' }, `Undo: ${a.revertReason}`) : null, a.meta?.excerpt ? h('div', { class: 'dim trunc' }, `“${a.meta.excerpt}”`) : null),
          h('td', stateOf(a)),
          h('td', { class: 'right nowrap' }, a.canUndo ? h('button', { class: 'btn sm', onClick: () => undoDialog(a, () => { load(); loadTeam(); }) }, icon('undo'), 'Undo') : (!a.reversible && !a.revertedAt ? h('span', { class: 'hint' }, 'not reversible') : null))))))),
        pager({ page: f.page, total: r.total, size: 30, onPage: (n) => { f.page = n; load(); } }));
    } catch (e) { clear(box).append(errorBox(e, load)); }
  }

  function undoAll(a) {
    const reason = h('textarea', { class: 'textarea', maxlength: 500, placeholder: 'Why is everything being rolled back?' });
    const since = h('input', { class: 'input', type: 'datetime-local' });
    modal({
      title: `Undo everything by ${a.name}`, sub: `${a.undoable} actions can still be reversed`,
      body: [
        h('div', { class: 'note' }, h('b', 'This reverses every action that can be reversed: '), 'restrictions and bans are lifted, strikes removed, removed posts and comments restored, emails put back. Passwords and deleted accounts cannot be undone. Each person is told the action was reversed.'),
        field('Only actions since (optional)', since), field('Reason', reason)],
      actions: [{ label: 'Cancel', value: false }, { label: `Undo ${a.undoable} actions`, kind: 'danger', onClick: async (close) => {
        try {
          const r = await api('POST', `/control/admins/${a.id}/undo-all`, { reason: reason.value.trim(), since: since.value ? new Date(since.value).toISOString() : undefined });
          close(true); toast(`${r.undone} undone${r.failed.length ? `, ${r.failed.length} could not be undone` : ''}.`, r.failed.length > 0); load(); loadTeam();
        } catch (e) { fail(e); }
      } }],
    });
  }

  loadTeam(); load();
  return { refresh: () => { loadTeam(); load(); } };
}
