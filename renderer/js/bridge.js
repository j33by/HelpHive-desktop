/* Runs the console outside Electron (Android app via Capacitor, or a plain browser).
 * In Electron the preload already defines window.hh, so this file does nothing there.
 * The sign-in token lives only in this variable: closing the app signs you out. */
(function () {
  if (window.hh) return;
  document.documentElement.classList.add('web');

  var token = null;
  var STORE = 'helphive-admin';
  var VERSION = '1.0.0';
  var cap = window.Capacitor;
  var native = Boolean(cap && cap.isNativePlatform && cap.isNativePlatform());

  function read() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; } }
  function write(patch) { var n = Object.assign(read(), patch); try { localStorage.setItem(STORE, JSON.stringify(n)); } catch (e) { /* private mode */ } return n; }
  function plugin(name) { return cap && ((cap.Plugins && cap.Plugins[name]) || (cap.registerPlugin ? cap.registerPlugin(name) : null)); }

  function cleanBase(url) {
    var u = String(url || '').trim().replace(/\/+$/, '');
    if (!u) throw new Error('Enter the server address first.');
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    var p = new URL(u);
    var local = p.hostname === 'localhost' || p.hostname === '127.0.0.1';
    if (p.protocol !== 'https:' && !local) throw new Error('The server address must use https.');
    return p.origin + p.pathname.replace(/\/+$/, '');
  }

  async function call(base, method, route, body) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 60000);
    try {
      var headers = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = 'Bearer ' + token;
      var res = await fetch(base + '/admin' + route, { method: method, signal: ctrl.signal, headers: headers, body: body !== undefined ? JSON.stringify(body) : undefined });
      var text = await res.text();
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      if (!res.ok) return { ok: false, status: res.status, error: (data && data.error) || 'The server answered ' + res.status + '.' };
      return { ok: true, status: res.status, data: data };
    } catch (err) {
      return { ok: false, status: 0, error: err && err.name === 'AbortError'
        ? 'The server took too long. If it is a free instance it may be waking up; try again in a moment.'
        : 'Cannot reach the server. Check the address and your connection.' };
    } finally { clearTimeout(timer); }
  }

  var listeners = {};

  window.hh = {
    isElectron: false,
    config: async function () { var s = read(); return { serverUrl: s.serverUrl || '', email: s.email || '', version: VERSION, platform: native ? 'android' : 'web' }; },
    login: async function (p) {
      var base;
      try { base = cleanBase(p.server); } catch (e) { return { ok: false, status: 0, error: e.message }; }
      token = null;
      var r = await call(base, 'POST', '/auth/login', { email: p.email, password: p.password });
      if (r.ok) { token = r.data.token; write({ serverUrl: base, email: p.email }); return { ok: true, data: { admin: r.data.admin, server: base } }; }
      return r;
    },
    logout: async function () {
      var base = read().serverUrl;
      if (token && base) await call(base, 'POST', '/auth/logout').catch(function () {});
      token = null;
      return { ok: true };
    },
    api: async function (method, route, body) {
      var base = read().serverUrl;
      if (!token || !base) return { ok: false, status: 401, error: 'Please sign in.' };
      if (typeof route !== 'string' || route[0] !== '/') return { ok: false, status: 400, error: 'Bad request.' };
      var r = await call(base, String(method || 'GET').toUpperCase(), route, body);
      if (r.status === 401) token = null;
      return r;
    },
    saveFile: async function (name, content) {
      var text = '\ufeff' + content;
      var fs = native && plugin('Filesystem'), share = native && plugin('Share');
      if (fs && share) {
        try {
          var w = await fs.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
          await share.share({ title: name, url: w.uri, dialogTitle: 'Save or send ' + name });
          return { ok: true, path: name };
        } catch (e) { if (/cancel/i.test(String(e && e.message))) return { ok: false, canceled: true }; }
      }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      return { ok: true, path: name };
    },
    copy: async function (text) {
      try { await navigator.clipboard.writeText(String(text)); } catch (e) {
        var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
      }
      return true;
    },
    showInFolder: async function () {},
    on: function (channel, fn) { (listeners[channel] = listeners[channel] || []).push(fn); },
    _emit: function (channel) { (listeners[channel] || []).forEach(function (fn) { fn(); }); },
  };

  // Android back button: close dialogs first, then the menu, then go back to the dashboard, then leave.
  var app = native && plugin('App');
  if (app && app.addListener) {
    app.addListener('backButton', function () {
      var modals = document.querySelectorAll('.modal-wrap');
      if (modals.length) { var c = modals[modals.length - 1]; c.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return; }
      var cmd = document.querySelector('.cmd'); if (cmd) { cmd.parentElement.remove(); return; }
      var drawer = document.querySelector('.scrim'); if (drawer) { drawer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return; }
      var nav = document.getElementById('nav');
      if (nav && nav.classList.contains('open')) { nav.classList.remove('open'); var s = document.getElementById('navscrim'); if (s) s.classList.remove('open'); return; }
      var dash = document.querySelector('#nav a[data-id=dashboard]');
      if (dash && !dash.classList.contains('on')) { dash.click(); return; }
      if (app.exitApp) app.exitApp();
    });
  }
})();
