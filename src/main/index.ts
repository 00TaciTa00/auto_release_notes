import { app, BrowserWindow, shell, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { initDb } from '../db/index'
import { registerAllHandlers } from './ipc/index'
import { startWebhookServer, stopWebhookServer } from './webhook/server'
import { logger } from '../shared/logger'

/**
 * 트레이 아이콘 — 16×16 초록(#4CAF50) PNG (base64 인라인)
 *
 * electron-builder 빌드 시 resources/ 파일 경로에 의존하지 않도록
 * 코드에 직접 포함합니다.
 */
const TRAY_ICON_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGPwWR9AEmIY1TCqYfhqAAD0tksQZKVeqgAAAABJRU5ErkJggg=='

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

/** 시스템 트레이 아이콘과 컨텍스트 메뉴를 설정합니다. */
function createTray(): void {
  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON_B64}`)
  tray = new Tray(icon)
  tray.setToolTip('Sosik — 업데이트 노트 자동 생성')

  const menu = Menu.buildFromTemplate([
    {
      label: '열기',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        tray?.destroy()
        tray = null
        app.quit()
      },
    },
  ])

  tray.setContextMenu(menu)

  // 더블클릭으로 창 복원 (Windows/Linux)
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true, // H-6: Electron 보안 모범 사례
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 창 닫기(X) 시 종료 대신 트레이로 최소화
  mainWindow.on('close', (event) => {
    if (tray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  try {
    initDb()
  } catch (err) {
    logger.error('DB 초기화 실패 — 앱 종료', { err: String(err) })
    app.quit()
    return
  }

  registerAllHandlers()
  startWebhookServer()
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 트레이가 있으면 모든 창이 닫혀도 앱 유지
app.on('window-all-closed', () => {
  if (!tray && process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopWebhookServer()
  tray?.destroy()
  tray = null
})
