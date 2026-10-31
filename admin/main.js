'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, clipboard, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

/**
 * HelpHive Admin: main process.
 * - The sign-in token lives only in this process's memory. The page never sees it
 *   and nothing is written to disk, so closing the app signs you out.
 * - Every request to the server goes through here (no CORS, one place to enforce rules).
 */

const isDev = process.argv.includes('--dev');
const SETTINGS = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS(), 'utf8')); } catch { return {}; }
}
function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  fs.mkdirSync(path.dirname(SETTINGS()), { recursive: true });
  fs.writeFileSync(SETTINGS(), JSON.stringify(next, null, 2));
  return next;
}

// default server: HELPHIVE_API env, otherwise whatever was used last time
const defaultServer = () => process.env.HELPHIVE_API || readSettings().serverUrl || '';

let win = null;
let token = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
}

function createWindow() {
  const s = readSettings();
  win = new BrowserWindow({
    width: s.bounds?.width ?? 1440,
    height: s.bounds?.height ?? 900,
    x: s.bounds?.x,
    y: s.bounds?.y,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#0b0b0c',
    title: 'HelpHive Admin',
    icon: path.join(__dirname, 'build', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0b0b0c', symbolColor: '#d8d8da', height: 36 },
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: isDev,
    },
  });
  if (s.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // the page may not open windows or navigate away
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  const save = () => {
    if (!win || win.isDestroyed()) return;
    writeSettings({ maximized: win.isMaximized(), ...(win.isMaximized() ? {} : { bounds: win.getBounds() }) });
  };
  win.on('close', save);
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  const go = (id) => () => win?.webContents.send('nav', id);
  const tabs = [
    ['Dashboard', 'dashboard'], ['Users', 'users'], ['Content', 'content'], ['Events', 'events'],
    ['Inbox', 'inbox'], ['Control', 'control'], ['Audit log', 'logs'], ['Team', 'team'], ['Settings', 'settings'], ['System', 'system'],
  ];
  const template = [
    { label: 'File', submenu: [
      { label: 'Refresh', accelerator: 'F5', click: () => win?.webContents.send('refresh') },
      { label: 'Lock and sign out', accelerator: 'CmdOrCtrl+L', click: () => win?.webContents.send('lock') },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'Alt+F4', role: 'quit' },
    ] },
    { label: 'Go', submenu: [
      { label: 'Command palette', accelerator: 'CmdOrCtrl+K', click: () => win?.webContents.send('palette') },
      { label: 'Find user', accelerator: 'CmdOrCtrl+F', click: () => win?.webContents.send('find-user') },
      { type: 'separator' },
      ...tabs.map(([label, id], i) => ({ label, accelerator: `CmdOrCtrl+${(i + 1) % 10}`, click: go(id) })),
    ] },
    { label: 'View', submenu: [
      { role: 'resetZoom' }, { role: 'zoomIn', accelerator: 'CmdOrCtrl+=' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
      ...(isDev ? [{ role: 'toggleDevTools' }] : []),
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
function cleanBase(url) {
  let u = String(url || '').trim().replace(/\/+$/, '');
  if (!u) throw new Error('Enter the server address first.');
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  const parsed = new URL(u);
  const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !local) throw new Error('The server address must use https.');
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

async function call(base, method, route, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(`${base}/admin${route}`, {
      method,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      return { ok: false, status: res.status, error: data?.error || `The server answered ${res.status}.` };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? 'The server took too long. If it is a free instance it may be waking up; try again in a moment.'
      : 'Cannot reach the server. Check the address and your connection.';
    return { ok: false, status: 0, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

ipcMain.handle('config:get', () => ({
  serverUrl: defaultServer(),
  email: readSettings().email || '',
  version: app.getVersion(),
  platform: process.platform,
}));

ipcMain.handle('auth:login', async (_e, { server, email, password }) => {
  let base;
  try { base = cleanBase(server); } catch (err) { return { ok: false, status: 0, error: err.message }; }
  token = null;
  const r = await call(base, 'POST', '/auth/login', { email, password });
  if (r.ok) {
    token = r.data.token;
    writeSettings({ serverUrl: base, email });
    return { ok: true, data: { admin: r.data.admin, server: base } };
  }
  return r;
});

ipcMain.handle('auth:logout', async () => {
  const base = readSettings().serverUrl;
  if (token && base) await call(base, 'POST', '/auth/logout').catch(() => {});
  token = null;
  return { ok: true };
});

ipcMain.handle('api', async (_e, { method, route, body }) => {
  const base = readSettings().serverUrl;
  if (!token || !base) return { ok: false, status: 401, error: 'Please sign in.' };
  if (typeof route !== 'string' || !route.startsWith('/')) return { ok: false, status: 400, error: 'Bad request.' };
  const r = await call(base, String(method || 'GET').toUpperCase(), route, body);
  if (r.status === 401) token = null;
  return r;
});

ipcMain.handle('file:save', async (_e, { name, content }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters: [{ name: 'CSV', extensions: ['csv'] }] });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(r.filePath, '\ufeff' + content, 'utf8'); // BOM so Excel reads UTF-8
  return { ok: true, path: r.filePath };
});

ipcMain.handle('clipboard:write', (_e, text) => { clipboard.writeText(String(text)); return true; });
ipcMain.handle('shell:show', (_e, p) => { shell.showItemInFolder(String(p)); });

// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { token = null; app.quit(); });
