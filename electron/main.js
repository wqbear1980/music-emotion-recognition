"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
let mainWindow = null;
let nextServerProcess = null;
const PORT = 3111;
// 启动 Next.js 服务器
const startNextServer = () => {
    return new Promise((resolve, reject) => {
        const serverPath = path.join(__dirname, '../node_modules/.bin/next');
        const args = ['start', '-p', PORT.toString()];
        nextServerProcess = (0, child_process_1.spawn)(serverPath, args, {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit',
            shell: process.platform === 'win32',
        });
        nextServerProcess.on('error', (err) => {
            console.error('Failed to start Next.js server:', err);
            reject(err);
        });
        nextServerProcess.on('exit', (code) => {
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
    mainWindow = new electron_1.BrowserWindow({
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
    const template = [
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
                        electron_1.shell.openExternal('https://github.com/yourusername/music-emotion-recognition');
                    },
                },
            ],
        },
    ];
    // macOS 应用菜单调整
    if (process.platform === 'darwin') {
        template.unshift({
            label: electron_1.app.getName(),
            submenu: [
                { label: '关于', role: 'about' },
                { type: 'separator' },
                { label: '设置', accelerator: 'Cmd+,', click: () => { } },
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
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
};
// 应用生命周期
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        // macOS 点击 dock 图标时重新创建窗口
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    // macOS 除外，其他平台关闭所有窗口时退出应用
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    // 关闭 Next.js 服务器
    if (nextServerProcess) {
        nextServerProcess.kill();
    }
});
// 处理外部链接
electron_1.app.on('web-contents-created', (_, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.protocol !== 'file:') {
            event.preventDefault();
            electron_1.shell.openExternal(navigationUrl);
        }
    });
    contents.setWindowOpenHandler(({ url }) => {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'file:') {
            electron_1.shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
});
