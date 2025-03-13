const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('electron', {
  saveData: (data) => ipcRenderer.send('save-data', data),
  onLoadData: (callback) => ipcRenderer.on('load-data', (event, data) => callback(data)),
  on: (channel, listener) => {
    ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
  },
  startSearch: (text) => ipcRenderer.send('start-search', text),
  stopSearch: () => ipcRenderer.send('stop-search'),
  switchTab: (tabNumber) => ipcRenderer.send('switch-tab', tabNumber),
  openSettings: () => ipcRenderer.send('open-settings'),
  openGithub: () => ipcRenderer.send('open-github')
});
