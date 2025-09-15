# Presenter Notes App - Complete Project Documentation

## Project Overview
A privacy-focused Electron-based macOS app for presenter notes that stay hidden from screenshots and screen shares. Built with content protection API and designed for seamless presentation use.

**Author:** Evan Pizzolato  
**Version:** 0.1.0  
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
│   ├── icon.icns             # macOS app icon
│   ├── icon.png              # PNG version
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
- **camelCase** for functions: `createWindow()`, `updateOpacity()`, `showNotification()`
- **kebab-case** for CSS classes: `click-through`, `font-controls`, `privacy-badge`
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
- **Data Persistence**: Handles file I/O for notes storage

### Renderer Process (`renderer.js`)
- **UI Logic**: Manages textarea, controls, and user interactions
- **Auto-save**: Debounced saving with 500ms delay
- **Import/Export**: File handling for notes backup and sharing
- **Notifications**: Toast messages for user feedback
- **State Management**: Tracks font size, opacity, and click-through mode

### Preload Script (`preload.js`)
- **Security Bridge**: Exposes safe APIs to renderer via contextBridge
- **IPC Wrapper**: Provides clean interface for main-renderer communication

## Key Features & Implementation

### 1. Privacy Protection
```javascript
mainWindow.setContentProtection(true)  // Hides from screenshots
```
- Visual "PRIVATE MODE ON" badge
- Works with macOS native screenshot tools
- Content protection API integration

### 2. Global Shortcuts (System-wide)
- `Cmd+Shift+N`: Toggle show/hide window
- `Cmd+Shift+O`: Cycle opacity (100% → 70% → 40% → 20% → 10%)
- `Cmd+Shift+T`: Toggle click-through mode
- `Cmd+Shift+Plus/Minus`: Adjust font size

### 3. Click-Through Mode
```javascript
mainWindow.setIgnoreMouseEvents(true)  // Clicks pass through
```
- Orange border visual indicator
- Disables text editing while active
- Useful for overlay during presentations

### 4. Data Persistence
- **Location**: `~/Library/Application Support/presenter-notes/notes.json`
- **Format**: JSON with notes content and metadata
- **Auto-save**: Debounced (500ms after typing stops)
- **Backup**: Export/import functionality

### 5. UI Controls
- Opacity slider (10-100%)
- Font size controls (+/-/reset)
- Save status indicator
- Notification toasts
- Enhanced transparency with text readability features

## Package Configuration

### Dependencies
```json
{
  "devDependencies": {
    "electron": "^latest",
    "electron-builder": "^latest"
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
npm start        # Development mode
npm run dist-mac # Create distribution DMG
```

## Complete Source Code

### main.js - Main Electron Process
```javascript
const { app, BrowserWindow, ipcMain, Menu, globalShortcut, Tray, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow
let tray = null  // Add tray variable

// Get the path where we'll store notes
const userDataPath = app.getPath('userData')
const notesPath = path.join(userDataPath, 'notes.json')



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
    
    // Show a quick notification of the opacity level
    const percentages = ['100%', '70%', '40%', '20%', '10%']
    mainWindow.webContents.send('show-notification', `Opacity: ${percentages[currentOpacityIndex]}`)
  }
})
  
  if (!opacityRegistered) {
    console.log('Failed to register Cmd+Shift+O - might be in use by another app')
  }
  
  // Quick font size shortcuts
  const fontIncreaseRegistered = globalShortcut.register('Command+Shift+Plus', () => {
    if (mainWindow) {
      mainWindow.webContents.send('change-font-size', 'increase')
      mainWindow.webContents.send('show-notification', 'Font size increased')
    }
  })
  
  const fontDecreaseRegistered = globalShortcut.register('Command+Shift+-', () => {
    if (mainWindow) {
      mainWindow.webContents.send('change-font-size', 'decrease')
      mainWindow.webContents.send('show-notification', 'Font size decreased')
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
      
      // Show notification
      const status = newState ? 'ON - Window won\'t block clicks' : 'OFF - Window is interactive'
      mainWindow.webContents.send('show-notification', `Click-through: ${status}`)
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
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',  // Add this line - fully transparent
    visibleOnAllWorkspaces: true,
    
    resizable: true,
    minWidth: 300,
    minHeight: 400,
    
    roundedCorners: true,
    
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.setContentProtection(true)
  console.log('Content protection enabled')
  
  mainWindow.loadFile('index.html')
}

// Handle saving notes from the renderer
ipcMain.on('save-notes', (event, notes) => {
  try {
    fs.writeFileSync(notesPath, JSON.stringify({ notes, savedAt: new Date() }))
    console.log('Notes saved')
  } catch (error) {
    console.error('Failed to save notes:', error)
  }
})

// Handle loading notes
ipcMain.handle('load-notes', () => {
  try {
    if (fs.existsSync(notesPath)) {
      const data = JSON.parse(fs.readFileSync(notesPath, 'utf8'))
      return data.notes
    }
    return ''
  } catch (error) {
    console.error('Failed to load notes:', error)
    return ''
  }
})

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

### renderer.js - Renderer Process (UI Logic)
```javascript
// This runs in your web page
let saveTimeout
let notificationTimeout
let currentFontSize = 18  // Default font size
let currentOpacity = 1.0  // Default opacity

