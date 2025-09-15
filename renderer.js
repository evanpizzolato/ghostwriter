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

// NEW: Text formatting helper functions
function insertTextFormat(startTag, endTag, placeholder) {
  const textarea = document.getElementById('notes')
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = textarea.value.substring(start, end)
  
  let replacement
  if (selectedText) {
    replacement = startTag + selectedText + endTag
  } else {
    replacement = startTag + placeholder + endTag
  }
  
  textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end)
  
  // Move cursor to end of inserted text
  const newPosition = start + replacement.length
  textarea.setSelectionRange(newPosition, newPosition)
  textarea.focus()
  
  // Trigger save
  textarea.dispatchEvent(new Event('input'))
  
  // NEW: Update button states after formatting
  updateToolbarStates()
}

function insertListItem(prefix) {
  const textarea = document.getElementById('notes')
  const start = textarea.selectionStart
  const value = textarea.value
  
  // Find the start of current line
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  
  // Insert the list prefix at the beginning of current line
  const newText = value.substring(0, lineStart) + prefix + value.substring(lineStart)
  textarea.value = newText
  
  // Move cursor after the prefix
  const newPosition = start + prefix.length
  textarea.setSelectionRange(newPosition, newPosition)
  textarea.focus()
  
  // Trigger save
  textarea.dispatchEvent(new Event('input'))
}

// NEW: Update toolbar button states based on cursor position
function updateToolbarStates() {
  const textarea = document.getElementById('notes')
  const cursorPos = textarea.selectionStart
  const textBeforeCursor = textarea.value.substring(0, cursorPos)
  const currentLine = textBeforeCursor.split('\n').pop()
  
  // Check for bold (**text**)
  const boldBtn = document.getElementById('bold-btn')
  const boldCount = (textBeforeCursor.match(/\*\*/g) || []).length
  boldBtn.classList.toggle('active', boldCount % 2 === 1)
  
  // Check for italic (*text*)
  const italicBtn = document.getElementById('italic-btn')
  const italicMatches = textBeforeCursor.match(/\*(?!\*)/g) || []
  const boldMatches = textBeforeCursor.match(/\*\*/g) || []
  const singleAsterisks = italicMatches.length - (boldMatches.length * 2)
  italicBtn.classList.toggle('active', singleAsterisks % 2 === 1)
  
  // Check for underline (<u>text</u>)
  const underlineBtn = document.getElementById('underline-btn')
  const openU = (textBeforeCursor.match(/<u>/g) || []).length
  const closeU = (textBeforeCursor.match(/<\/u>/g) || []).length
  underlineBtn.classList.toggle('active', openU > closeU)
  
  // Check for list items
  const bulletBtn = document.getElementById('bullet-btn')
  const numberBtn = document.getElementById('number-btn')
  bulletBtn.classList.toggle('active', currentLine.startsWith('• '))
  numberBtn.classList.toggle('active', /^\d+\.\s/.test(currentLine))
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

    // NEW: Apply opacity to toolbar
    const toolbar = document.querySelector('.text-toolbar')
    if (toolbar) {
      toolbar.style.backgroundColor = `rgba(248, 249, 250, ${value})`
    }

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

  // NEW: Update toolbar states when cursor moves or text selection changes
  textarea.addEventListener('selectionchange', updateToolbarStates)
  textarea.addEventListener('keyup', updateToolbarStates)
  textarea.addEventListener('mouseup', updateToolbarStates)

  // NEW: Keyboard shortcuts for text formatting
  textarea.addEventListener('keydown', (e) => {
    // Check for Cmd/Ctrl key combinations
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const cmdKey = isMac ? e.metaKey : e.ctrlKey
    
    if (!cmdKey) return
    
    switch(e.key.toLowerCase()) {
      case 'b':
        e.preventDefault()
        insertTextFormat('**', '**', 'bold text')
        showNotification('Bold: Cmd+B')
        break
        
      case 'i':
        e.preventDefault()
        insertTextFormat('*', '*', 'italic text')
        showNotification('Italic: Cmd+I')
        break
        
      case 'u':
        e.preventDefault()
        insertTextFormat('<u>', '</u>', 'underlined text')
        showNotification('Underline: Cmd+U')
        break
        
      case 'l':
        e.preventDefault()
        insertListItem('• ')
        showNotification('Bullet List: Cmd+L')
        break
        
      case 'd':
        e.preventDefault()
        insertListItem('1. ')
        showNotification('Numbered List: Cmd+D')
        break
    }
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

// NEW: Toolbar button functionality
document.getElementById('bold-btn').addEventListener('click', () => {
  insertTextFormat('**', '**', 'bold text')
})

document.getElementById('italic-btn').addEventListener('click', () => {
  insertTextFormat('*', '*', 'italic text')
})

document.getElementById('underline-btn').addEventListener('click', () => {
  insertTextFormat('<u>', '</u>', 'underlined text')
})

document.getElementById('bullet-btn').addEventListener('click', () => {
  insertListItem('• ')
})

document.getElementById('number-btn').addEventListener('click', () => {
  insertListItem('1. ')
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