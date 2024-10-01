const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  saveData: (data) => ipcRenderer.send('save-data', data),
  onLoadData: (callback) => ipcRenderer.on('load-data', (event, data) => callback(data)),
});
