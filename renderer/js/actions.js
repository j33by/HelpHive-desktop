// The one dialog every moderation action goes through: pick or type a reason,
// see exactly what the person will read, confirm.
import { h, api, modal, field, toast, fail, copyButton, ACTION_LABEL, fdt } from './lib.js';
import { state } from './state.js';

const CFG = {
  warn:          { title: 'Send a warning', go: 'Send warning', tpl: 'warn', note: 'A warning is a message only. It does not limit the account.' },
  restrict:      { title: 'Restrict account', go: 'Restrict account', tpl: 'restrict', danger: true },
  unrestrict:    { title: 'Lift restriction', go: 'Lift restriction', tpl: 'unrestrict' },
  ban:           { title: 'Ban account', go: 'Ban account', tpl: 'ban', danger: true, note: 'The person will only see a “your account is banned” screen with this reason. Their posts and profile are hidden from everyone else.' },
  unban:         { title: 'Unban account', go: 'Unban account', tpl: 'unban' },
  strike:        { title: 'Add a strike', go: 'Add strike', tpl: 'strike', danger: true },
  remove_strike: { title: 'Remove a strike', go: 'Remove strike', tpl: 'remove_strike' },
  delete_post:   { title: 'Remove post', go: 'Remove post', tpl: 'delete_post', danger: true, note: 'The post and its comments are taken down. You can restore them from the Control tab.' },
  delete_comment:{ title: 'Remove comment', go: 'Remove comment', tpl: 'delete_comment', danger: true, note: 'Replies under it go too. You can restore it from the Control tab.' },
  email:         { title: 'Change email address', go: 'Change email', tpl: 'email_change' },
  password:      { title: 'Change password', go: 'Change password', tpl: 'password_change', danger: true },
  delete_account:{ title: 'Delete account', go: 'Delete account permanently', tpl: 'account_delete', danger: true },
};
const ENVELOPE_KEY = { email: 'email_change', password: 'password_change' };

function willDeliver(type, standing) {
  if (type === 'restrict' || type === 'unrestrict' || type === 'unban') return { yes: true };
  if (type === 'ban') return { yes: false, why: 'Banned people see the ban screen with the reason, not alerts.' };
  if (type === 'delete_account') return { yes: false, why: 'The account is deleted, so there is nobody to notify.' };
  if (standing?.status === 'banned') return { yes: false, why: 'This person is banned, so no alert is sent. The ban screen shows the ban reason.' };
  if (standing?.status === 'restricted' && !state.meta.notifyRestricted) return { yes: false, why: 'This person is restricted right now, so no alert is sent. It is recorded on their account-standing screen.' };
  return { yes: true };
}

/**
 * ctx: { user: {id, username}, standing?, info?: {nextRestrictionHours, restrictionLevel, strikes},
 *        target?: {kind, id, excerpt}, onDone }
 */
