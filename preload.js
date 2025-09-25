const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  saveNotes: (notes) => ipcRenderer.send('save-notes', notes),
  loadNotes: () => ipcRenderer.invoke('load-notes'),

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
