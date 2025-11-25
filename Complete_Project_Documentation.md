# Presenter Notes App - Complete Project Documentation

## Project Overview
A privacy-focused Electron-based macOS app for presenter notes that stay hidden from screenshots and screen shares. Built with Electron's content protection API and designed for seamless presentation use.

**Author:** Evan Pizzolato  
**Version:** 0.3.0  
**License:** MIT

## Project Structure & File Organization

```
/Users/evanpizzolato/Documents/Code/notesapp/
├── main.js                    # Main Electron process
├── renderer.js                # Renderer process (UI logic)
├── preload.js                 # Secure IPC bridge
├── index.html                 # UI layout and styling
├── package.json               # Dependencies and build config
├── ElectronNotesApp_documentation.md  # Original docs
├── build/                     # Build assets
│   ├── icon.icns              # macOS app icon
│   ├── icon.png               # PNG version
│   └── entitlements.mac.plist # macOS permissions
├── dist/                      # Built applications
│   ├── mac/                   # Intel Mac build
│   ├── mac-arm64/             # Apple Silicon build
│   └── *.dmg                  # Distribution packages
└── node_modules/              # Dependencies
```

## Naming Conventions

### Files
- **kebab-case** for main files: `main.js`, `renderer.js`, `preload.js`
- **PascalCase** for app name: `Presenter Notes`
- **snake_case** for build files: `entitlements.mac.plist`
- **kebab-case** for package: `presenter-notes`

### Variables & Functions
- **camelCase** for variables: `mainWindow`, `saveTimeout`, `currentFontSize`
- **camelCase** for functions: `createWindow()`, `updateOpacity()`, `insertTextFormat()`
- **kebab-case** for CSS classes: `click-through`, `privacy-badge`, `toolbar-buttons`
- **UPPER_CASE** for constants: `userDataPath`, `notesPath`

### IPC Events
- **kebab-case** for event names: `save-notes`, `change-opacity`, `export-notes`
- **camelCase** for handlers: `onFontSizeChange()`, `onOpacityChange()`

## Core Architecture

### Main Process (`main.js`)
- **Window Management**: Creates frameless, transparent, always-on-top window
- **IPC Handlers**: Manages communication between main and renderer processes
- **Global Shortcuts**: Registers system-wide hotkeys
- **Menu System**: Creates native macOS menu bar and system tray
- **Data Persistence**: Saves and loads the full notes collection, active note pointer, privacy state, and sidebar preference to a JSON file in `userData`

### Renderer Process (`renderer.js`)
- **UI Logic**: Manages the contenteditable editor, multi-note sidebar, toolbar, and user interactions
- **Auto-save**: Debounced collection saving (500ms) that keeps notes ordered by last edit
- **Import/Export**: File handling for JSON backups and single-note markdown/text export
- **State Management**: Tracks font size, opacity, click-through mode, toolbar visibility, sidebar collapse, loaded notes array, and the active note id
- **Sidebar CRUD**: Provides create, select, and delete actions with live title updates reflecting the first line of each note

### Preload Script (`preload.js`)
- **Security Bridge**: Exposes safe APIs to renderer via `contextBridge`
- **IPC Wrapper**: Provides clean channels for renderer-main communication

## Key Features & Implementation

### 1. Privacy Protection
```javascript
mainWindow.setContentProtection(true)  // Hides from screenshots
```
- Visual `PRIVACY MODE` badge inside the UI
- Works with macOS native screenshot tools
- Content protection API integration

### 2. Global Shortcuts (System-wide)
- `Cmd+Shift+N`: Toggle show/hide window
- `Cmd+Shift+O`: Cycle opacity (100% → 70% → 40% → 20% → 10%)
- `Cmd+Shift+T`: Toggle click-through mode
- `Cmd+Shift+Plus/Minus`: Adjust font size

### 3. Rich Text Editing
- **Text Formatting**: Bold (Cmd+B), Italic (Cmd+I), Underline (Cmd+U)
- **Lists**: Bullet lists (Cmd+L), Numbered lists (Cmd+D)
- **Font Size**: Dropdown selector (12-36px)
- **Toolbar**: Gradient toolbar with SVG icons, active state indicators, and hide/show toggle
- **ContentEditable**: HTML-based rich text editor with auto-save

### 4. Click-Through Mode
```javascript
mainWindow.setIgnoreMouseEvents(true)  // Clicks pass through
```
- Animated overlay indicator
- Disables text editing while active
- Useful for overlay during presentations

### 5. Data Persistence
- **Location**: `~/Library/Application Support/presenter-notes/notes.json`
- **Format**: JSON object containing:
  - `notes`: array of `{ id, content, createdAt, updatedAt }`
  - `activeNoteId`: id of the note currently open in the editor
  - `privacy`: boolean toggle for content protection
  - `sidebarCollapsed`: boolean storing sidebar visibility preference
  - `savedAt`: timestamp of the last persist
- **Empty-note guard**: notes without real characters (whitespace-only/blank) are dropped from saves; `activeNoteId` is cleared if it points to a discarded note
- **Auto-save**: Debounced (500ms after typing stops)
- **Backup**: Export/import retains multiple notes via JSON backup flow; single-note markdown export uses the active note
- **Sidebar State**: Persists the collapsed/expanded sidebar preference alongside notes and privacy

### 6. UI Controls
- Gradient toolbar with hide/show toggle and 1px separators
- Font size dropdown (12–36 px) with custom chevron icon
- Formatting buttons (bold, italic, underline, bullet list, numbered list)
- Opacity slider (10–100%) with gradient track
- Save status indicator inside the window header
- Collapsible sidebar (default collapsed) with macOS-style toggle button, keyboard shortcut (`⌥⌘S`/`Ctrl+Alt+S`), smooth animation, and state persistence
- Multi-note sidebar shows only titles, with full-row click targets, relative timestamps (just now, 2h ago, Yesterday, Nov. 18), and a 12px inline trash icon; “New Note” is now a toolbar button at the right of the editor controls

## Package Configuration

### Dependencies
```json
{
  "devDependencies": {
    "electron": "latest",
    "electron-builder": "latest",
    "electronmon": "latest"
  }
}
```

### Build Configuration
- **Target**: DMG for macOS (x64 and arm64)
- **Hardened Runtime**: Enabled for security
- **Dark Mode**: Supported
- **Icon**: `build/icon.icns`

### Build Commands
```bash
npm start        # Development mode with auto-restart (electronmon)
npm run dist-mac # Create distribution DMG
```

### Developer Workflow
- `electronmon` watches source changes and restarts the Electron process automatically during `npm start`.
- Notes and settings persist between restarts via the JSON store in `userData`.

