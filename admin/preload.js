'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hh', {
  config: () => ipcRenderer.invoke('config:get'),
  login: (p) => ipcRenderer.invoke('auth:login', p),
  logout: () => ipcRenderer.invoke('auth:logout'),
  api: (method, route, body) => ipcRenderer.invoke('api', { method, route, body }),
  saveFile: (name, content) => ipcRenderer.invoke('file:save', { name, content }),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  showInFolder: (p) => ipcRenderer.invoke('shell:show', p),
  on: (channel, fn) => {
    const allowed = ['nav', 'refresh', 'lock', 'palette', 'find-user'];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_e, ...args) => fn(...args));
  },
});