export function actionDialog(type, ctx) {
  const cfg = CFG[type];
  const meta = state.meta;
  const tplList = meta.templates[cfg.tpl] ?? [];
  const reason = h('textarea', { class: 'textarea', maxlength: 500, placeholder: 'Write what the person will read…', autofocus: true });
  const note = h('textarea', { class: 'textarea', maxlength: 500, style: 'min-height:52px', placeholder: 'Optional. Only admins see this.' });
  const count = h('div', { class: 'count' });
  const preview = h('div', { class: 'preview' });
  const delivery = h('div', { class: 'hint' });
  const extra = h('div', { class: 'col' });

  let email, password, generate, confirmName;
  if (type === 'email') {
    email = h('input', { class: 'input', type: 'email', placeholder: 'new@address.com' });
    extra.append(field('New email address', email, 'The address is marked confirmed, so the person can sign in with it straight away.'));
  }
  if (type === 'password') {
    password = h('input', { class: 'input', type: 'text', autocomplete: 'off', placeholder: 'At least 8 characters' });
    generate = h('input', { type: 'checkbox' });
    generate.addEventListener('change', () => { password.disabled = generate.checked; });
    extra.append(field('New password', password), h('label', { class: 'chk' }, generate, 'Generate a strong password for me'),
      h('div', { class: 'note' }, 'The password is shown to you once and is never stored or logged. Pass it to the person securely.'));
  }
  if (type === 'delete_account') {
    confirmName = h('input', { class: 'input', placeholder: ctx.user.username });
    extra.append(h('div', { class: 'note' }, h('b', 'This cannot be undone. '), 'Posts, comments, messages, photos and the login are erased. A record of this action stays in the audit log.'),
      field(`Type “${ctx.user.username}” to confirm`, confirmName));
  }
  if (type === 'restrict') {
    const hrs = ctx.info?.nextRestrictionHours ?? meta.restrictBaseHours;
    const lvl = ctx.info?.restrictionLevel ?? 1;
    extra.append(h('div', { class: 'note' }, h('b', `Restriction #${lvl}: ${hrs} hours. `), `They can read but not post, comment, react, message or edit their profile. It ends by itself; a repeat adds another ${meta.restrictBaseHours} hours each time (up to ${meta.restrictMaxHours} h).`));
  }
  if (type === 'strike' && meta.strikeAutoRestrictAt) {
    const n = (ctx.info?.strikes ?? 0) + 1;
    extra.append(h('div', { class: 'note' }, `This will be strike ${n}. ${n >= meta.strikeAutoRestrictAt ? 'It triggers an automatic restriction' + (meta.strikeAutoBanAt && n >= meta.strikeAutoBanAt ? ' and a ban' : '') + '.' : `At ${meta.strikeAutoRestrictAt} strikes the account is restricted automatically.`}`));
  }
  if (cfg.note) extra.append(h('div', { class: 'note' }, cfg.note));
  if (ctx.target) extra.append(h('div', { class: 'preview' }, h('span', { class: 'cap' }, ctx.target.kind === 'post' ? 'Post' : 'Comment'), ctx.target.excerpt));

  const envKey = ENVELOPE_KEY[type] ?? (type === 'delete_account' ? null : type);
  const hoursNow = ctx.info?.nextRestrictionHours ?? meta.restrictBaseHours;
  const fillVars = () => ({
    reason: reason.value.trim() || '…',
    duration: `${hoursNow} hours`,
    until: fdt(Date.now() + hoursNow * 3600e3),
    count: type === 'strike' ? (ctx.info?.strikes ?? 0) + 1 : Math.max(0, (ctx.info?.strikes ?? 1) - 1),
  });
  const refresh = () => {
    const len = reason.value.trim().length;
    count.textContent = `${len} / 500${len < 8 ? ' (min 8)' : ''}`;
    count.className = 'count' + (len > 0 && len < 8 ? ' bad' : '');
    if (!envKey) { preview.style.display = 'none'; delivery.textContent = willDeliver(type).why; return; }
    const text = meta.envelopes[envKey].replace(/\{(\w+)\}/g, (_, k) => fillVars()[k] ?? '');
    preview.replaceChildren(h('span', { class: 'cap' }, 'What the person will read'), text);
    const d = willDeliver(type, ctx.standing);
    delivery.textContent = d.yes ? 'Delivered to their alerts as soon as you confirm.' : d.why;
  };
  reason.addEventListener('input', refresh);

  const picker = tplList.length
    ? h('select', { class: 'select' }, h('option', { value: '' }, 'Choose a ready-made reason…'), tplList.map((t, i) => h('option', { value: i }, t.label)))
    : null;
  picker?.addEventListener('change', () => { if (picker.value !== '') { reason.value = tplList[picker.value].text; refresh(); reason.focus(); } });

  refresh();
  const body = [
    h('div', { class: 'row gap-12' }, h('div', { class: 'grow' }, h('div', { class: 'muted' }, ctx.user.username ? 'Account' : ''), h('b', ctx.user.username ? `@${ctx.user.username}` : ''))),
    extra,
    picker ? field('Reason', picker) : null,
    h('div', [reason, count]),
    preview, delivery,
    field('Internal note', note),
  ];

  modal({
    title: cfg.title,
    sub: type === 'password' || type === 'email' ? 'Both actions are logged with your name.' : 'Logged with your name. The reason is required.',
    body,
    actions: [
      { label: 'Cancel', value: false },
      {
        label: cfg.go, kind: cfg.danger ? 'danger' : 'primary',
        onClick: async (close) => {
          try {
            const common = { reason: reason.value.trim(), note: note.value.trim() || undefined };
            let res;
            if (type === 'delete_post') res = await api('DELETE', `/posts/${ctx.target.id}`, common);
            else if (type === 'delete_comment') res = await api('DELETE', `/comments/${ctx.target.id}`, common);
            else if (type === 'email') res = await api('POST', `/users/${ctx.user.id}/email`, { ...common, email: email.value.trim() });
            else if (type === 'password') {
              res = await api('POST', `/users/${ctx.user.id}/password`, { ...common, ...(generate.checked ? { generate: true } : { password: password.value }) });
              if (res.password) showSecret(ctx.user.username, res.password);
            } else if (type === 'delete_account') res = await api('DELETE', `/users/${ctx.user.id}`, { ...common, confirm: confirmName.value });
            else res = await api('POST', `/users/${ctx.user.id}/actions`, { ...common, type });
            close(true);
            const extraMsg = res?.also?.length ? ` Also: ${res.also.map((a) => ACTION_LABEL[a.type].toLowerCase()).join(', ')} (automatic).` : '';
            toast(`${ACTION_LABEL[type === 'email' ? 'email_change' : type === 'password' ? 'password_change' : type === 'delete_account' ? 'account_delete' : type] ?? 'Done'} recorded.${extraMsg}`);
            ctx.onDone?.(res);
          } catch (e) { fail(e); }
        },
      },
    ],
  });
}

