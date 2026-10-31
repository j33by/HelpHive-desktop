import { h, get, api, clear, icon, fdt, loading, errorBox, empty, seg, field, toast, fail, confirmBox, busy } from '../lib.js';

const KINDS = [['update', 'Update'], ['event', 'Event'], ['alert', 'Alert']];
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export default function events(root) {
  const head = h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', 'Events and updates'), h('div', { class: 'sub' }, 'Posts here appear at the top of every person’s feed automatically')));
  const body = h('div', { class: 'page-body' });
  root.append(head, body);

  let editing = null;
  let kind = 'update';
  const title = h('input', { class: 'input', maxlength: 120, placeholder: 'Short headline' });
  const text = h('textarea', { class: 'textarea', maxlength: 2000, placeholder: 'What should people know?', style: 'min-height:110px' });
  const when = h('input', { class: 'input', type: 'datetime-local' });
  const where = h('input', { class: 'input', maxlength: 120, placeholder: 'Where is it?' });
  const expires = h('input', { class: 'input', type: 'datetime-local' });
  const pinned = h('input', { type: 'checkbox' });
  const notify = h('input', { type: 'checkbox' });
  const eventFields = h('div', { class: 'grid g-2' }, field('Date and time', when), field('Location', where));
  const previewBox = h('div');
  const formTitle = h('h3', 'New post');
  const submit = h('button', { class: 'btn primary', onClick: () => save() }, 'Post to everyone’s feed');
  const cancelEdit = h('button', { class: 'btn ghost', style: 'display:none', onClick: () => reset() }, 'Cancel editing');

  const kindSeg = h('div');
  const drawKind = () => kindSeg.replaceChildren(seg(KINDS, kind, (v) => { kind = v; sync(); }));
  drawKind();
  function sync() {
    eventFields.style.display = kind === 'event' ? '' : 'none';
    notify.disabled = Boolean(editing);
    previewBox.replaceChildren(preview());
  }
  function preview() {
    const tag = { update: 'Update', event: 'Event', alert: 'Alert' }[kind];
    return h('div', { class: 'preview', style: 'background:var(--panel-2)' },
      h('span', { class: 'cap' }, 'Preview in the feed'),
      h('div', { class: 'row', style: 'margin-bottom:6px' }, h('span', { class: kind === 'alert' ? 'badge solid' : 'badge' }, tag), pinned.checked ? h('span', { class: 'badge mute' }, 'pinned') : null, h('span', { class: 'dim' }, 'HelpHive Team')),
      h('div', { style: 'font-weight:600;font-size:14px' }, title.value || 'Headline'),
      kind === 'event' ? h('div', { class: 'muted', style: 'margin:3px 0' }, [when.value ? fdt(fromLocalInput(when.value)) : 'Date and time', where.value ? ` · ${where.value}` : ''].join('')) : null,
      h('div', { style: 'margin-top:4px' }, text.value));
  }
  [title, text, when, where, pinned].forEach((e) => e.addEventListener('input', () => previewBox.replaceChildren(preview())));

  function reset() {
    editing = null; kind = 'update';
    title.value = text.value = when.value = where.value = expires.value = '';
    pinned.checked = notify.checked = false;
    formTitle.textContent = 'New post'; submit.textContent = 'Post to everyone’s feed'; cancelEdit.style.display = 'none';
    drawKind();
    sync();
  }

  async function save() {
    const payload = { kind, title: title.value, body: text.value, eventAt: kind === 'event' ? fromLocalInput(when.value) : null, location: kind === 'event' ? where.value : null, pinned: pinned.checked, expiresAt: fromLocalInput(expires.value), notifyAll: notify.checked };
    try {
      const r = await busy(submit, () => (editing ? api('PUT', `/announcements/${editing}`, payload) : api('POST', '/announcements', payload)));
      toast(editing ? 'Saved.' : `Posted.${r.notified ? ` ${r.notified} people were also alerted.` : ''}`);
      reset(); loadList();
    } catch (e) { fail(e); }
  }

  const form = h('div', { class: 'card' },
    h('header', formTitle, h('span', { class: 'grow' }), cancelEdit),
    h('div', { class: 'body col', style: 'gap:12px' },
      h('div', kindSeg), field('Title', title), field('Text', text), eventFields,
      h('div', { class: 'grid g-2' }, field('Stop showing on (optional)', expires), h('div', { class: 'col', style: 'justify-content:end;gap:8px' }, h('label', { class: 'chk' }, pinned, 'Pin to the top of the feed'), h('label', { class: 'chk' }, notify, 'Also send an alert to everyone'))),
      previewBox, h('div', { class: 'row' }, submit)));

  const list = h('div', { class: 'col' });
  body.append(h('div', { class: 'grid', style: 'grid-template-columns:minmax(380px,520px) 1fr;align-items:start' }, form, h('div', { class: 'card' }, h('header', h('h3', 'Posted')), h('div', { class: 'body' }, list))));

  async function loadList() {
    clear(list).append(loading(4));
    try {
      const r = await get('/announcements');
      clear(list);
      if (!r.announcements.length) return list.append(empty('Nothing posted yet', 'Your first update will show here.'));
      const now = Date.now();
      r.announcements.forEach((a) => {
        const gone = a.deletedAt, ended = a.expiresAt && new Date(a.expiresAt) < now;
        list.append(h('div', { style: 'padding:12px 0;border-bottom:1px solid var(--line);' + (gone || ended ? 'opacity:.5' : '') },
          h('div', { class: 'row gap-4 wrap' }, h('span', { class: a.kind === 'alert' ? 'badge solid' : 'badge' }, a.kind), a.pinned ? h('span', { class: 'badge mute' }, 'pinned') : null, gone ? h('span', { class: 'badge mute' }, 'removed') : ended ? h('span', { class: 'badge mute' }, 'ended') : h('span', { class: 'badge mute' }, 'live'), h('span', { class: 'dim' }, fdt(a.createdAt))),
          h('div', { style: 'font-weight:600;margin-top:4px' }, a.title),
          a.kind === 'event' ? h('div', { class: 'muted' }, `${fdt(a.eventAt)}${a.location ? ` · ${a.location}` : ''}`) : null,
          a.body ? h('div', { class: 'muted', style: 'margin-top:2px;white-space:pre-wrap' }, a.body.length > 200 ? `${a.body.slice(0, 200)}…` : a.body) : null,
          !gone ? h('div', { class: 'row', style: 'margin-top:8px' },
            h('button', { class: 'btn sm', onClick: () => edit(a) }, 'Edit'),
            h('button', { class: 'btn sm danger', onClick: async () => { if (await confirmBox({ title: 'Remove this post?', body: 'It disappears from everyone’s feed.', yes: 'Remove', danger: true })) { try { await api('DELETE', `/announcements/${a.id}`); toast('Removed.'); loadList(); } catch (e) { fail(e); } } } }, 'Remove')) : null));
      });
    } catch (e) { clear(list).append(errorBox(e, loadList)); }
  }
  function edit(a) {
    editing = a.id; kind = a.kind; title.value = a.title; text.value = a.body; when.value = toLocalInput(a.eventAt); where.value = a.location ?? ''; expires.value = toLocalInput(a.expiresAt); pinned.checked = a.pinned; notify.checked = false;
    formTitle.textContent = 'Edit post'; submit.textContent = 'Save changes'; cancelEdit.style.display = '';
    drawKind(); sync(); title.focus();
  }

  sync(); loadList();
  return { refresh: loadList };
}
