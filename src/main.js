const {app, Menu, screen, BrowserWindow, session, ipcMain, dialog, shell} = require('electron');
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

    // custom search cmd/ctrl+f
    ipcMain.on('start-search', (event, text, direction) => {
      if (!win || !text.length) {
        return
      }
      let opts = {}
      if (direction === 'forward') {
        opts.forward = direction === 'forward'
      }
      win.webContents.findInPage(text, opts);
    });

    ipcMain.on('stop-search', () => {
      if (win) {
        win.webContents.stopFindInPage('clearSelection');
      }
    });

    win.webContents.on('did-finish-load', () => {
      win.webContents.executeJavaScript(`
      window.addEventListener("keydown", e => {
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
          e.preventDefault();
          let searchBar = document.getElementById("customSearchBar");
          if (searchBar) {
            return
          }
          searchBar = document.createElement('div');
          searchBar.innerHTML = \`
            <input type="text" id="searchInput" placeholder="Search..." style="width: 200px; padding: 5px; color: #333 !important;">
            <button id="nextButton" style="padding: 5px 10px; background: rgba(255, 255, 255, 0.5); margin-left: 8px; color: #333;">></button>
            <button id="previousButton" style="padding: 5px 10px; background: rgba(255, 255, 255, 0.5); margin-left: 8px; color: #333;"><</button>
            <button id="closeSearch" style="padding: 5px 10px; background: rgba(255, 255, 255, 0.5); margin-left: 8px; color: #333;">×</button>
            <div style="color: #333;padding: 6px 0 0;">Found: <span id="found-in-page">–</span></div>
          \`;
          searchBar.style.cssText = 'position: fixed;top: 26px;background: rgba(255, 255, 255, .8);border-radius: 12px;padding: 16px 18px;z-index: 1000000;left: 0;right: 0;width: 365px;margin: auto;';
          searchBar.id = 'customSearchBar';
          document.body.appendChild(searchBar);
          const input = document.getElementById('searchInput');
          input.focus();
          input.addEventListener('keydown', ev => {
            if (13 == ev.keyCode) {
                window.electron.startSearch(input.value);
            }
          });
          document.getElementById('nextButton').addEventListener('click', () => {
            window.electron.startSearch(input.value, 'forward');
          });
          document.getElementById('previousButton').addEventListener('click', () => {
            window.electron.startSearch(input.value, 'back');
          });
          document.getElementById('closeSearch').addEventListener('click', () => {
            searchBar.remove();
            window.electron.stopSearch();
          });
        }
      });`);
    });

    win.webContents.on('found-in-page', (event, result) => {
      win.webContents.executeJavaScript(`
        document.getElementById('found-in-page').innerText = ` + (result.matches - 1) + `;
      `)
    });
  });

  // handler links
  win.webContents.setWindowOpenHandler(({url}) => {
    shell.openExternal(url).then();
    return {action: 'deny'};
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
  const {width, height} = screen.getPrimaryDisplay().workAreaSize;

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

  await win.loadFile(path.join(__dirname, 'index.html'))
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
            fs.rm(userDataPath, {recursive: true, force: true}, (err) => {
              if (err) {
                console.error('Err user data folder:', err);
              } else {
                app.quit()
              }
            });
          }
        },
        {role: 'quit'}
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {role: 'undo'},
        {role: 'redo'},
        {type: 'separator'},
        {role: 'cut'},
        {role: 'copy'},
        {role: 'paste'},
        {role: 'pasteAndMatchStyle'},
        {role: 'delete'},
        {role: 'selectAll'}
      ]
    },
    {
      label: 'View',
      submenu: [
        {role: 'reload'},
        {role: 'forcereload'},
        {role: 'toggledevtools'},
        {type: 'separator'},
        {role: 'resetzoom'},
        {role: 'zoomin'},
        {role: 'zoomout'},
        {type: 'separator'},
        {role: 'togglefullscreen'}
      ]
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  createWindow()
});

app.on('window-all-closed', () => app.quit());
