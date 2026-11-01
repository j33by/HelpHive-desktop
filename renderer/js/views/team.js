import { h, get, api, clear, fdt, ago, loading, errorBox, toast, fail, modal, field, confirmBox, copyButton, icon } from '../lib.js';
import { state } from '../state.js';

const ROLES = { owner: 'Full control, manages admins and settings', admin: 'All moderation, bans, accounts, events, logs', moderator: 'Warn, restrict, strike, remove content, own undo' };

export default function team(root) {
  const head = h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', 'Team'), h('div', { class: 'sub' }, 'Admin accounts and what each role can do')), h('button', { class: 'btn primary', onClick: add }, icon('plus'), 'Add admin'));
  const body = h('div', { class: 'page-body' });
  root.append(head, body);
  const box = h('div');
  body.append(box, h('div', { class: 'card', style: 'margin-top:16px' }, h('header', h('h3', 'Roles')), h('div', { class: 'body' }, h('dl', { class: 'kv' }, Object.entries(ROLES).flatMap(([r, d]) => [h('dt', { style: 'text-transform:capitalize;color:var(--text)' }, r), h('dd', d)])))));

  const secret = (title, pw) => modal({ title, sub: 'Shown once. They must change it at first sign-in.', body: [h('div', { class: 'preview mono', style: 'font-size:16px;user-select:all' }, pw), copyButton(pw, 'Copy')], actions: [{ label: 'Done', kind: 'primary', value: true }] });

  async function load() {
    clear(box).append(loading(4));
    try {
      const r = await get('/team/admins');
      clear(box).append(h('div', { class: 'tablewrap' }, h('table', { class: 'grid-t' },
        h('thead', h('tr', ['Admin', 'Role', 'Status', 'Last sign-in', 'Sessions', ''].map((t) => h('th', t)))),
        h('tbody', r.admins.map((a) => {
          const me = a.id === state.admin.id;
          return h('tr',
            h('td', h('div', { style: 'font-weight:600' }, a.name, me ? h('span', { class: 'badge mute', style: 'margin-left:6px' }, 'you') : null), h('div', { class: 'muted' }, a.email)),
            h('td', me ? h('span', { class: 'badge' }, a.role) : (() => { const s = h('select', { class: 'select' }, Object.keys(ROLES).map((x) => h('option', { value: x, selected: x === a.role }, x))); s.addEventListener('change', () => patch(a, { role: s.value })); return s; })()),
            h('td', a.disabled ? h('span', { class: 'badge hatch' }, 'disabled') : a.locked ? h('span', { class: 'badge solid' }, 'locked') : h('span', { class: 'badge mute' }, a.mustChangePassword ? 'password pending' : 'active')),
            h('td', { class: 'muted nowrap' }, a.lastLoginAt ? `${fdt(a.lastLoginAt)}` : 'never'),
            h('td', { class: 'num' }, a.sessions),
            h('td', { class: 'right nowrap' }, me ? null : [
              h('button', { class: 'btn sm', onClick: async () => { if (await confirmBox({ title: `Reset password for ${a.name}?`, body: 'A new temporary password is created and all their sessions end.', yes: 'Reset' })) try { const x = await api('POST', `/team/admins/${a.id}/reset-password`); secret(`Temporary password for ${a.name}`, x.temporaryPassword); load(); } catch (e) { fail(e); } } }, 'Reset password'), ' ',
              a.sessions ? h('button', { class: 'btn sm', onClick: async () => { try { await api('POST', `/team/admins/${a.id}/sign-out`); toast('Signed out.'); load(); } catch (e) { fail(e); } } }, 'Sign out') : null, ' ',
              h('button', { class: 'btn sm ' + (a.disabled ? '' : 'danger'), onClick: () => patch(a, { disabled: !a.disabled }) }, a.disabled ? 'Enable' : 'Disable')]));
        })))));
    } catch (e) { clear(box).append(errorBox(e, load)); }
  }
  async function patch(a, change) { try { await api('PATCH', `/team/admins/${a.id}`, change); toast('Updated.'); } catch (e) { fail(e); } load(); }

  function add() {
    const name = h('input', { class: 'input', maxlength: 60, placeholder: 'Full name', autofocus: true });
    const email = h('input', { class: 'input', type: 'email', placeholder: 'name@company.com' });
    const role = h('select', { class: 'select' }, Object.keys(ROLES).map((r) => h('option', { value: r, selected: r === 'moderator' }, r)));
    const hint = h('div', { class: 'hint' }, ROLES.moderator);
    role.addEventListener('change', () => { hint.textContent = ROLES[role.value]; });
    modal({ title: 'Add an admin', body: [field('Name', name), field('Email', email), field('Role', role), hint], actions: [{ label: 'Cancel', value: false }, { label: 'Create account', kind: 'primary', onClick: async (close) => { try { const r = await api('POST', '/team/admins', { name: name.value, email: email.value, role: role.value }); close(true); secret(`Temporary password for ${r.admin.name}`, r.temporaryPassword); load(); } catch (e) { fail(e); } } }] });
  }

  load();
  return { refresh: load };
}
