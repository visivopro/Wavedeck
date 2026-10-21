// Bridge between the UI and the main process. Everything the UI can do to the
// system goes through this list.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke = (ch) => (...args) => ipcRenderer.invoke(ch, ...args);
const on = (ch) => (fn) => {
  const h = (e, ...args) => fn(...args);
  ipcRenderer.on(ch, h);
  return () => ipcRenderer.removeListener(ch, h);
};

contextBridge.exposeInMainWorld('wavedeck', {
  openFiles: invoke('dialog:openFiles'),
  openFolder: invoke('dialog:openFolder'),
  openPlaylist: invoke('dialog:openPlaylist'),
  savePlaylist: invoke('dialog:savePlaylist'),
  openSkin: invoke('dialog:openSkin'),
  saveFile: invoke('dialog:saveFile'),
  message: invoke('dialog:message'),
  expand: invoke('fs:expand'),
  readBinary: invoke('fs:readBinary'),
  showInFolder: invoke('fs:showInFolder'),
  pathForFile: (file) => (webUtils ? webUtils.getPathForFile(file) : file.path),
  readMeta: invoke('meta:read'),
  cover: invoke('meta:cover'),
  getSettings: invoke('settings:get'),
  setSettings: invoke('settings:set'),
  onSettings: on('settings:changed'),
  listSkins: invoke('skins:list'),
  openSkinsDir: invoke('skins:dir'),
  saveSkin: invoke('skins:save'),
  lib: {
    get: invoke('lib:get'),
    addFolder: invoke('lib:addFolder'),
    addFolderPath: invoke('lib:addFolderPath'),
    removeFolder: invoke('lib:removeFolder'),
    scan: invoke('lib:scan'),
    setServers: invoke('lib:setServers'),
    onProgress: on('lib:progress'),
    onChanged: on('lib:changed'),
  },
  plugins: {
    list: invoke('plugins:list'),
    openDir: invoke('plugins:dir'),
    writeText: invoke('plugins:writeText'),
  },
  md5: invoke('util:md5'),
  openExternal: invoke('util:openExternal'),
  popupMenu: invoke('util:popupMenu'),
  win: {
    setSize: invoke('win:setSize'),
    setPos: (x, y) => ipcRenderer.invoke('win:setPos', x, y),
    setBounds: invoke('win:setBounds'),
    workArea: invoke('win:workArea'),
    minimize: invoke('win:minimize'),
    close: invoke('win:close'),
    alwaysOnTop: invoke('win:alwaysOnTop'),
    fullscreen: invoke('win:fullscreen'),
    focusMain: invoke('win:focusMain'),
  },
  version: invoke('app:version'),
  onOpenFiles: on('open-files'),
  onMediaKey: on('media-key'),
});
