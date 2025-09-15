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
  console.log('setFontSize called with:', size)
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
  
  console.log('Using execCommand size:', commandSize)
  const result = document.execCommand('fontSize', false, commandSize)
  console.log('execCommand result:', result)
}

// Function to update opacity
function updateOpacity(value) {
  currentOpacity = value

  // For transparent window effect, we need to change the background alpha values
  const header = document.querySelector('.header')
  const controls = document.querySelector('.controls')
  const content = document.querySelector('.content')
  const notesWrapper = document.getElementById('notes-wrapper')
  const editor = document.getElementById('notes')

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

window.addEventListener('DOMContentLoaded', async () => {
  const editor = document.getElementById('notes')
  const opacitySlider = document.getElementById('opacity-slider')

  // Initialize opacity to ensure proper setup
  updateOpacity(1.0)

  // Load saved notes
  const { notes, privacy } = await window.api.loadNotes()
  editor.innerHTML = notes;
  document.getElementById('privacy-checkbox').checked = privacy;
  updatePrivacyBadge(privacy);

  // Auto-save as user types (with debounce)
  editor.addEventListener('input', (e) => {
    document.getElementById('save-status').textContent = 'Saving...'
    clearTimeout(saveTimeout)

    saveTimeout = setTimeout(() => {
      window.api.saveNotes({ notes: e.target.innerHTML, privacy: document.getElementById('privacy-checkbox').checked })
      document.getElementById('save-status').textContent = 'Saved'

      setTimeout(() => {
        document.getElementById('save-status').textContent = ''
      }, 2000)
    }, 500)
  })

  // NEW: Update toolbar states when cursor moves or text selection changes
  editor.addEventListener('selectionchange', updateToolbarStates)
  editor.addEventListener('keyup', updateToolbarStates)
  editor.addEventListener('mouseup', updateToolbarStates)

  // NEW: Keyboard shortcuts for text formatting
  editor.addEventListener('keydown', (e) => {
    // Check for Cmd/Ctrl key combinations
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const cmdKey = isMac ? e.metaKey : e.ctrlKey
    
    if (!cmdKey) return
    
    switch(e.key.toLowerCase()) {
      case 'b':
        e.preventDefault()
        insertTextFormat('bold')
        showNotification('Bold: Cmd+B')
        break
        
      case 'i':
        e.preventDefault()
        insertTextFormat('italic')
        showNotification('Italic: Cmd+I')
        break
        
      case 'u':
        e.preventDefault()
        insertTextFormat('underline')
        showNotification('Underline: Cmd+U')
        break
        
      case 'l':
        e.preventDefault()
        insertListItem('bullet')
        showNotification('Bullet List: Cmd+L')
        break
        
      case 'd':
        e.preventDefault()
        insertListItem('number')
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

  // Font size dropdown
 // Debug: Check if dropdown exists
 const dropdown = document.getElementById('font-size-select')
 console.log('Font size dropdown element:', dropdown)
 
 if (dropdown) {
   // Font size dropdown
   dropdown.addEventListener('change', (e) => {
     console.log('Dropdown changed to:', e.target.value)
     const size = e.target.value
     setFontSize(size)
   })
 } else {
   console.log('ERROR: font-size-select element not found!')
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
          editor.innerHTML = data.notes
          await window.api.saveNotes(data.notes)
          showNotification('Backup imported successfully')
        }
      } else {
        // Import as plain text/markdown
        editor.innerHTML = content
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
    const notes = editor.innerHTML
    const timestamp = new Date().toISOString().split('T')[0]
    downloadFile(notes, `presenter-notes-${timestamp}.md`, 'text/markdown')
    showNotification('Notes exported')
  })

  window.api.onImportNotes(() => {
    fileInput.accept = '.txt,.md,.markdown'
    fileInput.click()
  })

  window.api.onExportBackup(async () => {
    const notes = editor.value
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

// Handle notification display
window.api.onShowNotification((event, message) => {
  showNotification(message)
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

    editor.placeholder = 'CLICK-THROUGH MODE ACTIVE\n\nWindow won\'t intercept clicks.\nPress Cmd+Shift+T to edit notes again.'
  } else {
    body.classList.remove('click-through')
    editor.contentEditable = 'true'
    editor.style.cursor = 'text'
    controls.style.pointerEvents = 'auto'
    controls.style.opacity = '1'

    editor.placeholder = 'Type your presenter notes here...\n\n• They auto-save as you type\n• Won\'t appear in screenshots\n• Always stays on top\n\nGlobal Shortcuts:\n• Cmd+Shift+N: Toggle window\n• Cmd+Shift+O: Cycle opacity\n• Cmd+Shift+T: Click-through mode\n• Cmd+Shift+Plus/Minus: Font size'
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