const {app, Menu, screen, BrowserWindow, session, ipcMain, dialog} = require('electron');
const fs = require('fs');
const path = require('path');

const userDataPath = app.getPath('userData')
const settingsFile = path.join(userDataPath, 'data.json')

let win

function runGpt(data, alert) {
  if (!data.userAgent) {
    if (alert) {
      dialog.showErrorBox('Error', 'User agent not set');
    }
    return false
  }

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = data.userAgent;
    callback({requestHeaders: details.requestHeaders});
  });

  let proxy
  try {
    if (!data.proxy) {
      if (alert) {
        dialog.showErrorBox('Error', 'Proxy not set');
      }
      return false
    }
    const url = new URL(data.proxy.trim());
    proxy = {user: url.username, pass: url.password, host: url.hostname, port: url.port}
  } catch (err) {
    console.error('Error parsing the URL:', err);

    dialog.showErrorBox('Error parsing the URL', err.toString());
    return false
  }

  session.defaultSession.setProxy({
    proxyRules: `https://${proxy.host}:${proxy.port}`
  }).then(() => {
    win.loadURL('https://chatgpt.com');
  });

  // check auth proxy
  win.webContents.on('login', (event, request, authInfo, callback) => {
    event.preventDefault();

    console.log("Is auth proxy:", authInfo.isProxy)
    if (authInfo.isProxy) {
      callback(proxy.user, proxy.pass);
    } else {
      callback();
    }
  });

  return true
}

async function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: Math.floor(width * 0.6),
    height: Math.floor(height * 0.7),
    icon: path.join(__dirname, 'assets', 'AppIcon.icns'),
    webPreferences: {
      devtools: true,
      nodeIntegration: false,
      webviewTag: false,
      sandbox: true,
      allowRunningInsecureContent: true,
      offscreen: false,
      webSecurity: false,
      enableRemoteModule: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  if (fs.existsSync(settingsFile)) {
    const data = fs.readFileSync(settingsFile);
    if (runGpt(JSON.parse(data), false)) {
      return
    }
  }

  win.loadFile(path.join(__dirname, 'index.html'))
  win.webContents.send('load-data', {
    proxy: '',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.162 Safari/537.36'
  })
}


ipcMain.on('save-data', (event, data) => {
  fs.writeFileSync(settingsFile, JSON.stringify(data));
  runGpt(data, true)
});

app.whenReady().then(() => {
  const template = [
    {
      label: 'Menu',
      submenu: [
        {
          label: 'Delete settings (reset proxy)',
          click: () => {
            fs.unlink(settingsFile, err => {
              if (err) {
                console.error('Err delete file:', err);
              } else {
                app.quit()
              }
            })
          }
        },
        {
          label: 'Delete all user data (uninstall)',
          click: () => {
            fs.rm(userDataPath, { recursive: true, force: true }, (err) => {
              if (err) {
                console.error('Err user data folder:', err);
              } else {
                app.quit()
              }
            });
          }
        },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  createWindow()
});

app.on('window-all-closed', () => app.quit());
