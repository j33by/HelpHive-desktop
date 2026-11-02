import { h, get, api, clear, loading, errorBox, toast, fail, field, busy, fdt, icon } from '../lib.js';

export default function release(root) {
  const head = h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', 'App version'), h('div', { class: 'sub' }, 'Tell every app which version is the newest. Older apps show a “Download New Version” card.')));
  const body = h('div', { class: 'page-body' });
  root.append(head, body);

  async function load() {
    clear(body).append(loading(6));
    try { draw((await get('/release')).release); } catch (e) {
      clear(body).append(e.status === 404 || e.status === 403
        ? h('div', { class: 'card' }, h('div', { class: 'body stack' },
          h('b', 'Your server does not have this feature yet'),
          h('div', { class: 'muted' }, 'The server running on Render is an older version. Replace its code with the latest server folder, redeploy, then sign out and in again.'),
          h('div', { class: 'note' }, 'Quick check: open  your-server-address/app-version  in a browser. If you see {"latestVersion":null} the server is up to date. If you see an error page, it is not.'),
          h('button', { class: 'btn', onClick: load }, 'Try again')))
        : errorBox(e, load));
    }
  }

  function draw(r) {
    const version = h('input', { class: 'input', value: r.latestVersion ?? '', placeholder: 'e.g. 1.0.6', maxlength: 14, spellcheck: false });
    const notes = h('textarea', { class: 'textarea', maxlength: 500, style: 'min-height:72px', placeholder: 'What is new? One or two lines. Shown on the card.' }, r.notes ?? '');
    const url = h('input', { class: 'input', value: r.downloadUrl, spellcheck: false });
    const on = h('input', { type: 'checkbox', checked: r.enabled });
    const preview = h('div');
    const draw = () => preview.replaceChildren(h('div', { class: 'preview', style: 'background:var(--panel-2)' },
      h('span', { class: 'cap' }, 'What people with an older app see'),
      h('div', { style: 'font-weight:600;font-size:14px' }, version.value ? `Version ${version.value} is available` : 'No update is being announced'),
      notes.value ? h('div', { class: 'muted', style: 'margin-top:4px' }, notes.value) : null,
      version.value ? h('div', { style: 'margin-top:10px' }, h('span', { class: 'badge solid' }, 'Download New Version'), ' ', h('span', { class: 'badge mute' }, 'Close'), ' ', h('span', { class: 'badge mute' }, 'Don’t show again')) : null));
    [version, notes].forEach((e) => e.addEventListener('input', draw));
    draw();

    const save = h('button', { class: 'btn primary', onClick: async () => {
      try {
        await busy(save, () => api('PUT', '/release', { latestVersion: version.value.trim(), notes: notes.value, downloadUrl: url.value.trim(), enabled: on.checked }));
        toast(version.value.trim() ? `Apps older than ${version.value.trim()} will now show the update card.` : 'Update prompt switched off.');
        load();
      } catch (e) { fail(e); }
    } }, 'Publish');

    clear(body).append(h('div', { class: 'grid g-2', style: 'align-items:start' },
      h('div', { class: 'card' }, h('header', h('h3', 'Latest version')), h('div', { class: 'body col', style: 'gap:12px' },
        field('Latest version', version, 'Must match the version in app/pubspec.yaml of the build you published (for example 1.0.6). Leave empty to ask nobody to update.'),
        field('What is new (optional)', notes),
        field('Download page', url, 'People are sent here. It must start with https://'),
        h('label', { class: 'chk' }, on, 'Show the update card'),
        preview,
        h('div', { class: 'row' }, save),
        r.updatedAt ? h('div', { class: 'hint' }, `Last changed ${fdt(r.updatedAt)} by ${r.updatedBy ?? 'unknown'}`) : null)),
      h('div', { class: 'card' }, h('header', h('h3', 'How it works')), h('div', { class: 'body stack' },
        h('div', { class: 'note' }, h('b', 'Every platform. '), 'Android, Windows and any other build of the HelpHive app read the same setting. The admin console itself never shows this card.'),
        h('div', { class: 'note' }, h('b', 'Only older apps. '), 'An app is “older” when its own version number is lower than the one you publish here. Apps on the same or a newer version see nothing.'),
        h('div', { class: 'note' }, h('b', 'Close and don’t show again. '), 'Close hides the card until the app is opened again. “Don’t show again” hides it for this version only; the next version you publish shows it again.'),
        h('div', { class: 'note' }, h('b', 'Before you publish. '), 'Upload the new build to the download page first, then publish the version here.')))));
  }

  load();
  return { refresh: load };
}
