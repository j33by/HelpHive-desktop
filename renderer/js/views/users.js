import { h, get, api, clear, icon, num, fdt, fd, ago, loading, errorBox, empty, pager, tabs, avatar, standingBadge, strikeBadge, debounce, toast, fail, confirmBox, ACTION_LABEL, field, modal } from '../lib.js';
import { state, can } from '../state.js';
import { actionDialog, undoDialog } from '../actions.js';
import { drawer, append } from '../lib.js';

export default function users(root, params = {}) {
  let q = params.q ?? '';
  let status = 'all', sort = 'newest', page = 1;
  const head = h('div', { class: 'page-head' });
  const body = h('div', { class: 'page-body' });
  root.append(head, body);

  const search = h('input', { class: 'input search', placeholder: 'Search name, username, email or id…', value: q });
  search.addEventListener('input', debounce(() => { q = search.value; page = 1; load(); }, 300));
  const st = h('select', { class: 'select' }, [['all', 'All accounts'], ['active', 'Active'], ['restricted', 'Restricted'], ['banned', 'Banned'], ['struck', 'With strikes']].map(([v, l]) => h('option', { value: v }, l)));
  st.addEventListener('change', () => { status = st.value; page = 1; load(); });
  const so = h('select', { class: 'select' }, [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['name', 'Username A–Z']].map(([v, l]) => h('option', { value: v }, l)));
  so.addEventListener('change', () => { sort = so.value; page = 1; load(); });
  head.append(h('div', { class: 'grow' }, h('h1', 'Users'), h('div', { class: 'sub' }, 'Find an account, inspect its activity and act on it')), search, st, so);
  setTimeout(() => search.focus(), 50);

  const listBox = h('div');
  body.append(listBox);

  async function load() {
    clear(listBox).append(loading(8));
    try {
      const r = await get('/users', { q, status, sort, page });
      clear(listBox);
      if (!r.users.length) { listBox.append(h('div', { class: 'tablewrap' }, empty('No accounts match', 'Try a different search or filter.'))); return; }
      const rows = r.users.map((u) => h('tr', { class: 'click', onClick: () => openUser(u.id) },
        h('td', h('div', { class: 'row' }, avatar(u), h('div', { style: 'min-width:0' }, h('div', { class: 'trunc', style: 'font-weight:600' }, u.fullName || u.username), h('div', { class: 'muted trunc' }, `@${u.username}`)))),
        h('td', { class: 'trunc', style: 'max-width:240px' }, u.email || h('span', { class: 'dim' }, '—')),
        h('td', { class: 'nowrap muted' }, fd(u.createdAt)),
        h('td', { class: 'nowrap muted' }, u.lastSeenAt ? ago(u.lastSeenAt) : (u.lastSignInAt ? ago(u.lastSignInAt) : 'never')),
        h('td', h('div', { class: 'row gap-4' }, standingBadge(u.standing), strikeBadge(u.standing.strikes))),
        h('td', { class: 'right' }, icon('chevron', 14))));
      listBox.append(
        h('div', { class: 'tablewrap' }, h('table', { class: 'grid-t' },
          h('thead', h('tr', ['Account', 'Email', 'Joined', 'Last seen', 'Standing', ''].map((t) => h('th', t)))),
          h('tbody', rows))),
        pager({ page, total: r.total, size: r.pageSize, onPage: (p) => { page = p; load(); } }));
    } catch (e) { clear(listBox).append(errorBox(e, load)); }
  }

  const openUser = (id) => openUserDrawer(id, load);
  load();
  if (params.open) openUser(params.open);
  return { refresh: load };
}