function showSecret(username, pw) {
  modal({
    title: 'New password',
    sub: `For @${username}. This is the only time it is shown.`,
    body: [h('div', { class: 'preview mono', style: 'font-size:16px;letter-spacing:.04em;user-select:all' }, pw), copyButton(pw, 'Copy password')],
    actions: [{ label: 'Done', kind: 'primary', value: true }],
  });
}

/** Undo dialog used by Control and the user drawer. */
export function undoDialog(action, onDone) {
  const tpl = state.meta.templates.undo ?? [];
  const reason = h('textarea', { class: 'textarea', maxlength: 500, placeholder: 'Why are you reversing this?', autofocus: true });
  const picker = tpl.length ? h('select', { class: 'select' }, h('option', { value: '' }, 'Choose a ready-made reason…'), tpl.map((t, i) => h('option', { value: i }, t.label))) : null;
  picker?.addEventListener('change', () => { if (picker.value !== '') reason.value = tpl[picker.value].text; });
  modal({
    title: `Undo: ${ACTION_LABEL[action.type]}`,
    sub: `@${action.username} · done ${fdt(action.createdAt)} by ${action.adminName}`,
    body: [
      h('div', { class: 'note' }, 'Anything this action triggered automatically is undone with it. The person is told the action was reversed (unless they are banned or restricted).'),
      h('div', { class: 'preview' }, h('span', { class: 'cap' }, 'Original reason'), action.reason),
      picker ? field('Reason for undoing', picker) : null, reason,
    ],
    actions: [
      { label: 'Cancel', value: false },
      { label: 'Undo action', kind: 'primary', onClick: async (close) => {
        try {
          const r = await api('POST', `/control/actions/${action.id}/undo`, { reason: reason.value.trim() });
          close(true); toast(`Undone (${r.undone.length}).`); onDone?.(r);
        } catch (e) { fail(e); }
      } },
    ],
  });
}