// Function to show temporary notifications
function showNotification(message) {
  const notification = document.getElementById('notification')
  notification.textContent = message
  notification.style.display = 'block'
  
  clearTimeout(notificationTimeout)
  
  notificationTimeout = setTimeout(() => {
    notification.style.display = 'none'
  }, 1500)
}

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
  const textarea = document.getElementById('notes')
  
  if (direction === 'increase') {
    currentFontSize = Math.min(currentFontSize + 2, 32)
  } else if (direction === 'decrease') {
    currentFontSize = Math.max(currentFontSize - 2, 12)
  } else if (direction === 'reset') {
    currentFontSize = 18
  }
  
  textarea.style.fontSize = currentFontSize + 'px'
}

// Function to update opacity
function updateOpacity(value) {
  currentOpacity = value
  
  // For transparent window effect, we need to change the background alpha values
  const header = document.querySelector('.header')
  const controls = document.querySelector('.controls')
  const content = document.querySelector('.content')
  const notesWrapper = document.getElementById('notes-wrapper')
  const textarea = document.getElementById('notes')
  
  // Calculate the actual opacity for the notes area (minimum 40%)
  const notesOpacity = Math.max(value, 0.4)
  
  // Apply rgba backgrounds with the opacity value for window transparency
  document.body.style.backgroundColor = `rgba(255, 255, 255, ${value * 0.95})`
  
  // Header and controls always fully opaque backgrounds
  header.style.backgroundColor = 'rgba(248, 249, 250, 1)'
  controls.style.backgroundColor = 'rgba(255, 255, 255, 1)'
  
  // Content area with variable transparency
  content.style.backgroundColor = `rgba(255, 255, 255, ${value * 0.95})`
  
  // Notes wrapper with minimum 40% opacity
  notesWrapper.style.backgroundColor = `rgba(255, 255, 255, ${notesOpacity * 0.95})`
  
  // If opacity is very low, enhance text readability
  if (value < 0.4) {
    textarea.style.fontWeight = '400'
    textarea.style.textShadow = '0 0 2px rgba(255,255,255,0.8)'
  } else {
    textarea.style.fontWeight = 'normal'
    textarea.style.textShadow = 'none'
  }
  
  // Update the display
  const percentage = Math.round(value * 100)
  document.getElementById('opacity-value').textContent = percentage + '%'
  document.getElementById('opacity-slider').value = percentage
}