## Complete Source Code

### main.js - Main Electron Process
```javascript
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


// Get the path where we'll store notes
const userDataPath = app.getPath('userData')
const notesPath = path.join(userDataPath, 'notes.json')

const defaultNotesState = () => ({
  notes: '',
  privacy: true,
  sidebarCollapsed: true,
  savedAt: new Date().toISOString()
})

let notesState = defaultNotesState()

function loadNotesState() {
  try {
    if (fs.existsSync(notesPath)) {
      const data = JSON.parse(fs.readFileSync(notesPath, 'utf8'))
      notesState = {
        notes: data.notes ?? '',
        privacy: data.privacy ?? true,
        sidebarCollapsed: data.sidebarCollapsed ?? true,
        savedAt: data.savedAt ?? new Date().toISOString()
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

function persistNotesState(updates = {}) {
  notesState = {
    ...notesState,
    notes: updates.notes !== undefined ? updates.notes : notesState.notes,
    privacy: updates.privacy !== undefined ? updates.privacy : notesState.privacy,
    sidebarCollapsed: updates.sidebarCollapsed !== undefined ? updates.sidebarCollapsed : notesState.sidebarCollapsed,
    savedAt: new Date().toISOString()
  }

  privacyOn = notesState.privacy ?? true

  try {
    fs.writeFileSync(notesPath, JSON.stringify(notesState))
    console.log('Notes state saved →', { privacy: notesState.privacy, sidebarCollapsed: notesState.sidebarCollapsed })
  } catch (error) {
    console.error('persistNotesState error', error)
  }
}

loadNotesState()



// Create system tray icon
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
}

// Handle saving notes from the renderer
ipcMain.on('save-notes', (event, payload) => {
  try {
    if (typeof payload === 'string') {
      persistNotesState({ notes: payload })
      return
    }

    if (payload && typeof payload === 'object') {
      persistNotesState({
        notes: payload.notes,
        privacy: payload.privacy,
        sidebarCollapsed: payload.sidebarCollapsed
      })
    }
  } catch (error) {
    console.error('save-notes error', error)
  }
})

ipcMain.on('save-sidebar-state', (event, collapsed) => {
  try {
    persistNotesState({ sidebarCollapsed: !!collapsed })
  } catch (error) {
    console.error('save-sidebar-state error', error)
  }
})

// Handle loading notes
ipcMain.handle('load-notes', () => {
  try {
    const state = loadNotesState()
    return { notes: state.notes, privacy: state.privacy, sidebarCollapsed: state.sidebarCollapsed }
  } catch (error) {
    console.error('load-notes handler error', error)
    const fallback = defaultNotesState()
    privacyOn = fallback.privacy
    return { notes: fallback.notes, privacy: fallback.privacy, sidebarCollapsed: fallback.sidebarCollapsed }
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
app.whenReady().then(() => {
  createMenu()
  createWindow()
  createTray()  // Add tray icon
  registerGlobalShortcuts()  // Register global hotkeys
})

// Clean up global shortcuts when app quits
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})

```

### preload.js - Secure IPC Bridge
```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  saveNotes: (notes) => ipcRenderer.send('save-notes', notes),
  loadNotes: () => ipcRenderer.invoke('load-notes'),
  saveSidebarState: (collapsed) => ipcRenderer.send('save-sidebar-state', collapsed),

  togglePrivacy: () => ipcRenderer.invoke('toggle-privacy'),
  onPrivacyChanged: (cb) => ipcRenderer.on('privacy-changed', cb),
  
  // Menu commands
  onFontSizeChange: (callback) => ipcRenderer.on('change-font-size', callback),
  onOpacityChange: (callback) => ipcRenderer.on('change-opacity', callback),
  // Click-through
  onToggleClickThrough: (callback) => ipcRenderer.on('toggle-click-through', callback),
  
  // Add import/export handlers
  onExportNotes: (callback) => ipcRenderer.on('export-notes', callback),
  onImportNotes: (callback) => ipcRenderer.on('import-notes', callback),
  onExportBackup: (callback) => ipcRenderer.on('export-backup', callback),
  onImportBackup: (callback) => ipcRenderer.on('import-backup', callback)
})

```

