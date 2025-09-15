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