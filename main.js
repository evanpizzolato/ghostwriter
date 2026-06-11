// Core Electron and Node imports used throughout the main process.
const { app, BrowserWindow, ipcMain, Menu, globalShortcut, Tray, nativeImage, dialog, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

// =====  PRIVACY TOGGLE  =====
// Tracks whether screenshots should be blocked; value is hydrated from disk before the window spins up.
let privacyOn = true

// Apply or remove the macOS window-level content protection safeguard used to hide notes from captures.
function setContentProtection(win, on) {
  if (!win) return
  win.setContentProtection(on)
  // win.webContents.send('privacy-changed', on); // tell renderer
}

// Mutable references to the single BrowserWindow and tray icon we manage.
let mainWindow
let tray = null
// Single source of truth for click-through state so the menu, tray, and shortcut stay in sync.
let clickThroughOn = false

function setClickThrough(on) {
  clickThroughOn = !!on
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(clickThroughOn)
    mainWindow.webContents.send('toggle-click-through', clickThroughOn)
  }
  const appMenu = Menu.getApplicationMenu()
  const viewMenu = appMenu && appMenu.items.find(item => item.label === 'View')
  const item = viewMenu && viewMenu.submenu.items.find(i => i.label === 'Click-through Mode')
  if (item) item.checked = clickThroughOn
}


// Compute the file path where we cache all persisted application state.
const userDataPath = app.getPath('userData')
const notesPath = path.join(userDataPath, 'notes.json')

// Factory that produces the empty/default notes state written to disk when nothing has been saved yet.
const defaultNotesState = () => ({
  notes: [],
  activeNoteId: null,
  privacy: true,
  sidebarCollapsed: true,
  savedAt: new Date().toISOString()
})

let notesState = defaultNotesState()

// Load previously saved notes and UI state from disk when the app boots so the renderer can start hydrated.
function loadNotesState() {
  try {
    if (fs.existsSync(notesPath)) {
      const data = JSON.parse(fs.readFileSync(notesPath, 'utf8'))
      if (data && Array.isArray(data.notes)) {
        notesState = {
          notes: data.notes,
          activeNoteId: data.activeNoteId ?? null,
          privacy: data.privacy ?? true,
          sidebarCollapsed: data.sidebarCollapsed ?? true,
          savedAt: data.savedAt ?? new Date().toISOString()
        }
      } else {
        notesState = defaultNotesState()
      }
    } else {
      notesState = defaultNotesState()
    }
  } catch (error) {
    console.error('loadNotesState error', error)
    notesState = defaultNotesState()
  }

  privacyOn = notesState.privacy ?? true
  return notesState
}

// Merge updates into the current notes state and write them to disk.
function persistNotesState(updates = {}) {
  // Capture the existing state so we can layer in only the provided updates.
  const nextState = {
    ...notesState,
    savedAt: new Date().toISOString()
  }

  // Merge notes, active note pointer, privacy flag, and sidebar toggle individually.
  if (updates.notes !== undefined && Array.isArray(updates.notes)) {
    nextState.notes = updates.notes
  }

  if (updates.activeNoteId !== undefined) {
    nextState.activeNoteId = updates.activeNoteId
  }

  if (updates.privacy !== undefined) {
    nextState.privacy = updates.privacy
  }

  if (updates.sidebarCollapsed !== undefined) {
    nextState.sidebarCollapsed = updates.sidebarCollapsed
  }

  notesState = nextState

  privacyOn = notesState.privacy ?? true

  try {
    // Persist the merged snapshot immediately; the renderer manages debouncing before calling this.
    fs.writeFileSync(notesPath, JSON.stringify(notesState, null, 2))
    console.log('Notes state saved →', { privacy: notesState.privacy, sidebarCollapsed: notesState.sidebarCollapsed })
  } catch (error) {
    console.error('persistNotesState error', error)
  }
}

loadNotesState()


// =====  WINDOW STATE  =====
// Remember window size/position between launches, like native mac apps do.
const windowStatePath = path.join(userDataPath, 'window-state.json')

function loadWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(windowStatePath, 'utf8'))
    if (state && Number.isFinite(state.width) && Number.isFinite(state.height)) {
      return state
    }
  } catch (error) {
    // Missing or corrupt state file — fall back to defaults.
  }
  return null
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFullScreen()) return
  try {
    fs.writeFileSync(windowStatePath, JSON.stringify(mainWindow.getNormalBounds()))
  } catch (error) {
    console.error('saveWindowState error', error)
  }
}

let windowStateSaveTimeout
function scheduleWindowStateSave() {
  clearTimeout(windowStateSaveTimeout)
  windowStateSaveTimeout = setTimeout(saveWindowState, 500)
}

// Only restore a saved position if it still lands on a connected display.
function positionIsVisible(state) {
  if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) return false
  return screen.getAllDisplays().some(({ workArea }) =>
    state.x >= workArea.x - state.width + 100 &&
    state.x <= workArea.x + workArea.width - 100 &&
    state.y >= workArea.y &&
    state.y <= workArea.y + workArea.height - 100
  )
}


// =====  AUTO-UPDATER  =====
// electron-updater talks to GitHub Releases (configured via the `publish` block
// in package.json) and downloads new versions in the background. Only runs in
// a packaged build — in dev there is no signed app to update.

// Tracks whether the in-flight check was started by the user clicking the tray
// item (so we surface "you're up to date" / error dialogs) vs. the silent
// check on launch.
let manualUpdateCheckInFlight = false

function setupAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version)
  })

  autoUpdater.on('update-not-available', () => {
    if (manualUpdateCheckInFlight) {
      manualUpdateCheckInFlight = false
      dialog.showMessageBox({
        type: 'info',
        message: 'You’re up to date',
        detail: `Ghostwriter ${app.getVersion()} is the latest version.`,
        buttons: ['OK']
      })
    }
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err)
    if (manualUpdateCheckInFlight) {
      manualUpdateCheckInFlight = false
      dialog.showMessageBox({
        type: 'error',
        message: 'Update check failed',
        detail: err == null ? 'Unknown error' : (err.stack || err.message || String(err)),
        buttons: ['OK']
      })
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    manualUpdateCheckInFlight = false
    dialog.showMessageBox({
      type: 'info',
      message: `Ghostwriter ${info.version} is ready to install`,
      detail: 'Restart now to apply the update, or it will install the next time you quit.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })
}

function checkForUpdates({ manual = false } = {}) {
  if (!app.isPackaged) {
    if (manual) {
      dialog.showMessageBox({
        type: 'info',
        message: 'Updates are disabled in development',
        detail: 'Auto-update only runs in a packaged, signed build.',
        buttons: ['OK']
      })
    }
    return
  }
  manualUpdateCheckInFlight = manual
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('checkForUpdates rejected:', err)
  })
}


// Create system tray icon and contextual menu for quick toggles outside the main window.
function createTray() {
  // Load a black-on-transparent template image so macOS inverts it
  // automatically for light/dark menu bars. File must be named with the
  // "Template" suffix and live next to the @2x retina version.
  const iconPath = path.join(__dirname, 'build', 'trayTemplate.png')
  let icon
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath)
    icon.setTemplateImage(true)
  } else {
    // Fallback: empty image (no visual) so the app still launches if the asset is missing.
    console.warn('trayTemplate.png not found; tray icon will be blank.')
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Ghostwriter')

  //Show Inspect Element devtool
  //mainWindow.webContents.toggleDevTools();
  
  // Create tray menu for show/hide, opacity, and font size shortcuts.
  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Show Notes',
      accelerator: 'Cmd+Shift+N',
      click: () => {
        // Bring the main window forward if it exists and is hidden.
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: 'Hide Notes',
      click: () => {
        // Hide the main window without quitting the application.
        if (mainWindow) {
          mainWindow.hide()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Opacity',
      submenu: [
        {
          label: '100% (Opaque)',
          click: () => {
            // Send a renderer IPC command to make the window fully opaque.
            if (mainWindow) {
              mainWindow.webContents.send('change-opacity', 1.0)
            }
          }
        },
        {
          label: '70%',
          click: () => {
            // Lower opacity to 70%.
            if (mainWindow) {
              mainWindow.webContents.send('change-opacity', 0.7)
            }
          }
        },
        {
          label: '40%',
          click: () => {
            // Lower opacity to 40%.
            if (mainWindow) {
              mainWindow.webContents.send('change-opacity', 0.4)
            }
          }
        },
        {
          label: '20% (Very Transparent)',
          click: () => {
            // Lower opacity to 20%.
            if (mainWindow) {
              mainWindow.webContents.send('change-opacity', 0.2)
            }
          }
        },
        {
          label: '10% (Nearly Invisible)',
          click: () => {
            // Lower opacity to 10% for an almost invisible window.
            if (mainWindow) {
              mainWindow.webContents.send('change-opacity', 0.1)
            }
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Font Size',
      submenu: [
        {
          label: 'Increase',
          click: () => {
            // Ask renderer to bump the editor font size up one notch.
            if (mainWindow) {
              mainWindow.webContents.send('change-font-size', 'increase')
            }
          }
        },
        {
          label: 'Decrease',
          click: () => {
            // Ask renderer to shrink the editor font size.
            if (mainWindow) {
              mainWindow.webContents.send('change-font-size', 'decrease')
            }
          }
        },
        {
          label: 'Reset',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('change-font-size', 'reset')
            }
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Check for Updates…',
      click: () => {
        checkForUpdates({ manual: true })
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(trayMenu)
  
  // Show window on tray icon click (left click on Mac)
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
}

// Register global shortcuts
// These shortcuts let the presenter control the window without touching the UI.
function registerGlobalShortcuts() {
  // Toggle show/hide with Cmd+Shift+N
  const toggleRegistered = globalShortcut.register('Command+Shift+N', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
  
  if (!toggleRegistered) {
    console.log('Failed to register Cmd+Shift+N - might be in use by another app')
  }
  // Cycle opacity with Cmd+Shift+O by walking through this list of preset values.
  let currentOpacityIndex = 0
  const opacities = [1.0, 0.7, 0.4, 0.2, 0.1]

  const opacityRegistered = globalShortcut.register('Command+Shift+O', () => {
    if (mainWindow) {
      currentOpacityIndex = (currentOpacityIndex + 1) % opacities.length
      mainWindow.webContents.send('change-opacity', opacities[currentOpacityIndex])
    }
  })
  
  if (!opacityRegistered) {
    console.log('Failed to register Cmd+Shift+O - might be in use by another app')
  }
  
  // Quick font size shortcuts
  const fontIncreaseRegistered = globalShortcut.register('Command+Shift+Plus', () => {
    if (mainWindow) {
      mainWindow.webContents.send('change-font-size', 'increase')
    }
  })
  
  const fontDecreaseRegistered = globalShortcut.register('Command+Shift+-', () => {
    if (mainWindow) {
      mainWindow.webContents.send('change-font-size', 'decrease')
    }
  })

  // Toggle click-through mode with Cmd+Shift+T
  const clickThroughRegistered = globalShortcut.register('Command+Shift+T', () => {
    setClickThrough(!clickThroughOn)
  })
  
  console.log('  Cmd+Shift+T (click-through):', clickThroughRegistered)
  
  // Log registration status
  console.log('Global shortcuts registered:')
  console.log('  Cmd+Shift+N (toggle):', toggleRegistered)
  console.log('  Cmd+Shift+O (opacity):', opacityRegistered)
  console.log('  Cmd+Shift+Plus (font+):', fontIncreaseRegistered)
  console.log('  Cmd+Shift+- (font-):', fontDecreaseRegistered)
}

// Create the application menu (your existing createMenu function stays the same)
// The macOS menu exposes the same controls offered via the tray and shortcuts.
function createMenu() {
  // Build the macOS application menu with shortcuts that mirror the tray and renderer controls.
  const template = [
    {
      label: 'Ghostwriter',
      // App menu: handles about panel, visibility, quit, and shortcut legend.
      submenu: [
        {
          label: 'About Ghostwriter',
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Hide Notes',
          accelerator: 'Cmd+H',
          click: () => {
            if (mainWindow) {
              mainWindow.hide()
            }
          }
        },
        {
          label: 'Show Notes',
          accelerator: 'Cmd+Shift+H',
          click: () => {
            if (mainWindow) {
              mainWindow.show()
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Cmd+Q',
          click: () => {
            app.quit()
          }
        },
        {
            label: '  Click-through: Cmd+Shift+T',
            enabled: false
          }
      ]
    },
    {
      label: 'File',
      // File menu: marshals import/export flows handled in the renderer.
      submenu: [
        {
          label: 'Export Notes...',
            accelerator: 'Shift+Cmd+E',
            click: async () => {
              if (mainWindow) {
                mainWindow.webContents.send('export-notes')
              }
            }
          },
          {
            label: 'Import Notes...',
            accelerator: 'Shift+Cmd+I',
            click: async () => {
              if (mainWindow) {
                mainWindow.webContents.send('import-notes')
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Export Backup (JSON)...',
            click: async () => {
              if (mainWindow) {
                mainWindow.webContents.send('export-backup')
              }
            }
          },
          {
            label: 'Import Backup (JSON)...',
            click: async () => {
              if (mainWindow) {
                mainWindow.webContents.send('import-backup')
              }
            }
          }
        ]
      },
    {
      label: 'Edit',
      // Edit menu: standard macOS editing commands forwarded to the webview.
      submenu: [
        { label: 'Undo', accelerator: 'Cmd+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Cmd+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Cmd+X', role: 'cut' },
        { label: 'Copy', accelerator: 'Cmd+C', role: 'copy' },
        { label: 'Paste', accelerator: 'Cmd+V', role: 'paste' },
        { label: 'Select All', accelerator: 'Cmd+A', role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      // View menu: tuning options for font size, opacity, and click-through.
      submenu: [
        {
          label: 'Increase Font Size',
          accelerator: 'Cmd+Plus',
          click: () => {
            mainWindow.webContents.send('change-font-size', 'increase')
          }
        },
        {
          label: 'Decrease Font Size',
          accelerator: 'Cmd+-',
          click: () => {
            mainWindow.webContents.send('change-font-size', 'decrease')
          }
        },
        {
          label: 'Reset Font Size',
          accelerator: 'Cmd+0',
          click: () => {
            mainWindow.webContents.send('change-font-size', 'reset')
          }
        },
        { type: 'separator' },
        {
          label: 'Opacity',
          submenu: [
            {
              label: '100%',
              click: () => mainWindow.webContents.send('change-opacity', 1.0)
            },
            {
              label: '80%',
              click: () => mainWindow.webContents.send('change-opacity', 0.8)
            },
            {
              label: '60%',
              click: () => mainWindow.webContents.send('change-opacity', 0.6)
            },
            {
              label: '40%',
              click: () => mainWindow.webContents.send('change-opacity', 0.4)
            },
            {
              label: '20%',
              click: () => mainWindow.webContents.send('change-opacity', 0.2)
            },
            {
              label: '10%',
              click: () => mainWindow.webContents.send('change-opacity', 0.1)
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Click-through Mode',
          type: 'checkbox',
          checked: false,
          accelerator: 'Cmd+Shift+T',
          click: (menuItem) => {
            setClickThrough(menuItem.checked)
          }
        }
      ]
    },
    {
      label: 'Window',
      // Window menu: basic window management roles for macOS.
      submenu: [
        { label: 'Minimize', accelerator: 'Cmd+M', role: 'minimize' },
        { label: 'Close', accelerator: 'Cmd+W', role: 'close' }
      ]
    },
    {
      label: 'Help',
      // Help menu: static primer on privacy mode and shortcuts.
      submenu: [
        {
          label: '✓ Privacy Mode Active',
          enabled: false
        },
        { type: 'separator' },
        {
          label: 'Global Shortcuts:',
          enabled: false
        },
        {
          label: '  Toggle: Cmd+Shift+N',
          enabled: false
        },
        {
          label: '  Opacity: Cmd+Shift+O',
          enabled: false
        },
        {
          label: '  Font +: Cmd+Shift+Plus',
          enabled: false
        },
        {
          label: '  Font -: Cmd+Shift+Minus',
          enabled: false
        },
        { type: 'separator' },
        {
          label: 'Text Formatting:',
          enabled: false
        },
        {
          label: '  Bold: Cmd+B',
          enabled: false
        },
        {
          label: '  Italic: Cmd+I',
          enabled: false
        },
        {
          label: '  Underline: Cmd+U',
          enabled: false
        },
        {
          label: '  Bullet List: Shift+Cmd+7',
          enabled: false
        },
        {
          label: '  Number List: Shift+Cmd+9',
          enabled: false
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// Spawn the always-on-top presenter window with our HTML/CSS UI.
// Spin up the main BrowserWindow that hosts the entire presenter notes UI.
function createWindow() {
  const savedState = loadWindowState()

  mainWindow = new BrowserWindow({
    width: savedState?.width ?? 728,
    height: savedState?.height ?? 600,
    ...(savedState && positionIsVisible(savedState) ? { x: savedState.x, y: savedState.y } : {}),
    show: false,

    frame: false,
    transparent: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    visibleOnAllWorkspaces: true,
    titleBarStyle: 'hiddenInset',

    resizable: true,
    minWidth: 642,
    minHeight: 400,

    roundedCorners: true,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.on('resize', scheduleWindowStateSave)
  mainWindow.on('move', scheduleWindowStateSave)
  mainWindow.on('close', saveWindowState)

  // Keep the window fully invisible until the renderer signals it has
  // hydrated notes and laid out the UI. Avoids the cold-start flash where
  // the macOS traffic lights appear over an empty transparent window.
  mainWindow.setOpacity(0)

  // Failsafe: if the renderer never signals ready (crash, load failure),
  // reveal the window at full opacity after 2s so the app isn't stuck invisible.
  const readyFailsafe = setTimeout(() => {
    revealWindow()
  }, 2000)

  // Ensure the reveal logic only runs once across the failsafe + signal paths.
  let revealed = false
  function revealWindow() {
    if (revealed || !mainWindow) return
    revealed = true
    clearTimeout(readyFailsafe)
    if (!mainWindow.isVisible()) mainWindow.show()
    // Tween 0 → 1 over ~100ms in 6 steps. Electron has no built-in
    // window-opacity animation, so we step manually with setInterval.
    const steps = 6
    const duration = 100
    let step = 0
    const tick = setInterval(() => {
      step += 1
      const next = Math.min(step / steps, 1)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setOpacity(next)
      }
      if (step >= steps) clearInterval(tick)
    }, duration / steps)
  }

  ipcMain.once('renderer-ready', () => {
    revealWindow()
  })

  // Reapply the saved privacy preference so window captures stay blocked if desired.
  setContentProtection(mainWindow, privacyOn);
  console.log('Content protection enabled')
  
  // Load the HTML shell after the window exists.
  mainWindow.loadFile('index.html')

  mainWindow.webContents.on('context-menu', (event, params) => {
    if (!params.isEditable) return

    const template = []

    // Surface the native spellchecker: correction guesses + Add to Dictionary.
    if (params.misspelledWord) {
      params.dictionarySuggestions.slice(0, 5).forEach((suggestion) => {
        template.push({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion)
        })
      })
      if (!params.dictionarySuggestions.length) {
        template.push({ label: 'No Guesses Found', enabled: false })
      }
      template.push(
        {
          label: 'Add to Dictionary',
          click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
        },
        { type: 'separator' }
      )
    } else if (params.selectionText.trim()) {
      const snippet = params.selectionText.trim()
      const label = snippet.length > 30 ? `${snippet.slice(0, 30)}…` : snippet
      template.push(
        {
          label: `Look Up “${label}”`,
          click: () => mainWindow.webContents.showDefinitionForSelection()
        },
        { type: 'separator' }
      )
    }

    template.push(
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    )

    Menu.buildFromTemplate(template).popup({ window: mainWindow })
  })

  // Watch for fullscreen entry so the renderer can adjust layout spacing on macOS.
  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('window-fullscreen-changed', true)
    }
  })

  // Likewise notify the renderer when fullscreen exits so margins can be restored.
  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('window-fullscreen-changed', false)
    }
  })
}

// Handle saving notes from the renderer
// The renderer sends updated text or settings; we persist the merged payload.
ipcMain.on('save-notes', (event, payload) => {
  try {
    if (!payload || typeof payload !== 'object') {
      return
    }

    // Build a minimal update payload containing only the fields we allow to change.
    const updates = {}

    if (Array.isArray(payload.notes)) {
      updates.notes = payload.notes
    }

    if (payload.activeNoteId === null || typeof payload.activeNoteId === 'string') {
      updates.activeNoteId = payload.activeNoteId
    }

    if (typeof payload.privacy === 'boolean') {
      updates.privacy = payload.privacy
    }

    if (payload.sidebarCollapsed !== undefined) {
      updates.sidebarCollapsed = !!payload.sidebarCollapsed
    }

    // Persist the merged snapshot to disk.
    persistNotesState(updates)
  } catch (error) {
    console.error('save-notes error', error)
  }
})

ipcMain.on('save-sidebar-state', (event, collapsed) => {
  // Sidebar toggles come in separately so we can update immediately.
  try {
    // Persist a boolean flag so the renderer restores the same collapsed state next launch.
    persistNotesState({ sidebarCollapsed: !!collapsed })
  } catch (error) {
    console.error('save-sidebar-state error', error)
  }
})

// Handle loading notes
// When the renderer boots it calls this to restore saved notes and settings.
ipcMain.handle('load-notes', () => {
  try {
    const state = loadNotesState()
    return {
      notes: state.notes,
      activeNoteId: state.activeNoteId,
      privacy: state.privacy,
      sidebarCollapsed: state.sidebarCollapsed
    }
  } catch (error) {
    console.error('load-notes handler error', error)
    const fallback = defaultNotesState()
    privacyOn = fallback.privacy
    return {
      notes: fallback.notes,
      activeNoteId: fallback.activeNoteId,
      privacy: fallback.privacy,
      sidebarCollapsed: fallback.sidebarCollapsed
    }
  }
})

ipcMain.handle('is-window-fullscreen', () => {
  try {
    // Guard against the window not being ready yet when the renderer queries the state.
    return mainWindow ? mainWindow.isFullScreen() : false
  } catch (error) {
    console.error('is-window-fullscreen error', error)
    return false
  }
})

// Right-click on a sidebar note row: native menu with destructive actions.
ipcMain.on('show-note-context-menu', (event, noteId) => {
  if (!mainWindow || typeof noteId !== 'string') return
  const menu = Menu.buildFromTemplate([
    {
      label: 'Delete Note',
      click: () => mainWindow.webContents.send('delete-note-request', noteId)
    }
  ])
  menu.popup({ window: mainWindow })
})

// Native save sheet for exports (replaces the old anchor-click blob download).
ipcMain.handle('save-file', async (event, { defaultPath, filters, content } = {}) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: typeof defaultPath === 'string' ? defaultPath : undefined,
      filters: Array.isArray(filters) ? filters : undefined
    })
    if (result.canceled || !result.filePath) return false
    fs.writeFileSync(result.filePath, String(content ?? ''), 'utf8')
    return true
  } catch (error) {
    console.error('save-file error', error)
    return false
  }
})

// Native open panel for imports (replaces the hidden <input type="file">).
ipcMain.handle('open-file', async (event, { filters } = {}) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: Array.isArray(filters) ? filters : undefined
    })
    if (result.canceled || !result.filePaths.length) return null
    const filePath = result.filePaths[0]
    return { name: path.basename(filePath), content: fs.readFileSync(filePath, 'utf8') }
  } catch (error) {
    console.error('open-file error', error)
    return null
  }
})

// Respond to the renderer toggling privacy mode from the menu or toolbar.
ipcMain.handle('toggle-privacy', () => {
  privacyOn = !privacyOn;

    // 2.  apply to **that exact object**
    if (mainWindow) {
      mainWindow.setContentProtection(privacyOn);
    }

  // Save the new privacy preference so it is remembered next launch.
  persistNotesState({ privacy: privacyOn })

  return privacyOn;
});

// Update the app.whenReady
// Initialize menus, window, tray, and shortcuts once Electron is ready.
app.whenReady().then(() => {
  // Build all chrome before showing UI.
  createMenu()
  createWindow()
  createTray()  // Add tray icon
  registerGlobalShortcuts()  // Register global hotkeys
  setupAutoUpdater()
  checkForUpdates()  // Silent background check on launch.
})

// Clean up global shortcuts when app quits
// Prevent orphaned system shortcuts if the app shuts down unexpectedly.
app.on('will-quit', () => {
  // Release any system-wide accelerators we claimed.
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // This app does not keep a menu-bar-only presence—quit when the last window closes.
  app.quit()
})