window.addEventListener('DOMContentLoaded', async () => {
  const textarea = document.getElementById('notes')
  const opacitySlider = document.getElementById('opacity-slider')
  
  // Initialize opacity to ensure proper setup
  updateOpacity(1.0)
  
  // Load saved notes
  const savedNotes = await window.api.loadNotes()
  if (savedNotes) {
    textarea.value = savedNotes
  }
  
  // Auto-save as user types (with debounce)
  textarea.addEventListener('input', (e) => {
    document.getElementById('save-status').textContent = 'Saving...'
    clearTimeout(saveTimeout)
    
    saveTimeout = setTimeout(() => {
      window.api.saveNotes(e.target.value)
      document.getElementById('save-status').textContent = 'Saved'
      
      setTimeout(() => {
        document.getElementById('save-status').textContent = ''
      }, 2000)
    }, 500)
  })
  
  // Opacity slider
  opacitySlider.addEventListener('input', (e) => {
    const value = e.target.value / 100
    updateOpacity(value)
  })
  
  // Font size buttons
  document.getElementById('font-decrease').addEventListener('click', () => {
    updateFontSize('decrease')
    showNotification('Font size decreased')
  })
  
  document.getElementById('font-reset').addEventListener('click', () => {
    updateFontSize('reset')
    showNotification('Font size reset')
  })
  
  document.getElementById('font-increase').addEventListener('click', () => {
    updateFontSize('increase')
    showNotification('Font size increased')
  })
  
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
          textarea.value = data.notes
          await window.api.saveNotes(data.notes)
          showNotification('Backup imported successfully')
        }
      } else {
        // Import as plain text/markdown
        textarea.value = content
        await window.api.saveNotes(content)
        showNotification('Notes imported successfully')
      }
    } catch (error) {
      console.error('Import failed:', error)
      showNotification('Import failed')
    }
    
    // Reset file input
    fileInput.value = ''
  })
  
  // Export handlers
  window.api.onExportNotes(async () => {
    const notes = textarea.value
    const timestamp = new Date().toISOString().split('T')[0]
    downloadFile(notes, `presenter-notes-${timestamp}.md`, 'text/markdown')
    showNotification('Notes exported')
  })
  
  window.api.onImportNotes(() => {
    fileInput.accept = '.txt,.md,.markdown'
    fileInput.click()
  })
  
  window.api.onExportBackup(async () => {
    const notes = textarea.value
    const timestamp = new Date().toISOString()
    const backup = {
      notes: notes,
      exportedAt: timestamp,
      fontSize: currentFontSize,
      opacity: currentOpacity
    }
    downloadFile(JSON.stringify(backup, null, 2), `notes-backup-${timestamp.split('T')[0]}.json`, 'application/json')
    showNotification('Backup exported')
  })
  
  window.api.onImportBackup(() => {
    fileInput.accept = '.json'
    fileInput.click()
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

// Handle notification display
window.api.onShowNotification((event, message) => {
  showNotification(message)
})

// Handle click-through mode toggle
window.api.onToggleClickThrough((event, isClickThrough) => {
  const body = document.body
  const textarea = document.getElementById('notes')
  const controls = document.querySelector('.controls')
  
  if (isClickThrough) {
    body.classList.add('click-through')
    textarea.disabled = true
    textarea.style.cursor = 'default'
    controls.style.pointerEvents = 'none'
    controls.style.opacity = '0.5'
    
    textarea.placeholder = 'CLICK-THROUGH MODE ACTIVE\n\nWindow won\'t intercept clicks.\nPress Cmd+Shift+T to edit notes again.'
  } else {
    body.classList.remove('click-through')
    textarea.disabled = false
    textarea.style.cursor = 'text'
    controls.style.pointerEvents = 'auto'
    controls.style.opacity = '1'
    
    textarea.placeholder = 'Type your presenter notes here...\n\n• They auto-save as you type\n• Won\'t appear in screenshots\n• Always stays on top\n\nGlobal Shortcuts:\n• Cmd+Shift+N: Toggle window\n• Cmd+Shift+O: Cycle opacity\n• Cmd+Shift+T: Click-through mode\n• Cmd+Shift+Plus/Minus: Font size'
  }
})
```

### preload.js - Secure IPC Bridge
```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  saveNotes: (notes) => ipcRenderer.send('save-notes', notes),
  loadNotes: () => ipcRenderer.invoke('load-notes'),
  
  // Menu commands
  onFontSizeChange: (callback) => ipcRenderer.on('change-font-size', callback),
  onOpacityChange: (callback) => ipcRenderer.on('change-opacity', callback),
  
  // Notifications
  onShowNotification: (callback) => ipcRenderer.on('show-notification', callback),
  
  // Click-through
  onToggleClickThrough: (callback) => ipcRenderer.on('toggle-click-through', callback),
  
  // Add import/export handlers
  onExportNotes: (callback) => ipcRenderer.on('export-notes', callback),
  onImportNotes: (callback) => ipcRenderer.on('import-notes', callback),
  onExportBackup: (callback) => ipcRenderer.on('export-backup', callback),
  onImportBackup: (callback) => ipcRenderer.on('import-backup', callback)
})
```

### index.html - UI Layout and Styling
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
      --blue-primary: #0066cc;
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
  background-color: rgba(248, 249, 250, 1); /* Fully opaque */
  border-bottom: 1px solid var(--bg-tertiary);
  padding: 12px 16px;
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
    }

    .title {
      font-size: 14px;
      font-weight: 500;
      opacity: 0.9;
    }

    #save-status {
      font-size: 12px;
      color: var(--success);
    }

    .privacy-badge {
      background-color: var(--success);
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 400;
      display: inline-block;
      box-shadow: 0 2px 4px rgba(0, 102, 204, 0.2);
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

    body.click-through .header {
      background-color: var(--bg-primary);
    }

    body.click-through #notes {
      background-color: var(--bg-primary);
      border-color: var(--bg-tertiary);
    }

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
  padding: 15px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: rgba(255, 255, 255, 0.95); /* Using rgba */
}

#notes-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 8px;
  background-color: var(--bg-primary);
  transition: background-color 0.2s ease;
}
#notes {
  flex: 1;
  background-color: transparent; /* Transparent to show wrapper background */
  color: var(--text-primary);
  border: none;
  border-radius: 8px;
  padding: 16px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  outline: none;
  transition: font-weight 0.2s ease, text-shadow 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
  background-color: rgba(255, 255, 255, 1); /* Fully opaque */
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
      font-size: 12px;
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
      width: 20px;
      height: 20px;
      background: var(--blue-primary);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 102, 204, 0.3);
      transition: transform 0.2s ease;
    }

    .slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
    }

    #opacity-value {
      font-size: 12px;
      color: var(--text-secondary);
      min-width: 35px;
    }

    /* Font size buttons */
    .font-controls {
      display: flex;
      gap: 4px;
    }

    .font-btn {
      width: 24px;
      height: 24px;
      border: 1px solid var(--bg-tertiary);
      color: var(--text-primary);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      -webkit-app-region: no-drag;
    }

    .font-btn:hover {
      border-color: var(--bg-tertiary);
    }

    .font-btn:active {
      background: var(--bg-tertiary);
    }

    /* Notification toast */
    #notification {
      display: none;
      position: absolute;
      font-size: 14px;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--bg-tertiary);
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }

      to {
        transform: translateX(0);
        opacity: 1;
      }
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

<body>
  <div class="header">
    <div class="header-left">
      <div class="title">Presenter Notes</div>
      <div id="save-status"></div>
    </div>
    <div>
      <span class="privacy-badge">PRIVATE MODE ON</span>
      <span class="click-through-badge">CLICK-THROUGH</span>
    </div>
  </div>

  <div class="content">
    <!-- Notification toast -->
    <div id="notification"></div>

    <div id="notes-wrapper">
      <textarea id="notes"></textarea>
    </div>
  </div>

  <!-- Controls bar -->
  <div class="controls">
    <div class="control-group">
      <span class="control-label">Opacity:</span>
      <input type="range" class="slider" id="opacity-slider" min="10" max="100" value="100">
      <span id="opacity-value">100%</span>
    </div>

    <div class="control-group">
      <span class="control-label">Font:</span>
      <div class="font-controls">
        <button class="font-btn" id="font-decrease">−</button>
        <button class="font-btn" id="font-reset">R</button>
        <button class="font-btn" id="font-increase">+</button>
      </div>
    </div>
  </div>

  <script src="renderer.js"></script>
</body>

</html>
```

