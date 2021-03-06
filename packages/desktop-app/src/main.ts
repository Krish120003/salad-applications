import * as Sentry from '@sentry/electron'
import { execSync } from 'child_process'
import { app, BrowserWindow, Input, ipcMain, Menu, nativeImage, powerMonitor, shell, Tray } from 'electron'
import { autoUpdater } from 'electron-updater'
import isOnline from 'is-online'
import { WindowsToaster } from 'node-notifier'
import * as os from 'os'
import * as path from 'path'
import * as si from 'systeminformation'
import { Config } from './config'
import * as Logger from './Logger'
import { MachineInfo } from './models/MachineInfo'
import { Profile } from './models/Profile'
import { PluginDefinition } from './salad-bowl/models/PluginDefinition'
import { PluginStatus } from './salad-bowl/models/PluginStatus'
import { PluginManager } from './salad-bowl/PluginManager'
import { SaladBridgeNotificationService } from './salad-bowl/SaladBridgeNotificationService'
import { SaladBridge } from './SaladBridge'
import { DefaultTheme as theme } from './SaladTheme'

// The path to the `/static` folder. This is provided by electron-webpack.
declare const __static: string

// Register to send Windows 10 notifications.
app.setAppUserModelId('salad-technologies-desktop-app')

// Capture unhandled errors.
Sentry.init({
  dsn: 'https://0a70874cde284d838a378e1cc3bbd963@sentry.io/1804227',
  release: app.getVersion(),
})

// Redirect `console` to the application log file.
Logger.connect()

// Ensure we have the correct path to `snoretoast.exe`. Note: Kyle _hates_ this.
var notifier = new WindowsToaster({
  withFallback: false,
  customPath: path
    .resolve(
      app.getAppPath(),
      'node_modules/node-notifier/vendor/snoreToast/snoretoast-x' + (os.arch() === 'x64' ? '64' : '86') + '.exe',
    )
    .replace('app.asar', 'app.asar.unpacked'),
})

const AutoLaunch = require('auto-launch')

const getDesktopVersion = 'get-desktop-version'
const setDesktopVersion = 'set-desktop-version'
const getIdleTime = 'get-idle-time'
const setIdleTime = 'set-idle-time'
const showNotification = 'show-notification'
const start = 'start-salad'
const stop = 'stop-salad'

let machineInfo: MachineInfo
let mainWindow: BrowserWindow
let offlineWindow: BrowserWindow
let pluginManager: PluginManager | undefined
let activeIconEnabled = false
let tray: Tray
let updateChecked = false

function glxCheckVRAM() {
  let output = execSync("glxinfo | grep -E 'VBO free memory - total:'")
  try {
    return parseInt(output.toString().match(/\d+/)[0])
  } catch (err) {
    throw err
  }
}

function clinfoCheckVRAM() {
  let output = execSync("clinfo | grep 'Global memory size'")
  try {
    return Math.round(parseInt(output.toString().match(/\d+/)[0]) / 1024 / 1024)
  } catch (err) {
    throw err
  }
}

const getMachineInfo = (): Promise<MachineInfo> => {
  return Promise.allSettled([
    si.cpu(),
    si.cpuFlags(),
    si.graphics(),
    si.memLayout(),
    si.osInfo(),
    si.services('*'),
    si.system(),
    si.uuid(),
    si.version(),
  ]).then(([cpu, cpuFlags, graphics, memLayout, osInfo, services, system, uuid, version]) => {
    let cpuData: si.Systeminformation.CpuData | si.Systeminformation.CpuWithFlagsData | undefined
    if (cpu.status === 'fulfilled') {
      if (cpuFlags.status === 'fulfilled') {
        cpuData = {
          ...cpu.value,
          flags: cpuFlags.value,
        }
      } else {
        cpuData = cpu.value
      }
    }

    // Try getting VRAM information from glxinfo and clinfo if they are available. If the VRAM detected by either of
    // those is more than what is detected by systeminformation, replace the vram amount.
    // NOTE: Only tested on 1 GPU, hence the limitation of checking and replacing only if 1 GPU was found.
    if (graphics.status === 'fulfilled') {
      if (graphics.value.controllers.length === 1) {
        try {
          let glxVram = glxCheckVRAM()
          if (glxVram > graphics.value.controllers[0].vram) {
            graphics.value.controllers[0].vram = glxVram
          }
        } catch (err) {
          console.error(err)
        }
        try {
          let clinfoVram = clinfoCheckVRAM()
          if (clinfoVram > graphics.value.controllers[0].vram) {
            graphics.value.controllers[0].vram = clinfoVram
          }
        } catch (err) {
          console.error(err)
        }
        console.log(graphics.value)
      }
    }

    console.log(graphics.value)

    return {
      version: version.status === 'fulfilled' ? version.value : undefined,
      system: system.status === 'fulfilled' ? system.value : undefined,
      cpu: cpuData,
      memLayout: memLayout.status === 'fulfilled' ? memLayout.value : undefined,
      graphics: graphics.status === 'fulfilled' ? graphics.value : undefined,
      os: osInfo.status === 'fulfilled' ? osInfo.value : undefined,
      uuid: uuid.status === 'fulfilled' ? uuid.value : undefined,
      services: services.status === 'fulfilled' ? services.value : undefined,
    }
  })
}

