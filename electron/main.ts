import { app, BrowserWindow, Menu, shell } from 'electron';
import * as path from 'path';
import { spawn } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let nextServerProcess: any = null;

const PORT = 3111;

// 启动 Next.js 服务器
const startNextServer = () => {
  return new Promise<void>((resolve, reject) => {
    const serverPath = path.join(__dirname, '../node_modules/.bin/next');
    const args = ['start', '-p', PORT.toString()];

    nextServerProcess = spawn(serverPath, args, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    nextServerProcess.on('error', (err: Error) => {
      console.error('Failed to start Next.js server:', err);
      reject(err);
    });

    nextServerProcess.on('exit', (code: number) => {
      if (code !== 0) {
        console.error(`Next.js server exited with code ${code}`);
      }
    });

    // 等待服务器启动
    setTimeout(() => {
      resolve();
    }, 3000);
  });
};

const createWindow = async () => {
  // 启动 Next.js 服务器
  await startNextServer().catch(err => {
    console.error('Failed to start server:', err);
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false,
  });

  // 加载应用 - 从本地服务器加载
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 创建菜单
  createMenu();
};

const createMenu = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '音乐情绪识别',
      submenu: [
        { label: '关于', role: 'about' },
        { type: 'separator' },
        { label: '隐藏', role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '全部显示', role: 'unhide' },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '查看',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        { type: 'separator' },
        { label: '前置窗口', role: 'front' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '使用帮助',
          click: () => {
            shell.openExternal('https://github.com/yourusername/music-emotion-recognition');
          },
        },
      ],
    },
  ];

  // macOS 应用菜单调整
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { label: '关于', role: 'about' },
        { type: 'separator' },
        { label: '设置', accelerator: 'Cmd+,', click: () => {} },
        { type: 'separator' },
        { label: '服务', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: '隐藏', role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '全部显示', role: 'unhide' },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// 应用生命周期
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // macOS 点击 dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS 除外，其他平台关闭所有窗口时退出应用
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 关闭 Next.js 服务器
  if (nextServerProcess) {
    nextServerProcess.kill();
  }
});

// 处理外部链接
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.protocol !== 'file:') {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'file:') {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
});