### package.json - Dependencies and Build Configuration
```json
{
  "name": "presenter-notes",
  "version": "0.1.0",
  "description": "Privacy-focused presenter notes that stay hidden from screenshots and screen shares",
  "main": "main.js",
  "scripts": {
    "start": "electron main.js",
    "dist": "electron-builder",
    "dist-mac": "electron-builder --mac"
  },
  "devDependencies": {
    "electron": "^latest",
    "electron-builder": "^latest"
  },
  "build": {
    "appId": "com.yourname.presenter-notes",
    "productName": "Presenter Notes",
    "directories": {
      "output": "dist"
    },
    "mac": {
      "category": "public.app-category.productivity",
      "icon": "build/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "darkModeSupport": true,
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ]
    },
    "dmg": {
      "contents": [
        {
          "x": 130,
          "y": 220
        },
        {
          "x": 410,
          "y": 220,
          "type": "link",
          "path": "/Applications"
        }
      ],
      "title": "Presenter Notes Installer"
    }
  },
  "author": "Evan Pizzolato",
  "license": "MIT"
}
```

## CSS Architecture

### Color System
```css
:root {
  --bg-primary: rgba(255, 255, 255, 0.95);
  --blue-primary: #0066cc;
  --text-primary: #212529;
  --success: #28a745;
  --warning: #ffc107;
}
```

### Layout Structure
- **Header**: Draggable title bar with privacy badge
- **Content**: Flexible textarea with custom scrollbar
- **Controls**: Bottom bar with opacity and font controls
- **Notifications**: Fixed position toast messages

## File Storage & Data Format

### Notes Storage
```json
{
  "notes": "User's note content here...",
  "savedAt": "2024-01-15T10:30:00.000Z"
}
```