/** Ensure only 1 instance of the app ever run */
const checkForMultipleInstance = () => {
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', () => {
      // Someone tried to run a second instance, we should focus our window.
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show()
        }

        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }

        mainWindow.focus()
      }
    })
  }
}

const createOfflineWindow = () => {
  if (offlineWindow) {
    return
  }

  if (mainWindow) {
    return
  }

  offlineWindow = new BrowserWindow({
    backgroundColor: theme.darkBlue,
    center: true,
    frame: false,
    height: 350,
    icon: path.join(__static, 'logo.ico'),
    resizable: false,
    title: 'Salad',
    webPreferences: {
      enableRemoteModule: false,
    },
    width: 300,
  })

  offlineWindow.loadURL(`file://${__static}/offline.html`)

  offlineWindow.on('close', () => {
    console.log('offline window close')
    app.quit()
  })
}

const createMainWindow = () => {
  if (mainWindow) {
    if (tray) {
      tray.setContextMenu(createSystemTrayMenu(true))
    }

    mainWindow.show()
    return
  }

  let maximized = false
  const saladAutoLauncher = new AutoLaunch({
    name: 'Salad',
  })

  mainWindow = new BrowserWindow({
    backgroundColor: theme.darkBlue,
    center: true,
    frame: false,
    icon: path.join(__static, 'logo.ico'),
    minHeight: 766,
    minWidth: 1216,
    show: false,
    title: 'Salad',
    webPreferences: {
      contextIsolation: false,
      enableRemoteModule: false,
      nodeIntegration: false,
      preload: path.resolve(__dirname, './preload.js'),
    },
  })

  mainWindow.loadURL(Config.appUrl)
  mainWindow.on('close', () => app.quit())

  mainWindow.webContents.on('before-input-event', (_: any, input: Input) => {
    if (input.type !== 'keyUp' || input.key !== 'F12') return
    mainWindow.webContents.toggleDevTools()
  })

  mainWindow.once('ready-to-show', () => {
    //path.join(__static, 'logo.ico')
    //tray = new Tray(path.join(__static, 'logo.ico'))
    //console.error('TRAY CREATED')
    //tray.setContextMenu(createSystemTrayMenu(true))
    //tray.setToolTip('Salad')
    //tray.on('double-click', () => {
    //  if (mainWindow) {
    //    if (mainWindow.isVisible()) {
    //      tray.setContextMenu(createSystemTrayMenu(false))
    //      mainWindow.hide()
    //    } else {
    //      tray.setContextMenu(createSystemTrayMenu(true))
    //     mainWindow.show()
    //   }
    //  }
    //})
    mainWindow.show()
    if (offlineWindow) {
      offlineWindow.destroy()
    }
  })

  //Create the bridge to listen to messages from the web-app
  let bridge = new SaladBridge(mainWindow)
  let notificationService = new SaladBridgeNotificationService(bridge, (status) => {
    if (status === PluginStatus.Initializing || status === PluginStatus.Installing || status === PluginStatus.Running) {
      if (!activeIconEnabled) {
        activeIconEnabled = true
        if (mainWindow) {
          mainWindow.setOverlayIcon(
            nativeImage.createFromPath(path.join(__static, 'taskbar-overlay-active.png')),
            'Background Tasks Running',
          )
        }

        if (tray) {
          tray.setImage(path.join(__static, 'logo-active.ico'))
        }
      }
    } else {
      if (activeIconEnabled) {
        activeIconEnabled = false
        if (mainWindow) {
          mainWindow.setOverlayIcon(null, '')
        }

        if (tray) {
          tray.setImage(path.join(__static, 'logo.ico'))
        }
      }
    }
  })

  let dataFolder = app.getPath('userData')
  console.log(`Path to Salad plugins:${dataFolder}`)
  pluginManager = new PluginManager(dataFolder, notificationService)

  ipcMain.on('js-dispatch', bridge.receiveMessage)

  var getMachineInfoPromise: Promise<void> | undefined = undefined

  //Listen for machine info requests
  bridge.on('get-machine-info', () => {
    //Return the cached machine info
    if (machineInfo) {
      bridge.send('set-machine-info', machineInfo)
    }

    //Prevent multiple `getMachineInfo` from being called at the same time
    if (getMachineInfoPromise !== undefined) return

    //Fetch the machine info
    getMachineInfoPromise = getMachineInfo().then((info) => {
      machineInfo = info
      bridge.send('set-machine-info', machineInfo)
      getMachineInfoPromise = undefined
    })
  })

  bridge.on('minimize-window', () => {
    mainWindow.minimize()
    console.log('Minimizing window')
  })

  bridge.on('maximize-window', () => {
    if (!maximized) {
      mainWindow.maximize()
      maximized = true
      console.log('Maximizing window')
    } else {
      mainWindow.unmaximize()
      maximized = false
      console.log('Unmaximizing window')
    }
  })

  bridge.on('close-window', () => {
    console.log('Closing main window')
    app.quit()
  })

  bridge.on('hide-window', () => {
    if (mainWindow && mainWindow.isVisible) {
      tray.setContextMenu(createSystemTrayMenu(false))
      mainWindow.hide()
    }
  })

  bridge.on(start, (pluginDefinition: PluginDefinition) => {
    if (pluginManager) pluginManager.start(pluginDefinition)
  })

  bridge.on(stop, () => {
    if (pluginManager) pluginManager.stop()
  })

  bridge.on('send-log', (id: string) => {
    console.log('Sending logs')
    Logger.sendLog(id)
  })

  bridge.on(getDesktopVersion, () => {
    bridge.send(setDesktopVersion, app.getVersion())
  })

  bridge.on('enable-auto-launch', () => {
    saladAutoLauncher.enable()
  })

  bridge.on('disable-auto-launch', () => {
    saladAutoLauncher.disable()
  })

  bridge.on('login', (profile: Profile) => {
    Sentry.configureScope((scope) => {
      scope.setUser({
        id: profile.id,
        email: profile.email,
        username: profile.username,
      })
    })
  })

  bridge.on('logout', () => {
    Sentry.configureScope((scope) => {
      scope.setUser({})
    })
  })

  //Gets the current idle time
  bridge.on(getIdleTime, () => {
    let n = powerMonitor.getSystemIdleTime()
    bridge.send(setIdleTime, {
      time: n,
    })
  })

  bridge.on(showNotification, (message: {}) => {
    notifier.notify(
      {
        ...message,
        icon: path.join(__static, 'logo.png'),
        appID: 'salad-technologies-desktop-app',
      },
      (err) => {
        if (err) {
          console.warn('Notification error')
          console.warn(err)
        }
      },
    )
  })

  mainWindow.webContents.on('new-window', (e: Electron.Event, url: string) => {
    console.log(`opening new window at ${url}`)
    e.preventDefault()
    shell.openExternal(url)
  })

  mainWindow.webContents.on('console-message', (_: Electron.Event, level: number, message: string, line: number) => {
    console.log(`console:${line}:${level}:${message}`)
  })
}

