import { h, get, clear, icon, fdt, loading, errorBox, empty, pager, tabs, avatar, debounce, modal } from '../lib.js';
import { can } from '../state.js';
import { actionDialog } from '../actions.js';
import { openUserDrawer } from './users.js';

export default function content(root) {
  let tab = 'posts', q = '', category = '', page = 1;
  const head = h('div', { class: 'page-head' });
  const body = h('div', { class: 'page-body' });
  root.append(head, body);

  const search = h('input', { class: 'input search', placeholder: 'Search text…' });
  search.addEventListener('input', debounce(() => { q = search.value; page = 1; load(); }, 300));
  const cat = h('select', { class: 'select' }, [['', 'All categories'], ['request', 'Needs help'], ['offer', 'Offers'], ['general', 'General']].map(([v, l]) => h('option', { value: v }, l)));
  cat.addEventListener('change', () => { category = cat.value; page = 1; load(); });
  head.append(h('div', { class: 'grow' }, h('h1', 'Content'), h('div', { class: 'sub' }, 'Every post and comment on the platform')), search, cat);

  const bar = tabs([{ id: 'posts', label: 'Posts' }, { id: 'comments', label: 'Comments' }], tab, (t) => { tab = t; page = 1; cat.style.display = t === 'posts' ? '' : 'none'; load(); });
  const box = h('div', { style: 'margin-top:14px' });
  body.append(bar, box);

  const who = (a) => h('div', { class: 'row' }, avatar(a), h('div', { style: 'min-width:0' }, h('div', { class: 'trunc', style: 'font-weight:600' }, a?.fullName || a?.username || 'deleted'), h('div', { class: 'muted trunc' }, `@${a?.username ?? 'deleted'}`)));
  const open = (a) => a?.id && openUserDrawer(a.id, load);

  const table = (cols, rows) => h('div', { class: 'tablewrap' }, h('table', { class: 'grid-t' }, h('thead', h('tr', cols.map((t) => h('th', t)))), h('tbody', rows)));
  const clamp = 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden';

  function postRow(p) {
    const removeBtn = can('content.delete')
      ? h('button', { class: 'btn sm danger', onClick: () => actionDialog('delete_post', { user: { id: p.author.id, username: p.author.username }, target: { kind: 'post', id: p.id, excerpt: p.body || '(photo only)' }, onDone: load }) }, 'Remove')
      : null;
    return h('tr',
      h('td', { style: 'width:210px' }, h('div', { onClick: () => open(p.author), style: 'cursor:default' }, who(p.author))),
      h('td', { style: 'max-width:420px' }, h('div', { class: 'row' }, p.imageUrl ? h('span', { class: 'badge mute' }, 'photo') : null, h('span', { style: clamp }, p.body || '(photo only)'))),
      h('td', h('span', { class: 'badge mute' }, p.category), p.resolved ? h('span', { class: 'badge mute', style: 'margin-left:4px' }, 'resolved') : null),
      h('td', { class: 'num' }, p.comments),
      h('td', { class: 'nowrap muted' }, fdt(p.createdAt)),
      h('td', { class: 'right nowrap' }, h('button', { class: 'btn sm', onClick: () => viewComments(p) }, 'Comments'), ' ', removeBtn));
  }

  function commentRow(c) {
    const removeBtn = can('content.delete')
      ? h('button', { class: 'btn sm danger', onClick: () => actionDialog('delete_comment', { user: { id: c.author.id, username: c.author.username }, target: { kind: 'comment', id: c.id, excerpt: c.body }, onDone: load }) }, 'Remove')
      : null;
    return h('tr',
      h('td', { style: 'width:210px' }, h('div', { onClick: () => open(c.author), style: 'cursor:default' }, who(c.author))),
      h('td', { style: 'max-width:460px;white-space:pre-wrap;word-break:break-word' }, c.body),
      h('td', h('span', { class: 'badge mute' }, c.isReply ? 'reply' : 'comment')),
      h('td', { class: 'nowrap muted' }, fdt(c.createdAt)),
      h('td', { class: 'right' }, removeBtn));
  }

  async function load() {
    clear(box).append(loading(7));
    try {
      if (tab === 'posts') {
        const r = await get('/content/posts', { q, category, page });
        clear(box);
        if (!r.posts.length) return box.append(h('div', { class: 'tablewrap' }, empty('No posts found')));
        box.append(table(['Author', 'Post', 'Category', 'Comments', 'Posted', ''], r.posts.map(postRow)), pager({ page, total: r.total, size: 20, onPage: (n) => { page = n; load(); } }));
      } else {
        const r = await get('/content/comments', { q, page });
        clear(box);
        if (!r.comments.length) return box.append(h('div', { class: 'tablewrap' }, empty('No comments found')));
        box.append(table(['Author', 'Comment', 'Type', 'Posted', ''], r.comments.map(commentRow)), pager({ page, total: r.total, size: 20, onPage: (n) => { page = n; load(); } }));
      }
    } catch (e) { clear(box).append(errorBox(e, load)); }
  }

  async function viewComments(p) {
    const list = h('div', loading(3));
    const m = modal({ title: 'Comments on this post', sub: `@${p.author.username}: ${(p.body || '(photo only)').slice(0, 90)}`, wide: true, body: [list], actions: [{ label: 'Close', value: true }] });
    try {
      const r = await get(`/content/posts/${p.id}/comments`);
      clear(list);
      if (!r.comments.length) return list.append(empty('No comments'));
      list.append(h('div', r.comments.map((c) => h('div', { class: 'ptile', style: c.parentId ? 'margin-left:24px' : '' },
        h('div', { class: 'grow' }, h('div', { class: 'row muted' }, h('b', { style: 'color:var(--text)' }, `@${c.author.username}`), h('span', fdt(c.createdAt)), c.helpful ? h('span', { class: 'badge solid' }, 'helpful') : null), h('div', { class: 'tx', style: 'margin-top:2px' }, c.body)),
        can('content.delete') ? h('button', { class: 'btn sm danger', onClick: () => { m.close(); actionDialog('delete_comment', { user: { id: c.author.id, username: c.author.username }, target: { kind: 'comment', id: c.id, excerpt: c.body }, onDone: load }); } }, 'Remove') : null))));
    } catch (e) { clear(list).append(errorBox(e)); }
  }

  load();
  return { refresh: load };
}