### renderer.js - Renderer Logic
```javascript
// This runs in your web page
let saveTimeout
let currentFontSize = 18  // Default font size
let currentOpacity = 1.0  // Default opacity
let toolbarVisible = true
let sidebarCollapsed = true
let sidebarToggleShortcutHint = '⌥⌘S'



// Function to download a file
function downloadFile(content, filename, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Function to read uploaded file
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// Function to update font size
function updateFontSize(direction) {
  const editor = document.getElementById('notes')

  if (direction === 'increase') {
    currentFontSize = Math.min(currentFontSize + 2, 32)
  } else if (direction === 'decrease') {
    currentFontSize = Math.max(currentFontSize - 2, 12)
  } else if (direction === 'reset') {
    currentFontSize = 18
  }

  editor.style.fontSize = currentFontSize + 'px'
}

// NEW: Text formatting helper functions
function insertTextFormat(command, value = null) {
  const editor = document.getElementById('notes')
  editor.focus()
  
  // Use browser's built-in rich text commands
  document.execCommand(command, false, value)
  
  // Trigger save
  editor.dispatchEvent(new Event('input'))
  
  // Update button states after formatting
  updateToolbarStates()
}

function insertListItem(listType) {
  const editor = document.getElementById('notes')
  editor.focus()
  
  if (listType === 'bullet') {
    document.execCommand('insertUnorderedList', false, null)
  } else if (listType === 'number') {
    document.execCommand('insertOrderedList', false, null)
  }
  
  // Trigger save
  editor.dispatchEvent(new Event('input'))
  
  // Update button states
  updateToolbarStates()
}

// NEW: Apply font size to selected text
function applyFontSize(size) {
  const editor = document.getElementById('notes')
  editor.focus()
  
  // Create a span with the font size
  const fontHTML = `<span style="font-size: ${size}px;">`
  
  // Check if we have selected text
  const selection = window.getSelection()
  if (selection.rangeCount > 0 && !selection.isCollapsed) {
    // Text is selected - wrap it in a span
    const range = selection.getRangeAt(0)
    const span = document.createElement('span')
    span.style.fontSize = size + 'px'
    
    try {
      span.appendChild(range.extractContents())
      range.insertNode(span)
      selection.removeAllRanges()
      
      // Place cursor after the span
      const newRange = document.createRange()
      newRange.setStartAfter(span)
      newRange.collapse(true)
      selection.addRange(newRange)
    } catch (e) {
      console.log('Font size application failed:', e)
    }
  } else {
    // No selection - set font size for future typing
    document.execCommand('fontSize', false, '7') // Use size 7 as placeholder
    
    // Find the font elements and replace with our size
    const fontElements = editor.querySelectorAll('font[size="7"]')
    fontElements.forEach(el => {
      const span = document.createElement('span')
      span.style.fontSize = size + 'px'
      span.innerHTML = el.innerHTML || '&nbsp;'
      el.parentNode.replaceChild(span, el)
    })
  }
  
  // Trigger save
  editor.dispatchEvent(new Event('input'))
}

// NEW: Update toolbar button states based on cursor position
function updateToolbarStates() {
  // Check current formatting at cursor position
  const boldBtn = document.getElementById('bold-btn')
  const italicBtn = document.getElementById('italic-btn')
  const underlineBtn = document.getElementById('underline-btn')
  const bulletBtn = document.getElementById('bullet-btn')
  const numberBtn = document.getElementById('number-btn')
  
  // Use browser's queryCommandState to check formatting
  boldBtn.classList.toggle('active', document.queryCommandState('bold'))
  italicBtn.classList.toggle('active', document.queryCommandState('italic'))
  underlineBtn.classList.toggle('active', document.queryCommandState('underline'))
  bulletBtn.classList.toggle('active', document.queryCommandState('insertUnorderedList'))
  numberBtn.classList.toggle('active', document.queryCommandState('insertOrderedList'))
}
function setFontSize(size) {
  const editor = document.getElementById('notes')
  editor.focus()
  
  // Convert pixel size to execCommand scale (1-7)
  let commandSize
  if (size <= 12) commandSize = 1
  else if (size <= 14) commandSize = 2  
  else if (size <= 16) commandSize = 3
  else if (size <= 18) commandSize = 4
  else if (size <= 24) commandSize = 5
  else if (size <= 32) commandSize = 6
  else commandSize = 7
  
  document.execCommand('fontSize', false, commandSize)
}

// Function to update opacity
function updateOpacity(value) {
  currentOpacity = value

  // For transparent window effect, we need to change the background alpha values
  const header = document.querySelector('.header')
  const controls = document.querySelector('.controls')
  const appLayout = document.querySelector('.app-layout')
  const content = document.querySelector('.content')
  const notesWrapper = document.getElementById('notes-wrapper')
  const editor = document.getElementById('notes')
  const mainColumn = document.querySelector('.main-column')

  // Calculate the actual opacity for the notes area (minimum 40%)
  const notesOpacity = Math.max(value, 0.4)

  // Apply rgba backgrounds with the opacity value for window transparency
  document.body.style.backgroundColor = `rgba(255, 255, 255, ${value * 0.95})`

  // Header and controls always fully opaque backgrounds
  header.style.backgroundColor = '#f8f9fa'
  controls.style.backgroundColor = '#ffffff'

  if (appLayout) {
    appLayout.style.backgroundColor = `rgba(255, 255, 255, ${value})`
  }

  // Content area with variable transparency
  content.style.backgroundColor = `rgba(255, 255, 255, ${value})`

  if (mainColumn) {
    mainColumn.style.backgroundColor = `rgba(255, 255, 255, ${value})`
  }

  // Notes wrapper with minimum 40% opacity
  notesWrapper.style.backgroundColor = `rgba(255, 255, 255, ${notesOpacity * 0.95})`

    // NEW: Apply opacity to toolbar
    // const toolbar = document.querySelector('.text-toolbar')
    // if (toolbar) {
    //   toolbar.style.backgroundColor = `rgba(255, 255, 255, ${value})`
    // }

  // If opacity is very low, enhance text readability
  if (value < 0.4) {
    editor.style.fontWeight = '400'
    editor.style.textShadow = '0 0 2px rgba(255,255,255,0.8)'
  } else {
    editor.style.fontWeight = 'normal'
    editor.style.textShadow = 'none'
  }

  // Update the display
  const percentage = Math.round(value * 100)
  document.getElementById('opacity-value').textContent = percentage + '%'
  document.getElementById('opacity-slider').value = percentage
}

function applySidebarState(collapsed, { persist = false, suppressAnimation = false } = {}) {
  const body = document.body
  const toggle = document.getElementById('sidebar-toggle')

  if (!body) return

  const isCollapsed = !!collapsed

  if (suppressAnimation) {
    body.classList.add('sidebar-initializing')
  }

  sidebarCollapsed = isCollapsed
  body.classList.toggle('sidebar-collapsed', isCollapsed)

  if (toggle) {
    toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true')
    toggle.setAttribute('aria-label', isCollapsed ? 'Show sidebar' : 'Hide sidebar')
    const hint = sidebarToggleShortcutHint
    toggle.title = isCollapsed ? `Show sidebar (${hint})` : `Hide sidebar (${hint})`
  }

  if (persist && window.api.saveSidebarState) {
    window.api.saveSidebarState(isCollapsed)
  }

  if (suppressAnimation) {
    requestAnimationFrame(() => {
      body.classList.remove('sidebar-initializing')
    })
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const editor = document.getElementById('notes')
  const opacitySlider = document.getElementById('opacity-slider')
  const toolbarWrapper = document.getElementById('toolbar-wrapper')
  const toolbarToggle = document.getElementById('toolbar-toggle')
  const sidebarToggle = document.getElementById('sidebar-toggle')
  const privacyCheckbox = document.getElementById('privacy-checkbox')
  const saveStatus = document.getElementById('save-status')
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

  sidebarToggleShortcutHint = isMac ? '⌥⌘S' : 'Ctrl+Alt+S'

  // Initialize opacity to ensure proper setup
  updateOpacity(1.0)

  if (opacitySlider) {
    opacitySlider.style.background = 'linear-gradient(to right, var(--blue-primary) 0%, var(--blue-primary) 100%, var(--bg-tertiary) 100%, var(--bg-tertiary) 100%)'
  }

  const loadedState = await window.api.loadNotes()
  const { notes, privacy, sidebarCollapsed: savedSidebarCollapsed } = loadedState

  if (editor) {
    editor.innerHTML = notes
  }

  if (privacyCheckbox) {
    privacyCheckbox.checked = privacy
  }

  const initialSidebarCollapsed = typeof savedSidebarCollapsed === 'boolean' ? savedSidebarCollapsed : true
  applySidebarState(initialSidebarCollapsed, { suppressAnimation: true })
  updatePrivacyBadge(privacy)

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      applySidebarState(!sidebarCollapsed, { persist: true })
    })
  }

  window.addEventListener('keydown', (event) => {
    const primaryModifier = isMac ? event.metaKey : event.ctrlKey

    if (!primaryModifier || !event.altKey) return
    if (event.key.toLowerCase() !== 's') return

    event.preventDefault()
    applySidebarState(!sidebarCollapsed, { persist: true })
  })

  if (editor) {
    editor.addEventListener('input', (e) => {
      if (saveStatus) {
        saveStatus.textContent = 'Saving...'
      }
      clearTimeout(saveTimeout)

      saveTimeout = setTimeout(() => {
        window.api.saveNotes({
          notes: e.target.innerHTML,
          privacy: privacyCheckbox ? privacyCheckbox.checked : true,
          sidebarCollapsed
        })

        if (saveStatus) {
          saveStatus.textContent = 'Saved'

          setTimeout(() => {
            saveStatus.textContent = ''
          }, 2000)
        }
      }, 500)
    })
  }

  if (editor) {
    // NEW: Update toolbar states when cursor moves or text selection changes
    editor.addEventListener('selectionchange', updateToolbarStates)
    editor.addEventListener('keyup', updateToolbarStates)
    editor.addEventListener('mouseup', updateToolbarStates)

    // NEW: Keyboard shortcuts for text formatting
    editor.addEventListener('keydown', (e) => {
      const cmdKey = isMac ? e.metaKey : e.ctrlKey

      if (!cmdKey) return

      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          insertTextFormat('bold')
          break

        case 'i':
          e.preventDefault()
          insertTextFormat('italic')
          break

        case 'u':
          e.preventDefault()
          insertTextFormat('underline')
          break

        case 'l':
          e.preventDefault()
          insertListItem('bullet')
          break

        case 'd':
          e.preventDefault()
          insertListItem('number')
          break
      }
    })
  }

  if (opacitySlider) {
    // Opacity slider
    opacitySlider.addEventListener('input', (e) => {
      const value = e.target.value / 100
      const percentage = e.target.value

      // Update slider background with gradient
      e.target.style.background = `linear-gradient(to right, var(--blue-primary) 0%, var(--blue-primary) ${percentage}%, var(--bg-tertiary) ${percentage}%, var(--bg-tertiary) 100%)`

      updateOpacity(value)
    })
  }



  // Font size dropdown
  const dropdown = document.getElementById('font-size-select')

  if (dropdown) {
    dropdown.addEventListener('change', (e) => {
      const size = e.target.value
      setFontSize(size)
    })
  }

  if (toolbarToggle && toolbarWrapper) {
    const updateToolbarToggleState = () => {
      toolbarWrapper.classList.toggle('toolbar-hidden', !toolbarVisible)

      const label = toolbarToggle.querySelector('.toggle-label')
      if (label) {
        label.textContent = toolbarVisible ? 'Hide toolbar' : 'Show toolbar'
      }

      toolbarToggle.setAttribute('aria-expanded', toolbarVisible ? 'true' : 'false')
      toolbarToggle.setAttribute('aria-label', toolbarVisible ? 'Hide toolbar' : 'Show toolbar')
    }

    toolbarToggle.addEventListener('click', () => {
      toolbarVisible = !toolbarVisible
      updateToolbarToggleState()
    })

    updateToolbarToggleState()
  }

  // File input for imports (hidden, triggered programmatically)
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.style.display = 'none'
  document.body.appendChild(fileInput)

  // Handle file selection for imports
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const content = await readFile(file)

      if (file.name.endsWith('.json')) {
        // Import JSON backup
        const data = JSON.parse(content)
        if (data.notes) {
          if (editor) {
            editor.innerHTML = data.notes
          }
          await window.api.saveNotes({
            notes: data.notes,
            privacy: privacyCheckbox ? privacyCheckbox.checked : true,
            sidebarCollapsed
          })
        }
      } else {
        // Import as plain text/markdown
        if (editor) {
          editor.innerHTML = content
        }
        await window.api.saveNotes({
          notes: content,
          privacy: privacyCheckbox ? privacyCheckbox.checked : true,
          sidebarCollapsed
        })
      }
    } catch (error) {
      console.error('Import failed:', error)
    }

    // Reset file input
    fileInput.value = ''
  })

  if (privacyCheckbox) {
    privacyCheckbox.addEventListener('change', async (e) => {
      const on = e.target.checked
      await window.api.togglePrivacy()   // main process flips window
      updatePrivacyBadge(on)
    })
  }

  // Export handlers
  window.api.onExportNotes(async () => {
    const notes = editor.innerHTML
    const timestamp = new Date().toISOString().split('T')[0]
    downloadFile(notes, `presenter-notes-${timestamp}.md`, 'text/markdown')
  })

  window.api.onImportNotes(() => {
    fileInput.accept = '.txt,.md,.markdown'
    fileInput.click()
  })

  window.api.onExportBackup(async () => {
    const notes = editor.innerHTML
    const timestamp = new Date().toISOString()
    const backup = {
      notes: notes,
      exportedAt: timestamp,
      fontSize: currentFontSize,
      opacity: currentOpacity
    }
    downloadFile(JSON.stringify(backup, null, 2), `notes-backup-${timestamp.split('T')[0]}.json`, 'application/json')
  })

  window.api.onImportBackup(() => {
    fileInput.accept = '.json'
    fileInput.click()
  })

// NEW: Toolbar button functionality
document.getElementById('bold-btn').addEventListener('click', () => {
  insertTextFormat('bold')
})

document.getElementById('italic-btn').addEventListener('click', () => {
  insertTextFormat('italic')
})

document.getElementById('underline-btn').addEventListener('click', () => {
  insertTextFormat('underline')
})

document.getElementById('bullet-btn').addEventListener('click', () => {
  insertListItem('bullet')
})

document.getElementById('number-btn').addEventListener('click', () => {
  insertListItem('number')
})

})



// Handle font size changes from menu
window.api.onFontSizeChange((event, direction) => {
  updateFontSize(direction)
})

// Handle opacity changes from menu
window.api.onOpacityChange((event, opacity) => {
  updateOpacity(opacity)
})

// Handle click-through mode toggle
window.api.onToggleClickThrough((event, isClickThrough) => {
  const body = document.body
  const editor = document.getElementById('notes')
  const controls = document.querySelector('.controls')

  if (isClickThrough) {
    body.classList.add('click-through')
    editor.contentEditable = 'false'
    editor.style.cursor = 'default'
    controls.style.pointerEvents = 'none'
    controls.style.opacity = '0.5'

    editor.placeholder = 'CLICK-THROUGH MODE ACTIVE

Window won\'t intercept clicks.
Press Cmd+Shift+T to edit notes again.'
  } else {
    body.classList.remove('click-through')
    editor.contentEditable = 'true'
    editor.style.cursor = 'text'
    controls.style.pointerEvents = 'auto'
    controls.style.opacity = '1'

    editor.placeholder = 'Type your presenter notes here...

• They auto-save as you type
• Won\'t appear in screenshots
• Always stays on top

Global Shortcuts:
• Cmd+Shift+N: Toggle window
• Cmd+Shift+O: Cycle opacity
• Cmd+Shift+T: Click-through mode
• Cmd+Shift+Plus/Minus: Font size'
  }

})

// 4-D  listen if menu (or main) toggled privacy
window.api.onPrivacyChanged((e, on) => {
  document.getElementById('privacy-checkbox').checked = on;
  updatePrivacyBadge(on);
});

function updatePrivacyBadge(on) {
  document.querySelector('.privacy-badge').style.display = on ? 'inline-block' : 'none';
}

```