const checkForUpdates = () => {
  //When we are online, check for updates
  if (updateChecked) {
    return
  }

  updateChecked = true
  console.log('Checking for updates...')

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...')
  })
  autoUpdater.on('update-available', (info) => {
    console.log('Update available.' + info)
  })
  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.' + info)
  })
  autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater. ' + err)
  })
  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = 'Download speed: ' + progressObj.bytesPerSecond
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
    log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')'
    console.log(log_message)
  })
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded.' + info)
  })

  autoUpdater.logger = Logger.log
  autoUpdater.checkForUpdatesAndNotify()
}

const onReady = async () => {
  if (await isOnline({ timeout: 10000 })) {
    createMainWindow()
    checkForUpdates()
  } else {
    createOfflineWindow()
  }
}

checkForMultipleInstance()

app.on('ready', () => onReady())

app.on('will-quit', () => {
  console.log('will quit')
  if (pluginManager) pluginManager.stop()
})

process.on('exit', () => {
  console.log('Process exit')
  if (pluginManager) pluginManager.stop()
})

app.on('window-all-closed', () => {
  console.log('window-all-closed')
  if (process.platform != 'darwin') {
    app.quit()
  }
})

const cleanExit = () => {
  console.log('clean-exit')
  if (pluginManager) pluginManager.stop()
  process.exit()
}

process.on('SIGINT', cleanExit) // catch ctrl-c
process.on('SIGTERM', cleanExit) // catch kill
console.log(`Running ${app.name} ${app.getVersion()}`)

function createSystemTrayMenu(isVisible: boolean): Menu {
  return Menu.buildFromTemplate([
    {
      label: isVisible ? 'Hide Salad Window' : 'Show Salad Window',
      click: isVisible
        ? () => {
            if (mainWindow) {
              tray.setContextMenu(createSystemTrayMenu(false))
              mainWindow.hide()
            }
          }
        : () => {
            if (mainWindow) {
              tray.setContextMenu(createSystemTrayMenu(true))
              mainWindow.show()
            }
          },
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        app.quit()
      },
    },
  ])
}
