import { h, get, api, clear, loading, errorBox, toast, fail, field, busy, confirmBox } from '../lib.js';
import { state } from '../state.js';

const TPL_LABEL = { warn: 'Warning', restrict: 'Restriction', unrestrict: 'Lift restriction', ban: 'Ban', unban: 'Unban', strike: 'Strike', remove_strike: 'Remove strike', delete_post: 'Remove post', delete_comment: 'Remove comment', email_change: 'Email change', password_change: 'Password change', account_delete: 'Delete account', undo: 'Undo an action' };

export default function settings(root) {
  const head = h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', 'Settings'), h('div', { class: 'sub' }, 'Rules for restrictions and strikes, and the ready-made reasons admins pick from')));
  const body = h('div', { class: 'page-body' });
  root.append(head, body);

  async function load() {
    clear(body).append(loading(8));
    try {
      const { settings: s } = await get('/settings');
      draw(s);
    } catch (e) { clear(body).append(errorBox(e, load)); }
  }

  function draw(s) {
    const n = (v, min, max) => h('input', { class: 'input', type: 'number', min, max, value: v, style: 'width:110px' });
    const base = n(s.restrictBaseHours, 1, 168), max = n(s.restrictMaxHours, 1, 8760);
    const ar = n(s.strikeAutoRestrictAt, 0, 20), ab = n(s.strikeAutoBanAt, 0, 50), idle = n(s.sessionIdleMinutes, 5, 480);
    const nr = h('input', { type: 'checkbox', checked: s.notifyRestricted });
    const tpl = structuredClone(s.templates);
    const tplBox = h('div', { class: 'stack' });
    const drawTpl = () => {
      clear(tplBox);
      for (const [type, label] of Object.entries(TPL_LABEL)) {
        const list = tpl[type] ?? (tpl[type] = []);
        tplBox.append(h('details', { class: 'card' }, h('summary', { style: 'padding:10px 14px;cursor:default' }, h('b', label), h('span', { class: 'muted' }, `  ${list.length} reason${list.length === 1 ? '' : 's'}`)),
          h('div', { class: 'body stack', style: 'border-top:1px solid var(--line)' },
            list.map((t, i) => h('div', { class: 'row', style: 'align-items:flex-start' },
              h('input', { class: 'input', style: 'width:180px', maxlength: 40, value: t.label, onInput: (e) => { t.label = e.target.value; } }),
              h('textarea', { class: 'textarea grow', style: 'min-height:34px;height:34px', maxlength: 500, onInput: (e) => { t.text = e.target.value; } }, t.text),
              h('button', { class: 'btn sm ghost', onClick: () => { list.splice(i, 1); drawTpl(); tplBox.querySelectorAll('details')[Object.keys(TPL_LABEL).indexOf(type)].open = true; } }, 'Remove'))),
            h('div', h('button', { class: 'btn sm', onClick: () => { list.push({ label: 'New reason', text: 'Write the text the person will read.' }); drawTpl(); tplBox.querySelectorAll('details')[Object.keys(TPL_LABEL).indexOf(type)].open = true; } }, 'Add reason')))));
      }
    };
    drawTpl();
    const save = h('button', { class: 'btn primary', onClick: async () => {
      try {
        await busy(save, () => api('PUT', '/settings', {
          restrictBaseHours: +base.value, restrictMaxHours: +max.value, strikeAutoRestrictAt: +ar.value, strikeAutoBanAt: +ab.value,
          notifyRestricted: nr.checked, sessionIdleMinutes: +idle.value, templates: tpl,
        }));
        const meta = await get('/meta'); Object.assign(state.meta, meta);
        toast('Settings saved.');
      } catch (e) { fail(e); }
    } }, 'Save settings');

    clear(body).append(h('div', { class: 'grid g-2', style: 'align-items:start' },
      h('div', { class: 'col' },
        h('div', { class: 'card' }, h('header', h('h3', 'Restrictions')), h('div', { class: 'body stack' },
          h('div', { class: 'note' }, 'A first restriction lasts the base time. Each repeat adds the base time again: 24 h, 48 h, 72 h… up to the longest allowed. Undoing a restriction as a mistake does not count against the person.'),
          field('Base length (hours)', base), field('Longest restriction (hours)', max),
          h('label', { class: 'chk' }, nr, 'Also send alerts to people who are restricted at that moment'))),
        h('div', { class: 'card' }, h('header', h('h3', 'Strikes')), h('div', { class: 'body stack' },
          field('Restrict automatically at this many strikes (0 = off)', ar), field('Ban automatically at this many strikes (0 = off)', ab))),
        h('div', { class: 'card' }, h('header', h('h3', 'App version')), h('div', { class: 'body stack' }, h('div', { class: 'muted' }, 'Choose which version people should be on. Older apps show a “Download New Version” card.'), h('button', { class: 'btn', onClick: () => state.nav('release') }, 'Open App version'))),
        h('div', { class: 'card' }, h('header', h('h3', 'Admin sessions')), h('div', { class: 'body stack' }, field('Sign admins out after (minutes idle)', idle))),
        h('div', save)),
      h('div', { class: 'col' }, h('div', { class: 'card' }, h('header', h('h3', 'Reason templates')), h('div', { class: 'body' }, h('div', { class: 'hint', style: 'margin-bottom:10px' }, 'These are the ready-made reasons in the action dialogs. Admins can still type their own.'), tplBox)))));
  }

  load();
  return { refresh: load };
}