### index.html - UI Layout & Styling
```html
<!DOCTYPE html>
<html>

<head>
  <title>Presenter Notes</title>
  <style>
    :root {
      /* Light mode color palette */

      --bg-primary: rgba(255, 255, 255, 1);
      /* Main white background */
      --bg-secondary: #f8f9fa;
      /* Slightly off-white for contrast */
      --bg-tertiary: #e9ecef;
      /* Light gray for borders/dividers */

      /* Blue accent colors */
      --blue-primary: #0066F3;
      /* Main blue for buttons */
      --blue-hover: #0056b3;
      /* Darker blue for hover states */
      --blue-light: #e3f2fd;
      /* Very light blue for backgrounds */
      --blue-border: #90caf9;
      /* Medium blue for borders */

      /* Text colors */
      --text-primary: #212529;
      /* Dark gray for main text */
      --text-secondary: #6c757d;
      /* Medium gray for secondary text */
      --text-muted: #adb5bd;
      /* Light gray for muted text */

      /* Status colors */
      --success: #28a745;
      /* Green for success states */
      --warning: #ffc107;
      /* Orange for warnings */
      --error: #dc3545;
      /* Red for errors */
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: rgba(255, 255, 255, 0.95);
      /* Using rgba */
      color: var(--text-primary);
      height: 100vh;
      display: flex;
      flex-direction: column;
      border-radius: 10px;
      overflow: hidden;
    }

    .header {
      background-color: rgba(248, 249, 250, 1);
      /* Fully opaque */
      border-bottom: 1px solid var(--bg-tertiary);
      padding: 8px 16px;
      -webkit-app-region: drag;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header h1 {
      color: var(--text-primary);
      font-size: 16px;
      font-weight: 600;
      margin: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: 56px;
    }

    .sidebar-toggle {
      -webkit-app-region: no-drag;
      width: 30px;
      height: 30px;
      border: none;
      border-radius: 6px;
      background: transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .sidebar-toggle:hover {
      background-color: rgba(0, 0, 0, 0.08);
    }

    .sidebar-toggle:focus-visible {
      outline: 2px solid var(--blue-primary);
      outline-offset: 2px;
    }

    .sidebar-toggle-icon {
      transition: transform 0.24s ease;
    }

    body:not(.sidebar-collapsed) .sidebar-toggle-icon {
      transform: rotate(180deg);
    }

    .app-layout {
      flex: 1;
      display: flex;
      overflow: hidden;
      background-color: var(--bg-secondary);
    }

    .sidebar {
      width: 200px;
      min-width: 200px;
      max-width: 200px;
      background: linear-gradient(180deg, #F6F7F9 0%, #EDEFF3 100%);
      border-right: 1px solid rgba(0, 0, 0, 0.05);
      box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.03);
      transition: width 0.24s ease, min-width 0.24s ease, opacity 0.24s ease;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }

    .sidebar::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 100%);
      opacity: 0.6;
    }

    .sidebar-content {
      position: relative;
      flex: 1;
      padding: 16px 20px;
    }

    .main-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background-color: rgba(255, 255, 255, 0.95);
      transition: background-color 0.2s ease;
    }

    body.sidebar-collapsed .sidebar {
      width: 0;
      min-width: 0;
      opacity: 0;
      pointer-events: none;
      border-right-color: transparent;
      box-shadow: none;
    }

    body.sidebar-collapsed .sidebar::after {
      opacity: 0;
    }

    body.sidebar-initializing .sidebar,
    body.sidebar-initializing .sidebar-toggle-icon,
    body.sidebar-initializing .sidebar::after {
      transition: none !important;
    }

    .title {
      font-size: 14px;
      font-weight: 500;
      opacity: 0.9;
    }

    #save-status {
      font-size: 11px;
      color: var(--success);
      min-width: 60px;
      text-align: right;
    }

    .badge-container {
      display: flex;
      align-items: center;
    }

    .privacy-badge {
      background-color: #ddffe4;
      border: none;
      color: #157c2d;
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      display: inline-block;
      /* box-shadow: 0 2px 4px rgba(0, 102, 204, 0.2); */
    }

    /* ===== privacy toggle switch ===== */
    .privacy-switch {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 16px;
      margin-left: 8px;
      -webkit-app-region: no-drag;
    }

    .privacy-switch input {
      opacity: 0;
      width: 0;
      height: 0
    }

    .privacy-switch .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .3s;
      border-radius: 24px
    }

    .privacy-switch .slider:before {
      position: absolute;
      content: "";
      height: 10px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 8px;
    }

    .privacy-switch input:checked+.slider {
      background-color: var(--success)
    }

    .privacy-switch input:checked+.slider:before {
      transform: translateX(14px)
    }

    /* Click-through mode styling */
    body.click-through {
      animation: click-through-pulse 2s infinite;
    }

    @keyframes click-through-pulse {

      0%,
      100% {
        border-color: var(--bg-tertiary);
        box-shadow: 0 0 10px rgba(255, 165, 0, 0.3);
      }

      50% {
        border-color: var(--bg-tertiary);
        box-shadow: 0 0 20px rgba(255, 165, 0, 0.5);
      }
    }

    /* 
    body.click-through .header {
      background-color: var(--bg-primary);
    }

    body.click-through #notes {
      background-color: var(--bg-primary);
      border-color: var(--bg-tertiary);
    } */

    body.click-through .click-through-badge {
      display: inline-block;
    }

    .click-through-badge {
      display: none;
      background-color: var(--warning);
      color: white;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
      animation: pulse 2s infinite;
    }

    .content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      background-color: rgba(255, 255, 255, 0.95);
      /* Using rgba */
    }

    /* Text editing toolbar */
    .toolbar-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      padding: 0 4px;
      gap: 1px;
      border-bottom: 1px solid #D9DADB;
      -webkit-app-region: no-drag;
      background: linear-gradient(180deg, #F8F9FA 0%, #F3F4F5 100%);
    }

    .toolbar-wrapper::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, #F8F9FA 0%, #F3F4F5 100%);
      z-index: -1;
    }

    .toolbar-wrapper.toolbar-hidden {
      justify-content: flex-end;
      background: transparent;
      border-bottom: none;
      padding: 0 16px;
      gap: 0;
    }

    .toolbar-wrapper.toolbar-hidden::before {
      display: none;
    }

    .toolbar-content {
      display: flex;
      align-items: center;
      gap: 1px;
      flex: 1;
    }

    .toolbar-wrapper.toolbar-hidden .toolbar-content {
      display: none;
    }

    .font-size-control {
      display: flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(180deg, #F8F9FA 0%, #F3F4F5 100%);
      border-radius: 4px;
      padding: 0 8px;
      min-height: 32px;
    }

    .font-size-control label {
      font-size: 13px;
      color: #111;
    }

    .font-size-select-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    #font-size-select {
      height: 32px;
      padding: 0 24px 0 6px;
      border: none;
      background-color: transparent;
      color: #111;
      font-size: 13px;
      line-height: 1.4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: pointer;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      min-width: 64px;
    }

    .font-size-select-wrapper::after {
      content: '';
      position: absolute;
      pointer-events: none;
      right: 6px;
      top: 50%;
      width: 12px;
      height: 12px;
      transform: translateY(-50%);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M8.51528 7.98474C8.55014 8.01957 8.5778 8.06092 8.59667 8.10645C8.61555 8.15197 8.62526 8.20077 8.62526 8.25005C8.62526 8.29933 8.61555 8.34813 8.59667 8.39365C8.5778 8.43918 8.55014 8.48054 8.51528 8.51536L6.26528 10.7654C6.23045 10.8002 6.18909 10.8279 6.14357 10.8468C6.09804 10.8656 6.04925 10.8753 5.99996 10.8753C5.95068 10.8753 5.90189 10.8656 5.85636 10.8468C5.81084 10.8279 5.76948 10.8002 5.73465 10.7654L3.48465 8.51536C3.41429 8.445 3.37476 8.34956 3.37476 8.25005C3.37476 8.15054 3.41429 8.0551 3.48465 7.98474C3.55502 7.91437 3.65045 7.87484 3.74996 7.87484C3.84948 7.87484 3.94491 7.91437 4.01528 7.98474L5.99996 9.96989L7.98465 7.98474C8.01948 7.94987 8.06084 7.92221 8.10636 7.90334C8.15189 7.88447 8.20068 7.87476 8.24996 7.87476C8.29925 7.87476 8.34804 7.88447 8.39357 7.90334C8.43909 7.92221 8.48045 7.94987 8.51528 7.98474ZM4.01528 4.01536L5.99996 2.03021L7.98465 4.01536C8.05502 4.08573 8.15045 4.12526 8.24996 4.12526C8.34948 4.12526 8.44491 4.08573 8.51528 4.01536C8.58564 3.945 8.62517 3.84956 8.62517 3.75005C8.62517 3.65054 8.58564 3.5551 8.51528 3.48474L6.26528 1.23474C6.23045 1.19987 6.18909 1.17221 6.14357 1.15334C6.09804 1.13447 6.04925 1.12476 5.99996 1.12476C5.95068 1.12476 5.90189 1.13447 5.85636 1.15334C5.81084 1.17221 5.76948 1.19987 5.73465 1.23474L3.48465 3.48474C3.41429 3.5551 3.37476 3.65054 3.37476 3.75005C3.37476 3.84956 3.41429 3.945 3.48465 4.01536C3.55502 4.08573 3.65045 4.12526 3.74996 4.12526C3.84948 4.12526 3.94491 4.08573 4.01528 4.01536Z' fill='black'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-size: 12px 12px;
    }

    .toolbar-buttons {
      display: flex;
      align-items: center;
      gap: 1px;
      background: #ffffff;
      padding: 0;
      border-radius: 4px;
      overflow: hidden;
    }

    .toolbar-btn {
      width: 34px;
      height: 32px;
      border: none;
      background: #F8F9FA;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      transition: background-color 0.1s ease;
      background: linear-gradient(180deg, #F8F9FA 0%, #F3F4F5 100%);
    }

    .toolbar-btn:first-child {
      border-radius: 4px 0 0 4px;
    }

    .toolbar-btn:last-child {
      border-radius: 0 4px 4px 0;
    }

    .toolbar-btn:focus-visible {
      outline: 2px solid #0066F3;
      outline-offset: 1px;
    }

    .toolbar-btn.active {
      background: #E6E7E8;
    }
    .toolbar-btn:hover {
      background-color: #EFEFEF;
    }

    .toolbar-btn svg {
      pointer-events: none;
    }

    .toolbar-toggle {
      display: flex;
      align-items: center;
      gap: 4px;
      border: none;
      background: none;
      color: #0066F3;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      padding: 0 8px;
      height: 32px;
      margin-left: auto;
    }

    .toolbar-toggle svg {
      display: block;
    }

    .toolbar-wrapper.toolbar-hidden .toolbar-toggle {
      padding: 0;
      margin-left: 0;
    }

    .toolbar-wrapper.toolbar-hidden .toolbar-toggle .toggle-icon--hide {
      display: none;
    }

    .toolbar-wrapper:not(.toolbar-hidden) .toolbar-toggle .toggle-icon--show {
      display: none;
    }

    #notes-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
      background-color: var(--bg-primary);
      transition: background-color 0.2s ease;
    }

    #notes {
      flex: 1;
      background-color: transparent;
      color: var(--text-primary);
      border: none;
      padding: 12px 24px;
      font-size: 14px;
      line-height: 1.5;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      outline: none;
      transition: font-weight 0.2s ease, text-shadow 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    #notes:empty:before {
      content: attr(data-placeholder);
      color: var(--text-secondary);
      pointer-events: none;
      white-space: pre-wrap;
    }


    #notes::placeholder {
      color: var(--text-secondary);
    }

    /* Controls bar */
    .controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      padding: 10px 15px;
      background-color: rgba(255, 255, 255, 1);
      /* Fully opaque */
      border-top: 1px solid var(--bg-tertiary);
      -webkit-app-region: no-drag;
    }

    .control-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .control-label {
      font-size: 11px;
      color: var(--text-secondary);
      min-width: 50px;
    }

    /* Opacity slider */
    .slider {
      -webkit-appearance: none;
      width: 100%;
      height: 4px;
      background: var(--bg-tertiary);
      border-radius: 2px
    }

    .slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 14px;
      background: white;
      border-radius: 8px;
      border: 0.5px solid rgba(0, 0, 0, 0.02);
      cursor: pointer;
      box-shadow: 0 0 6px 0 rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.08);
      transition: transform 0.2s ease;
    }

    .slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
    }

    /* Opacity slider with blue fill */
    .opacity-slider {
      -webkit-appearance: none;
      width: 100%;
      height: 4px;
      background: linear-gradient(to right, var(--blue-primary) 0%, var(--blue-primary) var(--slider-value, 100%), var(--bg-tertiary) var(--slider-value, 100%), var(--bg-tertiary) 100%);
      border-radius: 2px;
      outline: none;
    }

    .opacity-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 14px;
      background: #ffffff;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 0 6px 0 rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.08);
      transition: transform 0.2s ease;
    }

    .opacity-slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
    }

    #opacity-value {
      font-size: 11px;
      color: var(--text-secondary);
      min-width: 35px;
    }



    /* Custom scrollbar for textarea */
    #notes::-webkit-scrollbar {
      width: 8px;
    }

    #notes::-webkit-scrollbar-track {
      background: var(--bg-tertiary);
      border-radius: 4px;
    }

    #notes::-webkit-scrollbar-thumb {
      background: var(--bg-tertiary);
      border-radius: 4px;
    }

    #notes::-webkit-scrollbar-thumb:hover {
      background: var(--bg-tertiary);
    }
  </style>
</head>

<body class="sidebar-collapsed">
  <div class="header">
    <div class="header-left">
      <button class="sidebar-toggle" id="sidebar-toggle" type="button" aria-label="Show sidebar" aria-expanded="false"
        aria-controls="app-sidebar">
        <svg class="sidebar-toggle-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"
          fill="none" aria-hidden="true">
          <line x1="4.25" y1="4" x2="4.25" y2="14" stroke="#3A3A3C" stroke-width="1.5" stroke-linecap="round" />
          <path d="M10.25 5.75L13.5 9L10.25 12.25" stroke="#3A3A3C" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </button>
    </div>
    <div class="badge-container">
      <span class="privacy-badge">PRIVACY MODE</span>
      <label class="privacy-switch">
        <input type="checkbox" id="privacy-checkbox" checked />
        <span class="slider round" style="height: 16px;"></span>
      </label>

      <span class="click-through-badge">CLICK-THROUGH</span>
    </div>
  </div>



  <div class="app-layout">
    <aside id="app-sidebar" class="sidebar" role="complementary" aria-label="Sidebar">
      <div class="sidebar-content" aria-hidden="true"></div>
    </aside>

    <div class="main-column">
      <div class="content">
        <div class="toolbar-wrapper" id="toolbar-wrapper">
          <div class="toolbar-content">
            <div class="font-size-control">
          <label for="font-size-select">Font size</label>
          <div class="font-size-select-wrapper">
            <select id="font-size-select" title="Font Size">
              <option value="12">12</option>
              <option value="14">14</option>
              <option value="16" selected>16</option>
              <option value="18">18</option>
              <option value="20">20</option>
              <option value="24">24</option>
              <option value="28">28</option>
              <option value="32">32</option>
              <option value="36">36</option>
            </select>
          </div>
        </div>

        <div class="toolbar-buttons">
          <button class="toolbar-btn" id="bold-btn" title="Bold (Cmd+B)">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 9.99992H12.5C13.3841 9.99992 14.2319 10.3511 14.857 10.9762C15.4821 11.6014 15.8333 12.4492 15.8333 13.3333C15.8333 14.2173 15.4821 15.0652 14.857 15.6903C14.2319 16.3154 13.3841 16.6666 12.5 16.6666H5.83333C5.61232 16.6666 5.40036 16.5788 5.24408 16.4225C5.0878 16.2662 5 16.0543 5 15.8333V4.16659C5 3.94557 5.0878 3.73361 5.24408 3.57733C5.40036 3.42105 5.61232 3.33325 5.83333 3.33325H11.6667C12.5507 3.33325 13.3986 3.68444 14.0237 4.30956C14.6488 4.93468 15 5.78253 15 6.66659C15 7.55064 14.6488 8.39849 14.0237 9.02361C13.3986 9.64873 12.5507 9.99992 11.6667 9.99992" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="toolbar-btn" id="italic-btn" title="Italic (Cmd+I)">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15.8333 3.33325H8.33325" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M11.6667 16.6667H4.16675" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M12.5 3.33325L7.5 16.6666" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="toolbar-btn" id="underline-btn" title="Underline (Cmd+U)">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 3.33325V8.33325C5 9.65933 5.52678 10.9311 6.46447 11.8688C7.40215 12.8065 8.67392 13.3333 10 13.3333C11.3261 13.3333 12.5979 12.8065 13.5355 11.8688C14.4732 10.9311 15 9.65933 15 8.33325V3.33325" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M3.33325 16.6667H16.6666" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="toolbar-btn" id="bullet-btn" title="Bullet List (Cmd+L)">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2.5 4.16675H2.50833" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M2.5 10H2.50833" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M2.5 15.8333H2.50833" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M6.66675 4.16675H17.5001" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M6.66675 10H17.5001" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M6.66675 15.8333H17.5001" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="toolbar-btn" id="number-btn" title="Numbered List (Cmd+D)">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M9.16675 4.16675H17.5001" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M9.16675 10H17.5001" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M9.16675 15.8333H17.5001" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M3.33325 3.33325H4.16659V7.49992" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M3.33325 7.5H4.99992" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M5.41659 16.6666H2.83325C2.83325 15.8333 4.99992 15.0624 4.99992 13.7499C4.99995 13.4987 4.92426 13.2532 4.78271 13.0456C4.64117 12.838 4.44034 12.6779 4.20643 12.5861C3.97252 12.4943 3.71638 12.4752 3.47143 12.5312C3.22648 12.5872 3.00408 12.7157 2.83325 12.8999" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
            </div>
          </div>

          <button class="toolbar-toggle" id="toolbar-toggle" type="button">
            <span class="toggle-label">Hide toolbar</span>
            <span class="toggle-icon toggle-icon--hide" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.94874 1.89326C2.91032 1.84995 2.86369 1.8147 2.81154 1.78954C2.7594 1.76439 2.70278 1.74984 2.64497 1.74673C2.58716 1.74362 2.5293 1.75201 2.47476 1.77142C2.42022 1.79084 2.37007 1.82088 2.32723 1.85982C2.28438 1.89876 2.24969 1.94581 2.22516 1.99825C2.20064 2.0507 2.18676 2.10749 2.18435 2.16533C2.18193 2.22317 2.19102 2.28092 2.21109 2.33523C2.23115 2.38954 2.2618 2.43932 2.30124 2.48169L3.35343 3.63943C1.36718 4.85841 0.512964 6.73748 0.475229 6.82279C0.450354 6.87874 0.4375 6.93929 0.4375 7.00052C0.4375 7.06175 0.450354 7.12231 0.475229 7.17826C0.49437 7.22146 0.957573 8.24849 1.98734 9.27826C3.35945 10.6498 5.09249 11.375 6.99999 11.375C7.98033 11.3806 8.95076 11.1787 9.84757 10.7827L11.0507 12.1067C11.0891 12.15 11.1358 12.1853 11.1879 12.2104C11.24 12.2356 11.2967 12.2501 11.3545 12.2532C11.4123 12.2563 11.4701 12.2479 11.5247 12.2285C11.5792 12.2091 11.6294 12.1791 11.6722 12.1401C11.7151 12.1012 11.7498 12.0541 11.7743 12.0017C11.7988 11.9493 11.8127 11.8925 11.8151 11.8346C11.8175 11.7768 11.8084 11.719 11.7884 11.6647C11.7683 11.6104 11.7376 11.5606 11.6982 11.5183L2.94874 1.89326ZM5.5371 6.04076L7.81593 8.54818C7.47276 8.72871 7.07936 8.79016 6.69748 8.72287C6.31561 8.65558 5.96689 8.46337 5.7061 8.17642C5.44531 7.88946 5.2872 7.52402 5.25661 7.13747C5.22603 6.75092 5.32469 6.36516 5.5371 6.04076ZM6.99999 10.5C5.31671 10.5 3.84617 9.88802 2.62882 8.68162C2.12915 8.18504 1.70418 7.6186 1.36718 6.99998C1.62367 6.51927 2.44234 5.17396 3.95663 4.29951L4.94101 5.37959C4.55991 5.86767 4.36364 6.47478 4.38688 7.09359C4.41012 7.71239 4.65138 8.30306 5.06801 8.76119C5.48465 9.21932 6.04983 9.51541 6.66366 9.59712C7.27749 9.67882 7.90045 9.5409 8.42242 9.20771L9.22796 10.0936C8.51702 10.3664 7.76145 10.5042 6.99999 10.5ZM7.32812 5.28115C7.21412 5.25939 7.11343 5.19324 7.0482 5.09724C6.98297 5.00125 6.95855 4.88327 6.98031 4.76927C7.00206 4.65527 7.06822 4.55458 7.16421 4.48935C7.26021 4.42413 7.37818 4.3997 7.49218 4.42146C8.04978 4.52956 8.55749 4.81502 8.93959 5.23526C9.32169 5.6555 9.5577 6.188 9.61242 6.75334C9.62322 6.86886 9.58769 6.98394 9.51364 7.07327C9.43959 7.1626 9.3331 7.21885 9.21757 7.22966C9.20391 7.23047 9.19022 7.23047 9.17656 7.22966C9.06721 7.23013 8.96165 7.18963 8.88067 7.11615C8.79969 7.04266 8.74917 6.94151 8.73906 6.83263C8.70223 6.4566 8.54503 6.10249 8.29082 5.82296C8.03661 5.54343 7.69898 5.35341 7.32812 5.28115ZM13.5231 7.17826C13.5002 7.22966 12.9462 8.4563 11.6987 9.57357C11.6561 9.61296 11.6061 9.64348 11.5516 9.66334C11.497 9.68321 11.4391 9.69203 11.3811 9.68928C11.3231 9.68654 11.2663 9.67228 11.2139 9.64735C11.1615 9.62242 11.1145 9.58731 11.0758 9.54407C11.0371 9.50082 11.0074 9.45031 10.9884 9.39547C10.9694 9.34062 10.9615 9.28255 10.9652 9.22463C10.9688 9.16671 10.984 9.11009 11.0098 9.05808C11.0355 9.00607 11.0714 8.95971 11.1152 8.92169C11.7272 8.37188 12.2413 7.72205 12.6355 6.99998C12.2978 6.38079 11.8719 5.81396 11.3712 5.31724C10.1538 4.11193 8.68328 3.49998 6.99999 3.49998C6.64532 3.49954 6.29121 3.52826 5.94124 3.58584C5.88433 3.5959 5.82599 3.59459 5.76959 3.58198C5.71319 3.56937 5.65984 3.5457 5.61264 3.51236C5.56543 3.47901 5.5253 3.43665 5.49456 3.3877C5.46383 3.33876 5.44309 3.28421 5.43355 3.22721C5.42402 3.17021 5.42587 3.11188 5.439 3.0556C5.45214 2.99932 5.47629 2.94619 5.51007 2.8993C5.54385 2.85241 5.58659 2.81267 5.63582 2.78239C5.68504 2.7521 5.73978 2.73187 5.79687 2.72287C6.19454 2.65721 6.59694 2.62446 6.99999 2.62498C8.90749 2.62498 10.6405 3.35013 12.0127 4.72224C13.0424 5.75201 13.5056 6.77959 13.5248 6.82279C13.5496 6.87874 13.5625 6.93929 13.5625 7.00052C13.5625 7.06175 13.5496 7.12231 13.5248 7.17826H13.5231Z" fill="#0066F3" />
        </span>
        <span class="toggle-icon toggle-icon--show" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 3.25C3.79167 3.25 1.75 6.06042 1.75 7C1.75 7.93958 3.79167 10.75 7 10.75C10.2083 10.75 12.25 7.93958 12.25 7C12.25 6.06042 10.2083 3.25 7 3.25Z" stroke="#0066F3" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M7 8.75C7.9665 8.75 8.75 7.9665 8.75 7C8.75 6.0335 7.9665 5.25 7 5.25C6.0335 5.25 5.25 6.0335 5.25 7C5.25 7.9665 6.0335 8.75 7 8.75Z" stroke="#0066F3" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
          </button>
        </div>

        <div id="notes-wrapper">
          <div id="notes" contenteditable="true" spellcheck="true"></div>
        </div>
      </div>

      <!-- Controls bar -->
      <div class="controls">
        <div class="control-group">
          <span class="control-label">Opacity</span>
          <input type="range" class="opacity-slider" id="opacity-slider" min="10" max="100" value="100">
          <span id="opacity-value">100%</span>
        </div>
        <div id="save-status"></div>
      </div>
    </div>
  </div>

  <script src="renderer.js"></script>
</body>

</html>

```
