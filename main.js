// Core Electron and Node imports used throughout the main process.
const { app, BrowserWindow, ipcMain, Menu, globalShortcut, Tray, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

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
let tray = null  // Add tray variable


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



// Create system tray icon and contextual menu for quick toggles outside the main window.
function createTray() {
  // Create a 16x16 template image for the tray (macOS style).
  // For now we'll use a simple colored square - you can add a real icon later.
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEISURBVDiNpZMxasNAEEVfxEbgQpVOkELnSCFwYXAhcKETpBC4ELjQCVIIXAhcCFwIXAhc6AQpBC4ELgQuBC4ELgQuBDswi7SSVmt7YGCZnfn/zZ+ZFQAhxBfQAzpAG2gBTaABXANXQA2oAudABTgDysApcAIcA0fAIXAAFIA9IA/sgAwQAx6AB7x730MKuAL2gV0gC2wDW8AmkAY2gDUgCawCCSAOxIAVYBlYAhaB+aQQYuBL+GaSmB7TMc0kdY5MkmctdzAzBy3/m4M5c9Cz3EGStXRSyTQJIT4tJelYq6qqSikrlmVp7cN2u91dSvlqPpNSjv8HAKjruu84TlHXdTdN04HneW8TN30DLGJhTKHhDDwAAAAASUVORK5CYII=')
  
  tray = new Tray(icon)
  tray.setToolTip('Presenter Notes')

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
  // Build the macOS application menu with shortcuts that mirror the tray and renderer controls.
  const template = [
    {
      label: 'Presenter Notes',
      // App menu: handles about panel, visibility, quit, and shortcut legend.
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
      // File menu: marshals import/export flows handled in the renderer.
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
// Spin up the main BrowserWindow that hosts the entire presenter notes UI.
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

  // Reapply the saved privacy preference so window captures stay blocked if desired.
  setContentProtection(mainWindow, privacyOn);
  console.log('Content protection enabled')
  
  // Load the HTML shell after the window exists.
  mainWindow.loadFile('index.html')

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
