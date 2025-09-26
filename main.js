// Core Electron and Node imports used throughout the main process.
const { app, BrowserWindow, ipcMain, Menu, globalShortcut, Tray, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

// =====  PRIVACY TOGGLE  =====
let privacyOn = true;          // will be overwritten when we load
function setContentProtection(win, on) {
  if (!win) return;
  win.setContentProtection(on);      // macOS magic
  // win.webContents.send('privacy-changed', on); // tell renderer
}

let mainWindow
let tray = null  // Add tray variable


// Compute the file path where we cache all persisted application state.
const userDataPath = app.getPath('userData')
const notesPath = path.join(userDataPath, 'notes.json')

// Factory that produces the empty/default notes state written to disk.
const defaultNotesState = () => ({
  notes: [],
  activeNoteId: null,
  privacy: true,
  sidebarCollapsed: true,
  savedAt: new Date().toISOString()
})

let notesState = defaultNotesState()

// Load previously saved notes and UI state from disk when the app boots.
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
  const nextState = {
    ...notesState,
    savedAt: new Date().toISOString()
  }

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
    fs.writeFileSync(notesPath, JSON.stringify(notesState, null, 2))
    console.log('Notes state saved →', { privacy: notesState.privacy, sidebarCollapsed: notesState.sidebarCollapsed })
  } catch (error) {
    console.error('persistNotesState error', error)
  }
}

loadNotesState()



// Create system tray icon
// The tray offers quick access to visibility, opacity, and quit actions.
function createTray() {
  // Create a 16x16 template image for the tray (macOS style)
  // For now we'll use a simple colored square - you can add a real icon later
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEISURBVDiNpZMxasNAEEVfxEbgQpVOkELnSCFwYXAhcKETpBC4ELjQCVIIXAhcCFwIXAhc6AQpBC4ELgQuBC4ELgQuBDswi7SSVmt7YGCZnfn/zZ+ZFQAhxBfQAzpAG2gBTaABXANXQA2oAudABTgDysApcAIcA0fAIXAAFIA9IA/sgAwQAx6AB7x730MKuAL2gV0gC2wDW8AmkAY2gDUgCawCCSAOxIAVYBlYAhaB+aQQYuBL+GaSmB7TMc0kdY5MkmctdzAzBy3/m4M5c9Cz3EGStXRSyTQJIT4tJelYq6qqSikrlmVp7cN2u91dSvlqPpNSjv8HAKjruu84TlHXdTdN04HneW8TN30DLGJhTKHhDDwAAAAASUVORK5CYII=')
  
  tray = new Tray(icon)
  tray.setToolTip('Presenter Notes')

  //Show Inspect Element devtool
  //mainWindow.webContents.toggleDevTools();
  
  // Create tray menu
  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Show Notes',
      accelerator: 'Cmd+Shift+N',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: 'Hide Notes',
      click: () => {
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
            if (mainWindow) {
              mainWindow.webContents.send('change-opacity', 1.0)
            }
          }
        },
        {
          label: '70%',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('change-opacity', 0.7)
            }
          }
        },
        {
          label: '40%',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('change-opacity', 0.4)
            }
          }
        },
        {
          label: '20% (Very Transparent)',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('change-opacity', 0.2)
            }
          }
        },
        {
          label: '10% (Nearly Invisible)',
          click: () => {
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
            if (mainWindow) {
              mainWindow.webContents.send('change-font-size', 'increase')
            }
          }
        },
        {
          label: 'Decrease',
          click: () => {
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
  
// Cycle opacity with Cmd+Shift+O
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
    if (mainWindow) {
      // Get current state from the menu
      const menu = Menu.getApplicationMenu()
      const viewMenu = menu.items.find(item => item.label === 'View')
      const clickThroughItem = viewMenu.submenu.items.find(item => item.label === 'Click-through Mode')
      
      // Toggle the state
      const newState = !clickThroughItem.checked
      clickThroughItem.checked = newState
      
      // Apply the change
      mainWindow.setIgnoreMouseEvents(newState)
      mainWindow.webContents.send('toggle-click-through', newState)
    }
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
  const template = [
    {
      label: 'Presenter Notes',
      submenu: [
        {
          label: 'About Presenter Notes',
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
        submenu: [
          {
            label: 'Export Notes...',
            accelerator: 'Cmd+E',
            click: async () => {
              if (mainWindow) {
                mainWindow.webContents.send('export-notes')
              }
            }
          },
          {
            label: 'Import Notes...',
            accelerator: 'Cmd+I',
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
            if (mainWindow) {
              mainWindow.setIgnoreMouseEvents(menuItem.checked)
              mainWindow.webContents.send('toggle-click-through', menuItem.checked)
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'Cmd+M', role: 'minimize' },
        { label: 'Close', accelerator: 'Cmd+W', role: 'close' }
      ]
    },
    {
      label: 'Help',
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
          label: '  Bullet List: Cmd+L',
          enabled: false
        },
        {
          label: '  Number List: Cmd+D',
          enabled: false
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// Spawn the always-on-top presenter window with our HTML/CSS UI.
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 728,
    height: 600,
    
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',  // Add this line - fully transparent
    visibleOnAllWorkspaces: true,
    titleBarStyle: 'hiddenInset', // Add this line - enables custom titlebar
    
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

  setContentProtection(mainWindow, privacyOn);
  console.log('Content protection enabled')
  
  mainWindow.loadFile('index.html')

  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('window-fullscreen-changed', true)
    }
  })

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

    persistNotesState(updates)
  } catch (error) {
    console.error('save-notes error', error)
  }
})

ipcMain.on('save-sidebar-state', (event, collapsed) => {
  // Sidebar toggles come in separately so we can update immediately.
  try {
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
    return mainWindow ? mainWindow.isFullScreen() : false
  } catch (error) {
    console.error('is-window-fullscreen error', error)
    return false
  }
})

// user clicked the toggle → flip flag & window
ipcMain.handle('toggle-privacy', () => {
  privacyOn = !privacyOn;

    // 2.  apply to **that exact object**
    if (mainWindow) {
      mainWindow.setContentProtection(privacyOn);
    }

  persistNotesState({ privacy: privacyOn })

  return privacyOn;
});

// Update the app.whenReady
// Initialize menus, window, tray, and shortcuts once Electron is ready.
app.whenReady().then(() => {
  createMenu()
  createWindow()
  createTray()  // Add tray icon
  registerGlobalShortcuts()  // Register global hotkeys
})

// Clean up global shortcuts when app quits
// Prevent orphaned system shortcuts if the app shuts down unexpectedly.
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
