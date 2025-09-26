const { contextBridge, ipcRenderer } = require('electron')

// Expose a curated surface area to the renderer so it can communicate with the main process safely.
contextBridge.exposeInMainWorld('api', {
  // Persist notes array and metadata back to disk.
  saveNotes: (notes) => ipcRenderer.send('save-notes', notes),
  // Hydrate renderer state on boot.
  loadNotes: () => ipcRenderer.invoke('load-notes'),
  // Remember whether the sidebar is collapsed between sessions.
  saveSidebarState: (collapsed) => ipcRenderer.send('save-sidebar-state', collapsed),

  // Flip content protection on or off from the renderer.
  togglePrivacy: () => ipcRenderer.invoke('toggle-privacy'),
  // Listen for privacy toggles initiated from menus.
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
  onImportBackup: (callback) => ipcRenderer.on('import-backup', callback),

  // Window state helpers
  getFullscreenState: () => ipcRenderer.invoke('is-window-fullscreen'),
  onFullscreenChanged: (callback) => ipcRenderer.on('window-fullscreen-changed', callback)
})
