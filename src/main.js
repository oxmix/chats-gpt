const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  screen,
  Menu,
  dialog,
  session,
  shell,
  globalShortcut
} = require('electron');
const path = require('path');
const fs = require("fs");

let win;
let activeView;

const views = [
  {
    url: 'https://chatgpt.com',
    proxy: true,
    view: null,
  }, {
    url: 'https://grok.com',
    proxy: true,
    view: null,
  }, {
    url: 'https://chat.deepseek.com',
    proxy: false,
    view: null,
  }, {
    url: 'https://chat.qwen.ai',
    proxy: false,
    view: null,
  },
]

const userDataPath = app.getPath('userData')
const settingsFile = path.join(userDataPath, 'settings.json')

async function createWindow() {
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({}));
  }

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

  await win.loadFile(path.join(__dirname, 'app.html'))

  win.on('resize', () => {
    if (activeView) {
      const [width, height] = win.getSize();
      activeView.setBounds({x: 0, y: 50, width: width, height: height - 80});
    }
  });

  const focus = () => {
    globalShortcut.register('CommandOrControl+F', () => {
      if (activeView) {
        win.webContents.send('focus-search')
      }
    })
    // intercept F5
    globalShortcut.register('F5', () => {
      if (activeView) {
        activeView.webContents.reload()
      }
    })
    // intercept Cmd+R (macOS) or Ctrl+R (Windows/Linux)
    globalShortcut.register('CommandOrControl+R', () => {
      if (activeView) {
        activeView.webContents.reload()
      }
    })
  }
  focus()
  win.on('focus', focus)
  win.on('blur', () => {
    globalShortcut.unregisterAll()
  })

  runGpt()
}

function switchTab(tabNumber) {
  console.log("click tab:", tabNumber)
  const [width, height] = win.getSize()

  if (activeView) {
    activeView.setBounds({x: 0, y: -1e6, width: 0, height: 0});
  }
  views[tabNumber].view.setBounds({x: 0, y: 50, width: width, height: height - 80})
  activeView = views[tabNumber].view
}

function setHeadersForView(view, userAgent) {
  userAgent = userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.6613.162';
  view.webContents.setUserAgent(userAgent);

  view.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = userAgent;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  })
}

function disableWebRTC(view) {
  view.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(false);
    } else {
      callback(true);
    }
  })
}

function setProxyForView(view) {
  const ses = view.view.webContents.session;
  let proxy
  try {
    const url = new URL(view.proxy.trim());
    proxy = {type: url.protocol, user: url.username, pass: url.password, host: url.hostname, port: url.port}
  } catch (err) {
    console.error('Error parsing the URL:', err);

    dialog.showErrorBox('Error parsing the URL', err.toString());
    return false
  }

  view.view.webContents.on('login', (event, request, authInfo, callback) => {
    event.preventDefault();
    console.log("Is auth proxy:", authInfo.isProxy);
    if (authInfo.isProxy) {
      console.log(`Providing credentials for tab ${view.url}: ${proxy.user}`);
      callback(proxy.user, proxy.pass)
    } else {
      callback()
    }
  });

  console.log(`${proxy.type}//${proxy.host}:${proxy.port}`)

  return ses.setProxy({
    proxyRules: `${proxy.type}//${proxy.host}:${proxy.port}`
  }).then(() => {
    console.log(`Proxy set for view: ${proxy.type}://${proxy.host}:${proxy.port}`);
    return view.view.webContents.loadURL(view.url)
  }).catch(err => {
    console.error('Failed proxy:', err);
    dialog.showErrorBox('Failed proxy:', err.toString());
  })
}

function runGpt() {
  const data = JSON.parse(fs.readFileSync(settingsFile));
  const {width, height} = screen.getPrimaryDisplay().workAreaSize;

  views.forEach((e, k) => {
    e.view = new BrowserView({webPreferences: {session: session.fromPartition('persist:view' + k)}})
    e.view.setBounds({x: 0, y: 50, width: width * 0.6, height: (height * 0.7) - 80})
    win.addBrowserView(e.view)
    setHeadersForView(e.view, data.userAgent)
    disableWebRTC(e.view)
    e.view.setBackgroundColor('white')

    if (e.proxy && data.proxy) {
      e.proxy = data.proxy
      setProxyForView(e)
    } else {
      e.view.webContents.loadURL(e.url)
    }

    // handler links
    e.view.webContents.setWindowOpenHandler(({url}) => {
      shell.openExternal(url).then();
      return {action: 'deny'};
    });

    if (k === 0) {
      activeView = views[0].view
    } else {
      e.view.setBounds({x: 0, y: -1e6, width: 0, height: 0})
    }
  })

  return true
}

ipcMain.on('switch-tab', (event, tabNumber) => {
  switchTab(tabNumber);
})

ipcMain.on('open-settings', (event) => {
  const winSettings = new BrowserWindow({
    width: Math.floor(600),
    height: Math.floor(360),
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

  const data = JSON.parse(fs.readFileSync(settingsFile));
  winSettings.webContents.send('load-data', {
    proxy: data.proxy || '',
    userAgent: data.userAgent || ''
  })

  winSettings.loadFile(path.join(__dirname, 'settings.html'))
})

ipcMain.on('open-github', (event) => {
  shell.openExternal('https://github.com/oxmix/chats-gpt').then()
})

ipcMain.on('start-search', (event, text, direction) => {
  if (!activeView || !text.length) {
    return
  }
  console.log('start-search:', text)
  let opts = {}
  if (direction === 'forward') {
    opts.forward = direction === 'forward'
  }
  activeView.webContents.findInPage(text, opts);

  activeView.webContents.on('found-in-page', (event, result) => {
    win.webContents.send('found-in-page', result.matches);
  });
});

ipcMain.on('stop-search', () => {
  if (activeView) {
    activeView.webContents.stopFindInPage('clearSelection');
  }
});

ipcMain.on('save-data', (event, data) => {
  fs.writeFileSync(settingsFile, JSON.stringify(data));
  app.relaunch()
  app.quit()
})

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

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