### Backup Format
```json
{
  "notes": "Content...",
  "exportedAt": "2024-01-15T10:30:00.000Z",
  "fontSize": 18,
  "opacity": 1.0
}
```

## Development Workflow

### Local Development
1. `npm start` - Launch in development mode
2. Edit files in real-time
3. Test privacy features with screenshots
4. Use global shortcuts for testing

### Building for Distribution
1. `npm run dist-mac` - Create DMG
2. Test on target macOS versions
3. Verify privacy protection works
4. Check all global shortcuts function

## Known Limitations & Future Work

### Current Limitations
- Not code-signed (shows security warning)
- Basic icon styling
- No auto-updater
- Limited to macOS

### Production Requirements
- Apple Developer account for code signing
- Notarization for distribution
- Auto-updater implementation
- Cross-platform support

## Testing Checklist

### Core Functionality
- [ ] Notes save and load correctly
- [ ] Privacy mode hides from screenshots
- [ ] Global shortcuts work system-wide
- [ ] Click-through mode functions
- [ ] Import/export works
- [ ] Opacity and font controls work
- [ ] System tray menu functions

### Privacy Testing
- [ ] `Cmd+Shift+4` screenshot test
- [ ] Screen recording test
- [ ] Multiple monitor test
- [ ] Full-screen app overlay test

## Quick Start for New Developers

1. **Clone and Install**
   ```bash
   cd /Users/evanpizzolato/Documents/Code/notesapp
   npm install
   ```

2. **Development**
   ```bash
   npm start
   ```

3. **Build**
   ```bash
   npm run dist-mac
   ```

4. **Test Privacy**
   - Open app
   - Take screenshot with `Cmd+Shift+4`
   - Verify window is not captured

## File Locations Summary

- **Source Code**: `/Users/evanpizzolato/Documents/Code/notesapp/`
- **Built Apps**: `dist/mac/` and `dist/mac-arm64/`
- **User Data**: `~/Library/Application Support/presenter-notes/`
- **Icons**: `build/icon.icns` and `build/icon.png`

---

This documentation provides a complete overview of the Presenter Notes app structure, code organization, and development workflow for easy handoff to other developers or agents.

## Full Source Snapshot (current)