// ---------------------------------------------------------------------------
// the account drawer
// ---------------------------------------------------------------------------
export function openUserDrawer(id, onChange) {
  let tab = 'overview';
  let detail = null;
  const content = h('div');
  const d = drawer({ title: 'Loading…', body: [content] });
  const tabBar = h('div');

  async function load(keepTab) {
    try {
      detail = await get(`/users/${id}`);
      if (!keepTab) tab = 'overview';
      d.setTitle(detail.user.fullName || detail.user.username, `@${detail.user.username}`);
      draw();
    } catch (e) { clear(content).append(errorBox(e, () => load())); }
  }
  const changed = () => { load(true); onChange?.(); };

  function draw() {
    clear(content);
    const u = detail.user;
    content.append(
      h('div', { class: 'row gap-12', style: 'margin-bottom:14px' },
        avatar(u, true),
        h('div', { class: 'grow' },
          h('div', { class: 'row gap-4 wrap' }, standingBadge(detail.standing), strikeBadge(detail.standing.strikes), detail.counts.openReports ? h('span', { class: 'badge' }, `${detail.counts.openReports} open report${detail.counts.openReports > 1 ? 's' : ''}`) : null),
          h('div', { class: 'muted', style: 'margin-top:4px' }, u.email || 'no email'),
          h('div', { class: 'dim mono' }, u.id))),
      tabs([
        { id: 'overview', label: 'Overview' }, { id: 'posts', label: 'Posts', count: 0 }, { id: 'comments', label: 'Comments' },
        { id: 'activity', label: 'Activity' }, { id: 'history', label: 'Moderation', count: 0 }, { id: 'notes', label: 'Notes' },
      ].map((t) => ({ ...t, count: t.id === 'notes' && detail.notes.length ? detail.notes.length : 0 })), tab, (t) => { tab = t; paint(); }),
      h('div', { style: 'height:14px' }), tabBar);
    paint();
  }

  function paint() {
    clear(tabBar);
    ({ overview, posts, comments, activity, history, notes })[tab]();
  }

  // ----- overview -----
  function overview() {
    const u = detail.user, s = detail.standing, c = detail.counts;
    const ctx = { user: { id: u.id, username: u.username }, standing: s, info: { nextRestrictionHours: s.nextRestrictionHours, restrictionLevel: s.restrictionLevel, strikes: s.strikes }, onDone: changed };
    const btn = (type, label, ic, kind, show = true) => show ? h('button', { class: `btn ${kind ?? ''}`, onClick: () => actionDialog(type, ctx) }, icon(ic), label) : null;
    const banned = s.status === 'banned', restricted = s.status === 'restricted';

    append(tabBar, [
      s.status !== 'active' ? h('div', { class: 'note', style: 'margin-bottom:12px' },
        banned ? [h('b', 'Banned'), ` since ${fdt(s.bannedAt)}. Reason shown to the person: “${s.reason}”`]
          : [h('b', `Restricted until ${fdt(s.until)}`), `. Reason shown to the person: “${s.reason}”`]) : null,
      h('div', { class: 'card' }, h('header', h('h3', 'Actions')), h('div', { class: 'body col' },
        h('div', { class: 'row wrap' },
          can('warn') ? btn('warn', 'Warn', 'warn', '', !banned) : null,
          can('restrict') ? btn('restrict', `Restrict (${s.nextRestrictionHours} h)`, 'clock', '', !banned && !restricted) : null,
          can('unrestrict') ? btn('unrestrict', 'Lift restriction', 'check', '', restricted) : null,
          can('strike') ? btn('strike', 'Add strike', 'flag', '', !banned) : null,
          can('remove_strike') ? btn('remove_strike', 'Remove strike', 'undo', '', s.strikes > 0) : null),
        h('div', { class: 'row wrap' },
          can('ban') ? btn('ban', 'Ban account', 'ban', 'danger', !banned) : null,
          can('unban') ? btn('unban', 'Unban account', 'check', 'primary', banned) : null,
          can('account.email') ? btn('email', 'Change email', 'mail') : null,
          can('account.password') ? btn('password', 'Change password', 'key') : null,
          can('account.delete') ? btn('delete_account', 'Delete account', 'trash', 'danger') : null))),
      h('div', { class: 'grid g-2', style: 'margin-top:12px' },
        h('div', { class: 'card' }, h('header', h('h3', 'Profile')), h('div', { class: 'body' }, h('dl', { class: 'kv' },
          h('dt', 'Name'), h('dd', u.fullName || '—'), h('dt', 'Username'), h('dd', `@${u.username}`), h('dt', 'Email'), h('dd', [u.email || '—', u.email ? h('span', { class: 'badge mute', style: 'margin-left:6px' }, u.emailConfirmed ? 'confirmed' : 'unconfirmed') : null]),
          h('dt', 'Sign-in'), h('dd', u.provider), h('dt', 'Location'), h('dd', u.location || '—'), h('dt', 'Bio'), h('dd', u.bio || '—'),
          h('dt', 'Joined'), h('dd', fdt(u.createdAt)), h('dt', 'Last sign-in'), h('dd', fdt(u.lastSignInAt)), h('dt', 'Last seen'), h('dd', detail.presence.lastSeenAt ? `${fdt(detail.presence.lastSeenAt)} (${ago(detail.presence.lastSeenAt)})` : '—')))),
        h('div', { class: 'card' }, h('header', h('h3', 'Numbers')), h('div', { class: 'body' }, h('dl', { class: 'kv' },
          h('dt', 'Posts'), h('dd', num(c.posts)), h('dt', 'Comments'), h('dd', num(c.comments)), h('dt', 'Friends'), h('dd', num(c.friends)),
          h('dt', 'App sessions'), h('dd', num(c.logins)), h('dt', 'Strikes'), h('dd', num(s.strikes)), h('dt', 'Restrictions'), h('dd', `${s.restrictionLevel - 1} so far`), h('dt', 'Reports against'), h('dd', num(c.reports))),
          h('div', { class: 'note', style: 'margin-top:12px' }, h('b', 'Private messages are not accessible. '), 'Admins can never read a person’s conversations.')))),
      detail.appeals.length ? h('div', { class: 'card', style: 'margin-top:12px' }, h('header', h('h3', 'Appeals')), h('div', { class: 'body stack' }, detail.appeals.map((a) => h('div', h('div', { class: 'row' }, h('span', { class: 'badge' }, a.status), h('span', { class: 'dim' }, fdt(a.createdAt))), h('div', { style: 'margin-top:4px;white-space:pre-wrap' }, a.message), a.decisionReason ? h('div', { class: 'muted' }, `Decision: ${a.decisionReason}`) : null)))) : null]);
  }

  // ----- posts -----
  function posts() {
    const box = h('div', loading(4));
    tabBar.append(box);
    let page = 1;
    const run = async () => {
      try {
        const r = await get(`/users/${id}/posts`, { page });
        clear(box);
        if (!r.posts.length) return box.append(empty('No posts', 'This person has not posted anything.'));
        box.append(h('div', r.posts.map((p) => h('div', { class: 'ptile' },
          p.imageUrl ? h('img', { src: p.imageUrl, alt: '' }) : null,
          h('div', { class: 'grow' }, h('div', { class: 'tx' }, p.body || '(photo only)'), h('div', { class: 'row gap-12 muted', style: 'margin-top:6px' }, h('span', { class: 'badge mute' }, p.category), h('span', fdt(p.createdAt)), h('span', `${p.comments} comments`), p.resolved ? h('span', { class: 'badge mute' }, 'resolved') : null)),
          can('content.delete') ? h('button', { class: 'btn sm danger', onClick: () => actionDialog('delete_post', { user: { id, username: detail.user.username }, standing: detail.standing, target: { kind: 'post', id: p.id, excerpt: p.body || '(photo only)' }, onDone: () => { run(); changed(); } }) }, 'Remove') : null))), pager({ page, total: r.total, size: 20, onPage: (n) => { page = n; run(); } }));
      } catch (e) { clear(box).append(errorBox(e, run)); }
    };
    run();
  }

  // ----- comments -----
  function comments() {
    const box = h('div', loading(4));
    tabBar.append(box);
    let page = 1;
    const run = async () => {
      try {
        const r = await get(`/users/${id}/comments`, { page });
        clear(box);
        if (!r.comments.length) return box.append(empty('No comments', 'This person has not commented.'));
        box.append(h('div', r.comments.map((c) => h('div', { class: 'ptile' },
          h('div', { class: 'grow' }, h('div', { class: 'tx' }, c.body), h('div', { class: 'muted', style: 'margin-top:6px' }, `${c.isReply ? 'Reply' : 'Comment'} on “${c.postExcerpt}” · ${fdt(c.createdAt)}`)),
          can('content.delete') ? h('button', { class: 'btn sm danger', onClick: () => actionDialog('delete_comment', { user: { id, username: detail.user.username }, standing: detail.standing, target: { kind: 'comment', id: c.id, excerpt: c.body }, onDone: () => { run(); changed(); } }) }, 'Remove') : null))), pager({ page, total: r.total, size: 20, onPage: (n) => { page = n; run(); } }));
      } catch (e) { clear(box).append(errorBox(e, run)); }
    };
    run();
  }

  // ----- activity -----
  function activity() {
    const box = h('div', loading(5));
    tabBar.append(box);
    (async () => {
      try {
        const r = await get(`/users/${id}/activity`);
        clear(box);
        if (!r.events.length) return box.append(empty('Nothing yet'));
        const label = { post: 'Posted', comment: 'Commented', login: 'Session', action: 'Admin action' };
        box.append(h('div', { class: 'tl' }, r.events.map((e) => h('div', { class: `ev ${e.kind}` },
          h('div', { class: 't' }, `${label[e.kind]} · ${fdt(e.at)}`),
          h('div', e.kind === 'action' ? `${ACTION_LABEL[e.text] ?? e.text} by ${e.by}${e.reverted ? ' (undone)' : ''}` : e.text),
          e.kind === 'action' && e.meta ? h('div', { class: 'muted' }, e.meta) : null))));
      } catch (e) { clear(box).append(errorBox(e)); }
    })();
  }

  // ----- moderation history -----
  function history() {
    if (!detail.actions.length) return tabBar.append(empty('Clean record', 'Nothing has been done to this account.'));
    tabBar.append(h('div', { class: 'tablewrap' }, h('table', { class: 'grid-t' },
      h('thead', h('tr', ['When', 'Action', 'By', 'Reason', ''].map((t) => h('th', t)))),
      h('tbody', detail.actions.map((a) => h('tr',
        h('td', { class: 'nowrap muted' }, fdt(a.createdAt)),
        h('td', h('div', { class: 'row gap-4 wrap' }, h('span', { class: 'badge' }, ACTION_LABEL[a.type]), a.auto ? h('span', { class: 'badge mute' }, 'auto') : null, a.revertedAt ? h('span', { class: 'badge mute' }, 'undone') : null)),
        h('td', a.adminName),
        h('td', { style: 'max-width:260px' }, a.reason, a.revertedAt ? h('div', { class: 'muted' }, `Undone by ${a.revertedName}: ${a.revertReason}`) : null, !a.notified && a.message ? h('div', { class: 'hint' }, 'No alert sent') : null),
        h('td', { class: 'right' }, (state.admin.role !== 'moderator' || a.adminId === state.admin.id) && a.reversible && !a.revertedAt ? h('button', { class: 'btn sm', onClick: () => undoDialog(a, changed) }, 'Undo') : null)))))));
  }

  // ----- notes -----
  function notes() {
    const ta = h('textarea', { class: 'textarea', maxlength: 1000, placeholder: 'Add an internal note. The person never sees it.', style: 'min-height:64px' });
    const list = h('div', { class: 'stack', style: 'margin-top:14px' });
    const draw = () => {
      clear(list);
      if (!detail.notes.length) list.append(empty('No notes'));
      detail.notes.forEach((n) => list.append(h('div', { class: 'card' }, h('div', { class: 'body' }, h('div', { style: 'white-space:pre-wrap' }, n.body), h('div', { class: 'row muted', style: 'margin-top:8px' }, h('span', { class: 'grow' }, `${n.adminName} · ${fdt(n.createdAt)}`), h('button', { class: 'btn sm ghost', onClick: async () => { try { await api('DELETE', `/users/${id}/notes/${n.id}`); detail.notes = detail.notes.filter((x) => x.id !== n.id); draw(); } catch (e) { fail(e); } } }, 'Delete'))))));
    };
    tabBar.append(ta, h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn primary', onClick: async () => { try { const r = await api('POST', `/users/${id}/notes`, { body: ta.value }); detail.notes.unshift(r.note); ta.value = ''; draw(); } catch (e) { fail(e); } } }, 'Add note')), list);
    draw();
  }

  load();
  return d;
}
