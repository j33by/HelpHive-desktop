import { h, get, api, clear, fdt, ago, loading, errorBox, empty, tabs, avatar, toast, fail, modal, field, pager, seg, ACTION_LABEL, standingBadge } from '../lib.js';
import { state, can } from '../state.js';
import { actionDialog } from '../actions.js';
import { openUserDrawer } from './users.js';

const REASON = { spam: 'Spam', harassment: 'Harassment', inappropriate: 'Inappropriate', scam: 'Scam', misinformation: 'Misinformation', other: 'Other' };

export default function inbox(root, params = {}) {
  let tab = params.tab ?? 'reports', filter = 'open', page = 1;
  const head = h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', 'Inbox'), h('div', { class: 'sub' }, 'Reports from people and appeals from restricted or banned accounts')));
  const body = h('div', { class: 'page-body' });
  root.append(head, body);
  const bar = h('div');
  const box = h('div', { style: 'margin-top:14px' });
  body.append(bar, box);

  const drawBar = () => bar.replaceChildren(tabs([{ id: 'reports', label: 'Reports' }, ...(can('appeals') ? [{ id: 'appeals', label: 'Appeals' }] : [])], tab, (t) => { tab = t; filter = t === 'reports' ? 'open' : 'pending'; page = 1; drawBar(); load(); }));
  drawBar();
  if (tab === 'appeals') filter = 'pending';

  const user = (u) => u ? h('a', { href: '#', style: 'color:var(--white);text-decoration:underline;text-underline-offset:2px', onClick: (e) => { e.preventDefault(); openUserDrawer(u.id, load); } }, `@${u.username}`) : 'unknown';

  async function load() {
    clear(box).append(loading(5));
    try { tab === 'reports' ? await reports() : await appeals(); } catch (e) { clear(box).append(errorBox(e, load)); }
    state.badge();
  }

  async function reports() {
    const r = await get('/reports', { status: filter, page });
    clear(box);
    box.append(h('div', { class: 'toolbar' }, seg([['open', 'Open'], ['actioned', 'Actioned'], ['dismissed', 'Dismissed'], ['all', 'All']], filter, (v) => { filter = v; page = 1; load(); })));
    if (!r.reports.length) return box.append(h('div', { class: 'card' }, empty('Nothing here', filter === 'open' ? 'No open reports. Nice.' : 'No reports in this view.')));
    r.reports.forEach((x) => {
      const u = x.targetUser;
      const acts = x.status === 'open' ? h('div', { class: 'row wrap', style: 'margin-top:10px' },
        x.targetType !== 'user' && !x.gone && can('content.delete') ? h('button', { class: 'btn sm danger', onClick: () => actionDialog(x.targetType === 'post' ? 'delete_post' : 'delete_comment', { user: { id: u.id, username: u.username }, target: { kind: x.targetType, id: x.targetId, excerpt: x.preview }, onDone: load }) }, `Remove ${x.targetType}`) : null,
        u && can('warn') ? h('button', { class: 'btn sm', onClick: () => actionDialog('warn', { user: { id: u.id, username: u.username }, onDone: load }) }, 'Warn') : null,
        u && can('strike') ? h('button', { class: 'btn sm', onClick: () => actionDialog('strike', { user: { id: u.id, username: u.username }, onDone: load }) }, 'Strike') : null,
        u && can('restrict') ? h('button', { class: 'btn sm', onClick: () => actionDialog('restrict', { user: { id: u.id, username: u.username }, onDone: load }) }, 'Restrict') : null,
        u ? h('button', { class: 'btn sm', onClick: () => openUserDrawer(u.id, load) }, 'Open account') : null,
        h('span', { class: 'grow' }),
        h('button', { class: 'btn sm', onClick: () => resolve(x, 'dismissed') }, 'Dismiss'),
        h('button', { class: 'btn sm primary', onClick: () => resolve(x, 'actioned') }, 'Mark handled')) : h('div', { class: 'muted', style: 'margin-top:8px' }, `${x.status === 'actioned' ? 'Handled' : 'Dismissed'} by ${x.handledName} ${ago(x.handledAt)}${x.resolutionNote ? ` · ${x.resolutionNote}` : ''}`);
      box.append(h('div', { class: 'card', style: 'margin-bottom:10px' }, h('div', { class: 'body' },
        h('div', { class: 'row gap-12 wrap' }, h('span', { class: 'badge solid' }, x.targetType), h('span', { class: 'badge' }, REASON[x.reason] ?? x.reason), h('span', { class: 'muted' }, ['Reported ', ago(x.createdAt), ' by ', user(x.reporter)]), x.gone ? h('span', { class: 'badge mute' }, 'already removed') : null),
        h('div', { style: 'margin-top:8px' }, h('span', { class: 'muted' }, 'About '), user(u)),
        x.preview ? h('div', { class: 'preview', style: 'margin-top:8px' }, x.preview) : null,
        x.details ? h('div', { class: 'muted', style: 'margin-top:8px' }, `“${x.details}”`) : null, acts)));
    });
    box.append(pager({ page, total: r.total, size: 25, onPage: (n) => { page = n; load(); } }));
  }

  function resolve(x, resolution) {
    const note = h('input', { class: 'input', maxlength: 300, placeholder: 'Optional note for the record' });
    modal({ title: resolution === 'dismissed' ? 'Dismiss report' : 'Mark as handled', body: [field('Note', note)], actions: [{ label: 'Cancel', value: false }, { label: 'Confirm', kind: 'primary', onClick: async (close) => { try { await api('POST', `/reports/${x.id}/resolve`, { resolution, note: note.value || undefined }); close(true); toast('Report updated.'); load(); } catch (e) { fail(e); } } }] });
  }

  async function appeals() {
    const r = await get('/appeals', { status: filter });
    clear(box);
    box.append(h('div', { class: 'toolbar' }, seg([['pending', 'Pending'], ['approved', 'Approved'], ['denied', 'Denied'], ['all', 'All']], filter, (v) => { filter = v; load(); })));
    if (!r.appeals.length) return box.append(h('div', { class: 'card' }, empty('No appeals', 'Appeals from banned or restricted people show up here.')));
    r.appeals.forEach((a) => box.append(h('div', { class: 'card', style: 'margin-bottom:10px' }, h('div', { class: 'body' },
      h('div', { class: 'row gap-12 wrap' }, avatar(a.user), h('div', user(a.user), h('div', { class: 'muted' }, `Sent ${ago(a.createdAt)}`)), h('span', { class: 'grow' }), a.standing ? standingBadge(a.standing) : null, h('span', { class: a.status === 'pending' ? 'badge solid' : 'badge' }, a.status)),
      a.original ? h('div', { class: 'note', style: 'margin-top:10px' }, h('b', `${ACTION_LABEL[a.original.type]}: `), a.original.reason) : null,
      h('div', { class: 'preview', style: 'margin-top:10px' }, h('span', { class: 'cap' }, 'Their appeal'), a.message),
      a.status === 'pending'
        ? h('div', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'grow' }), h('button', { class: 'btn', onClick: () => decide(a, 'deny') }, 'Deny'), h('button', { class: 'btn primary', onClick: () => decide(a, 'approve') }, 'Approve and restore account'))
        : h('div', { class: 'muted', style: 'margin-top:8px' }, `${a.status === 'approved' ? 'Approved' : 'Denied'} by ${a.decidedName}: ${a.decisionReason}`)))));
  }

  function decide(a, decision) {
    const tpl = state.meta.templates[decision === 'approve' ? 'unban' : 'undo'] ?? [];
    const reason = h('textarea', { class: 'textarea', maxlength: 500, placeholder: decision === 'approve' ? 'What will they read when the account is restored?' : 'Explain why the appeal was denied. They will see this.' });
    const pick = tpl.length && decision === 'approve' ? h('select', { class: 'select' }, h('option', { value: '' }, 'Choose a ready-made reason…'), tpl.map((t, i) => h('option', { value: i }, t.label))) : null;
    pick?.addEventListener('change', () => { if (pick.value !== '') reason.value = tpl[pick.value].text; });
    modal({ title: decision === 'approve' ? 'Approve appeal' : 'Deny appeal', sub: `@${a.user?.username}`, body: [decision === 'approve' ? h('div', { class: 'note' }, 'The ban or restriction is lifted right away and the person is notified.') : h('div', { class: 'note' }, 'The account stays as it is. They see your answer on their account screen.'), pick ? field('Reason', pick) : null, reason], actions: [{ label: 'Cancel', value: false }, { label: decision === 'approve' ? 'Approve' : 'Deny', kind: decision === 'approve' ? 'primary' : 'danger', onClick: async (close) => { try { await api('POST', `/appeals/${a.id}/decide`, { decision, reason: reason.value.trim() }); close(true); toast('Decision recorded.'); load(); } catch (e) { fail(e); } } }] });
  }

  load();
  return { refresh: load };
}