### main.js
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
    
    // Show a quick notification of the opacity level
    const percentages = ['100%', '70%', '40%', '20%', '10%']
    mainWindow.webContents.send('show-notification', `Opacity: ${percentages[currentOpacityIndex]}`)
  }
})
  
  if (!opacityRegistered) {
    console.log('Failed to register Cmd+Shift+O - might be in use by another app')
  }
  
  // Quick font size shortcuts
  const fontIncreaseRegistered = globalShortcut.register('Command+Shift+Plus', () => {
    if (mainWindow) {
      mainWindow.webContents.send('change-font-size', 'increase')
      mainWindow.webContents.send('show-notification', 'Font size increased')
    }
  })
  
  const fontDecreaseRegistered = globalShortcut.register('Command+Shift+-', () => {
    if (mainWindow) {
      mainWindow.webContents.send('change-font-size', 'decrease')
      mainWindow.webContents.send('show-notification', 'Font size decreased')
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
      
      // Show notification
      const status = newState ? 'ON - Window won\'t block clicks' : 'OFF - Window is interactive'
      mainWindow.webContents.send('show-notification', `Click-through: ${status}`)
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
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',  // Add this line - fully transparent
    visibleOnAllWorkspaces: true,
    
    resizable: true,
    minWidth: 300,
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
ipcMain.on('save-notes', (event, notes) => {
  try {
    privacyOn = notes.privacy ?? privacyOn;     // keep in sync
    const payload = { notes: notes.notes, privacy: privacyOn, savedAt: new Date() };
    fs.writeFileSync(notesPath, JSON.stringify(payload));
    console.log('Notes + privacy saved →', privacyOn);
  } catch (e) {
    console.error('save-notes error', e);
  }
})

// Handle loading notes
ipcMain.handle('load-notes', () => {
  try {
    if (fs.existsSync(notesPath)) {
      const data = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
      privacyOn = data.privacy ?? true;     // use saved flag
      return { notes: data.notes, privacy: privacyOn };
    }
    // file does NOT exist yet → first run
    privacyOn = true;                       // default ON
    return { notes: '', privacy: true };
  } catch (e) {
    console.error('load-notes error', e);
    privacyOn = true;
    return { notes: '', privacy: true };
  }
})

// user clicked the toggle → flip flag & window
ipcMain.handle('toggle-privacy', () => {
  privacyOn = !privacyOn;

    // 2.  apply to **that exact object**
    if (mainWindow) {
      mainWindow.setContentProtection(privacyOn);
    }


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

### renderer.js
```javascript
// This runs in your web page
let saveTimeout
let notificationTimeout
let currentFontSize = 18  // Default font size
let currentOpacity = 1.0  // Default opacity

// Function to show temporary notifications
// function showNotification(message) {
//   const notification = document.getElementById('notification')
//   notification.textContent = message
//   notification.style.display = 'block'

//   clearTimeout(notificationTimeout)

//   notificationTimeout = setTimeout(() => {
//     notification.style.display = 'none'
//   }, 1500)
// }

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
  const textarea = document.getElementById('notes')

  if (direction === 'increase') {
    currentFontSize = Math.min(currentFontSize + 2, 32)
  } else if (direction === 'decrease') {
    currentFontSize = Math.max(currentFontSize - 2, 12)
  } else if (direction === 'reset') {
    currentFontSize = 18
  }

  textarea.style.fontSize = currentFontSize + 'px'
}

// Function to update opacity
function updateOpacity(value) {
  currentOpacity = value

  // For transparent window effect, we need to change the background alpha values
  const header = document.querySelector('.header')
  const controls = document.querySelector('.controls')
  const content = document.querySelector('.content')
  const notesWrapper = document.getElementById('notes-wrapper')
  const textarea = document.getElementById('notes')

  // Calculate the actual opacity for the notes area (minimum 40%)
  const notesOpacity = Math.max(value, 0.4)

  // Apply rgba backgrounds with the opacity value for window transparency
  document.body.style.backgroundColor = `rgba(255, 255, 255, ${value * 0.95})`

  // Header and controls always fully opaque backgrounds
  header.style.backgroundColor = '#f8f9fa'
  controls.style.backgroundColor = '#ffffff'

  // Content area with variable transparency
  content.style.backgroundColor = `rgba(255, 255, 255, ${value})`

  // Notes wrapper with minimum 40% opacity
  notesWrapper.style.backgroundColor = `rgba(255, 255, 255, ${notesOpacity * 0.95})`

  // If opacity is very low, enhance text readability
  if (value < 0.4) {
    textarea.style.fontWeight = '400'
    textarea.style.textShadow = '0 0 2px rgba(255,255,255,0.8)'
  } else {
    textarea.style.fontWeight = 'normal'
    textarea.style.textShadow = 'none'
  }

  // Update the display
  const percentage = Math.round(value * 100)
  document.getElementById('opacity-value').textContent = percentage + '%'
  document.getElementById('opacity-slider').value = percentage
}

window.addEventListener('DOMContentLoaded', async () => {
  const textarea = document.getElementById('notes')
  const opacitySlider = document.getElementById('opacity-slider')

  // Initialize opacity to ensure proper setup
  updateOpacity(1.0)

  // Load saved notes
  const { notes, privacy } = await window.api.loadNotes()
  textarea.value = notes;
  document.getElementById('privacy-checkbox').checked = privacy;
  updatePrivacyBadge(privacy);

  // Auto-save as user types (with debounce)
  textarea.addEventListener('input', (e) => {
    document.getElementById('save-status').textContent = 'Saving...'
    clearTimeout(saveTimeout)

    saveTimeout = setTimeout(() => {
      window.api.saveNotes({ notes: e.target.value, privacy: document.getElementById('privacy-checkbox').checked })
      document.getElementById('save-status').textContent = 'Saved'

      setTimeout(() => {
        document.getElementById('save-status').textContent = ''
      }, 2000)
    }, 500)
  })

  // Opacity slider
  opacitySlider.addEventListener('input', (e) => {
    const value = e.target.value / 100
    updateOpacity(value)
  })

  // Font size buttons
  document.getElementById('font-decrease').addEventListener('click', () => {
    updateFontSize('decrease')
    showNotification('Font size decreased')
  })

  document.getElementById('font-reset').addEventListener('click', () => {
    updateFontSize('reset')
    showNotification('Font size reset')
  })

  document.getElementById('font-increase').addEventListener('click', () => {
    updateFontSize('increase')
    showNotification('Font size increased')
  })

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
          textarea.value = data.notes
          await window.api.saveNotes(data.notes)
          showNotification('Backup imported successfully')
        }
      } else {
        // Import as plain text/markdown
        textarea.value = content
        await window.api.saveNotes(content)
        showNotification('Notes imported successfully')
      }
    } catch (error) {
      console.error('Import failed:', error)
      showNotification('Import failed')
    }

    // Reset file input
    fileInput.value = ''
  })

  document.getElementById('privacy-checkbox').addEventListener('change', async (e) => {
    const on = e.target.checked;
    await window.api.togglePrivacy();   // main process flips window
    updatePrivacyBadge(on);
  })

  // Export handlers
  window.api.onExportNotes(async () => {
    const notes = textarea.value
    const timestamp = new Date().toISOString().split('T')[0]
    downloadFile(notes, `presenter-notes-${timestamp}.md`, 'text/markdown')
    showNotification('Notes exported')
  })

  window.api.onImportNotes(() => {
    fileInput.accept = '.txt,.md,.markdown'
    fileInput.click()
  })

  window.api.onExportBackup(async () => {
    const notes = textarea.value
    const timestamp = new Date().toISOString()
    const backup = {
      notes: notes,
      exportedAt: timestamp,
      fontSize: currentFontSize,
      opacity: currentOpacity
    }
    downloadFile(JSON.stringify(backup, null, 2), `notes-backup-${timestamp.split('T')[0]}.json`, 'application/json')
    showNotification('Backup exported')
  })

  window.api.onImportBackup(() => {
    fileInput.accept = '.json'
    fileInput.click()
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

// Handle notification display
window.api.onShowNotification((event, message) => {
  showNotification(message)
})

// Handle click-through mode toggle
window.api.onToggleClickThrough((event, isClickThrough) => {
  const body = document.body
  const textarea = document.getElementById('notes')
  const controls = document.querySelector('.controls')

  if (isClickThrough) {
    body.classList.add('click-through')
    textarea.disabled = true
    textarea.style.cursor = 'default'
    controls.style.pointerEvents = 'none'
    controls.style.opacity = '0.5'

    textarea.placeholder = 'CLICK-THROUGH MODE ACTIVE\n\nWindow won\'t intercept clicks.\nPress Cmd+Shift+T to edit notes again.'
  } else {
    body.classList.remove('click-through')
    textarea.disabled = false
    textarea.style.cursor = 'text'
    controls.style.pointerEvents = 'auto'
    controls.style.opacity = '1'

    textarea.placeholder = 'Type your presenter notes here...\n\n• They auto-save as you type\n• Won\'t appear in screenshots\n• Always stays on top\n\nGlobal Shortcuts:\n• Cmd+Shift+N: Toggle window\n• Cmd+Shift+O: Cycle opacity\n• Cmd+Shift+T: Click-through mode\n• Cmd+Shift+Plus/Minus: Font size'
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

### preload.js
```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  saveNotes: (notes) => ipcRenderer.send('save-notes', notes),
  loadNotes: () => ipcRenderer.invoke('load-notes'),

  togglePrivacy: () => ipcRenderer.invoke('toggle-privacy'),
  onPrivacyChanged: (cb) => ipcRenderer.on('privacy-changed', cb),
  
  // Menu commands
  onFontSizeChange: (callback) => ipcRenderer.on('change-font-size', callback),
  onOpacityChange: (callback) => ipcRenderer.on('change-opacity', callback),
  
  // Notifications
  onShowNotification: (callback) => ipcRenderer.on('show-notification', callback),
  
  // Click-through
  onToggleClickThrough: (callback) => ipcRenderer.on('toggle-click-through', callback),
  
  // Add import/export handlers
  onExportNotes: (callback) => ipcRenderer.on('export-notes', callback),
  onImportNotes: (callback) => ipcRenderer.on('import-notes', callback),
  onExportBackup: (callback) => ipcRenderer.on('export-backup', callback),
  onImportBackup: (callback) => ipcRenderer.on('import-backup', callback)
})
```

### index.html
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
      --blue-primary: #0066cc;
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
      padding: 12px 16px;
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
    }

    .title {
      font-size: 14px;
      font-weight: 500;
      opacity: 0.9;
    }

    #save-status {
      font-size: 12px;
      color: var(--success);
    }

    .privacy-badge {
      background-color: var(--success);
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 400;
      display: inline-block;
      box-shadow: 0 2px 4px rgba(0, 102, 204, 0.2);
    }

    /* ===== privacy toggle switch ===== */
    .privacy-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
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
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%
    }

    .privacy-switch input:checked+.slider {
      background-color: var(--success)
    }

    .privacy-switch input:checked+.slider:before {
      transform: translateX(20px)
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
      padding: 15px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      background-color: rgba(255, 255, 255, 0.95);
      /* Using rgba */
    }

    #notes-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
      border-radius: 8px;
      background-color: var(--bg-primary);
      transition: background-color 0.2s ease;
    }

    #notes {
      flex: 1;
      background-color: transparent;
      /* Transparent to show wrapper background */
      color: var(--text-primary);
      border: none;
      border-radius: 8px;
      padding: 16px;
      font-size: 14px;
      line-height: 1.5;
      resize: none;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      outline: none;
      transition: font-weight 0.2s ease, text-shadow 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      font-size: 12px;
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
      width: 20px;
      height: 20px;
      background: var(--blue-primary);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 102, 204, 0.3);
      transition: transform 0.2s ease;
    }

    .slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
    }

    #opacity-value {
      font-size: 12px;
      color: var(--text-secondary);
      min-width: 35px;
    }

    /* Font size buttons */
    .font-controls {
      display: flex;
      gap: 4px;
    }

    .font-btn {
      width: 24px;
      height: 24px;
      border: 1px solid var(--bg-tertiary);
      color: var(--text-primary);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      -webkit-app-region: no-drag;
    }

    .font-btn:hover {
      border-color: var(--bg-tertiary);
    }

    .font-btn:active {
      background: var(--bg-tertiary);
    }

    /* Notification toast */
    #notification {
      display: none;
      position: absolute;
      font-size: 14px;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--bg-tertiary);
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }

      to {
        transform: translateX(0);
        opacity: 1;
      }
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

<body>
  <div class="header">
    <div class="header-left">
      <div class="title">Presenter Notes</div>
      <div id="save-status"></div>
    </div>
    <div>
      <span class="privacy-badge">PRIVATE MODE ON</span>
      <label class="privacy-switch">
        <input type="checkbox" id="privacy-checkbox" checked />
        <span class="slider round" style="height: 24px;"></span>
      </label>

      <span class="click-through-badge">CLICK-THROUGH</span>
    </div>
  </div>

  <div class="content">
    <!-- Notification toast -->
    <div id="notification"></div>

    <div id="notes-wrapper">
      <textarea id="notes"></textarea>
    </div>
  </div>

  <!-- Controls bar -->
  <div class="controls">
    <div class="control-group">
      <span class="control-label">Opacity:</span>
      <input type="range" class="slider" id="opacity-slider" min="10" max="100" value="100">
      <span id="opacity-value">100%</span>
    </div>

    <div class="control-group">
      <span class="control-label">Font:</span>
      <div class="font-controls">
        <button class="font-btn" id="font-decrease">−</button>
        <button class="font-btn" id="font-reset">R</button>
        <button class="font-btn" id="font-increase">+</button>
      </div>
    </div>
  </div>

  <script src="renderer.js"></script>
</body>

</html>
```

### create_temp_icon.sh
```bash
#!/usr/bin/env bash

set -euo pipefail

# Create a quick temporary macOS-style icon using sips
# Requirements: sips (preinstalled on macOS)

OUT_PNG="build/icon.png"
OUT_ICNS="build/icon.icns"

mkdir -p build

# Create a simple 1024x1024 blue square as placeholder
sips -s format png --resampleWidth 1024 --padToHeightWidth 1024 1024 \
    --padColor FFFFFF /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ToolbarFavoritesIcon.icns \
    --out "$OUT_PNG" >/dev/null 2>&1 || true

# If you have an SVG (temp_icon.svg) you can rasterize with sips (macOS 14+ supports SVG)
if command -v sips >/dev/null 2>&1 && [[ -f "temp_icon.svg" ]]; then
  sips -s format png temp_icon.svg --resampleWidth 1024 --out "$OUT_PNG"
fi

# Convert to .icns using iconutil
TMPICONSET=$(mktemp -d)
for SZ in 16 32 64 128 256 512 1024; do
  sips -z $SZ $SZ "$OUT_PNG" --out "$TMPICONSET/icon_${SZ}x${SZ}.png" >/dev/null
done

mkdir -p "$TMPICONSET/AppIcon.iconset"
cp -f "$TMPICONSET"/*.png "$TMPICONSET/AppIcon.iconset/" || true

if command -v iconutil >/dev/null 2>&1; then
  iconutil -c icns "$TMPICONSET/AppIcon.iconset" -o "$OUT_ICNS"
else
  echo "iconutil not found; skipping .icns generation"
fi

echo "Icons written to $OUT_PNG and $OUT_ICNS"
```
