// This script runs inside the renderer (BrowserWindow) and powers the UI.
// Tunables for how the editor behaves.
const SAVE_DEBOUNCE_MS = 500          // Delay before writing to disk after typing stops.
const NOTE_TITLE_MAX_LENGTH = 60      // Number of characters we use for a sidebar title preview.
const FALLBACK_NOTE_TITLE = 'Untitled'// Placeholder title shown when a note has no content yet.
// Inline SVG used for the delete button beside each note in the sidebar.
const TRASH_ICON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
`

// Predefined text styles exposed in the toolbar dropdown.
const FONT_STYLES = [
  { key: 'body', label: 'Body', size: 16, lineHeight: 1.5, weight: 400 },
  { key: 'heading4', label: 'Heading 4', size: 18, lineHeight: 1.2, weight: 500 },
  { key: 'heading3', label: 'Heading 3', size: 22, lineHeight: 1.2, weight: 500 },
  { key: 'heading2', label: 'Heading 2', size: 26, lineHeight: 1.2, weight: 500 },
  { key: 'heading1', label: 'Heading 1', size: 32, lineHeight: 1.2, weight: 500 }
]

// Generate a unique identifier for new notes, using crypto if available.
const generateNoteId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Format a timestamp relative to now, e.g. "just now", "2h ago", "Yesterday", or "Nov. 18".
function formatRelativeTimestamp(dateString) {
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) return ''

  const now = new Date()
  const diffMs = now - parsed
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`
  if (hours < 24) return `${Math.max(1, hours)}h ago`
  if (hours < 48) return 'Yesterday'

  const parts = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).formatToParts(parsed)
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  const monthWithPeriod = month ? `${month}.` : ''
  return `${monthWithPeriod} ${day}`.trim()
}

// Mutable state that mirrors the UI.
let saveTimeout
let currentFontStyle = 'body'  // Default text style for the editor content area.
let currentOpacity = 1.0  // Opacity value passed down from menu/tray.
let toolbarVisible = true
let sidebarCollapsed = true
let sidebarToggleShortcutHint = '⌥⌘S'

let notes = []             // Array of note objects currently loaded.
let activeNoteId = null    // Identifier for the note shown in the editor.

// Cached DOM references filled inside DOMContentLoaded.
let editor
let noteList
let newNoteButton
let privacyCheckbox
let saveStatus



// Trigger a browser download with the provided content and filename.
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

// Read an uploaded file as text so it can be imported into the app.
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// Pull the first non-empty line out of the HTML content to use as a sidebar title.
function deriveTitleFromContent(content = '') {
  if (!content) return FALLBACK_NOTE_TITLE

  const temp = document.createElement('div')
  temp.innerHTML = content

  // Ensure block breaks become newlines for title extraction.
  temp.querySelectorAll('div,p,li,br').forEach(node => {
    node.insertAdjacentText('beforebegin', '\n')
  })

  const rawText = (temp.textContent || '').replace(/\r/g, '')
  const firstLine = rawText
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0) || ''

  if (!firstLine) {
    return FALLBACK_NOTE_TITLE
  }

  if (firstLine.length > NOTE_TITLE_MAX_LENGTH) {
    return `${firstLine.slice(0, NOTE_TITLE_MAX_LENGTH).trimEnd()}…`
  }

  return firstLine
}

// Determine if a note contains any non-whitespace characters once HTML is stripped.
function noteHasTypedContent(note = {}) {
  const temp = document.createElement('div')
  temp.innerHTML = note.content || ''
  const text = (temp.textContent || '').replace(/\u00A0/g, ' ').trim()
  return text.length > 0
}

// Reflect the active note's title in the header.
function updateHeaderTitle(note = getActiveNote()) {
  const display = document.getElementById('note-title-display')
  if (!display) return

  const title = note ? deriveTitleFromContent(note.content) : FALLBACK_NOTE_TITLE
  display.textContent = title
}

// Ensure every note object has the fields our UI expects.
function normalizeNote(rawNote = {}) {
  const now = new Date().toISOString()
  const content = typeof rawNote.content === 'string' ? rawNote.content : ''
  const createdAt = rawNote.createdAt ?? now
  const updatedAt = rawNote.updatedAt ?? createdAt
  const id = typeof rawNote.id === 'string' ? rawNote.id : generateNoteId()

  return {
    id,
    content,
    createdAt,
    updatedAt,
    title: deriveTitleFromContent(content)
  }
}

// Sanitize a raw notes array that came from disk or an import.
function prepareNotes(rawNotes) {
  if (!Array.isArray(rawNotes)) {
    return { notes: [], mutated: true }
  }

  let mutated = false

  const sanitized = rawNotes.map((rawNote) => {
    const normalized = normalizeNote(rawNote)
    if (!rawNote || rawNote.id !== normalized.id || rawNote.content !== normalized.content || rawNote.createdAt !== normalized.createdAt || rawNote.updatedAt !== normalized.updatedAt) {
      mutated = true
    }
    return normalized
  })

  return { notes: sanitized, mutated }
}

// Convert stored timestamps into sortable numbers, defaulting to zero on failure.
function parseTimestamp(value) {
  if (!value) return 0
  const time = Date.parse(value)
  return Number.isNaN(time) ? 0 : time
}

// Keep the in-memory notes sorted by most recently updated first.
function sortNotesByUpdated() {
  notes.sort((a, b) => parseTimestamp(b.updatedAt) - parseTimestamp(a.updatedAt))
}

// Return the note currently shown in the editor, or null if nothing is available.
function getActiveNote() {
  if (!activeNoteId) return null
  return notes.find(note => note.id === activeNoteId) || null
}

// Place the caret at the end of the editor so typing continues naturally.
function focusEditorAtEnd() {
  if (!editor) return

  editor.focus()

  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)

  const selection = window.getSelection()
  if (!selection) return

  selection.removeAllRanges()
  selection.addRange(range)
}

// Gather the minimal state the main process needs to persist.
function buildStatePayload() {
  const persistedNotes = notes.filter(noteHasTypedContent)
  const activeId = persistedNotes.some(note => note.id === activeNoteId) ? activeNoteId : null

  return {
    notes: persistedNotes.map(({ id, content, createdAt, updatedAt }) => ({ id, content, createdAt, updatedAt })),
    activeNoteId: activeId,
    privacy: privacyCheckbox ? !!privacyCheckbox.checked : true,
    sidebarCollapsed
  }
}

// Push the latest notes and settings to the main process without delay.
function persistStateImmediate() {
  if (!window.api || !window.api.saveNotes) return

  try {
    window.api.saveNotes(buildStatePayload())
  } catch (error) {
    console.error('Failed to persist notes state', error)
  }
}

// Debounced save helper used while the user is typing.
function scheduleStateSave() {
  if (saveStatus) {
    saveStatus.textContent = 'Saving...'
  }

  clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    persistStateImmediate()

    if (saveStatus) {
      saveStatus.textContent = 'Saved'
      setTimeout(() => {
        if (saveStatus && saveStatus.textContent === 'Saved') {
          saveStatus.textContent = ''
        }
      }, 2000)
    }
  }, SAVE_DEBOUNCE_MS)
}

// Rebuild the sidebar list so it reflects the in-memory notes array.
function renderNotesList() {
  if (!noteList) return

  noteList.innerHTML = ''

  if (!notes.length) {
    const emptyState = document.createElement('div')
    emptyState.className = 'note-list-empty'
    emptyState.textContent = 'No notes yet'
    noteList.appendChild(emptyState)
    return
  }

  const fragment = document.createDocumentFragment()

  notes.forEach((note) => {
    const item = document.createElement('div')
    item.className = 'note-item'
    item.setAttribute('role', 'listitem')

    if (note.id === activeNoteId) {
      item.classList.add('note-item--active')
    }

    const displayTitle = note.title || FALLBACK_NOTE_TITLE
    const accessibleTitle = displayTitle

    const selectButton = document.createElement('button')
    selectButton.type = 'button'
    selectButton.className = 'note-item__select'
    selectButton.textContent = displayTitle
    selectButton.dataset.noteId = note.id
    selectButton.title = displayTitle

    if (note.id === activeNoteId) {
      selectButton.setAttribute('aria-current', 'true')
    }

    selectButton.addEventListener('click', (event) => {
      event.stopPropagation()
      selectNote(note.id)
    })

    const timestamp = document.createElement('span')
    timestamp.className = 'note-item__timestamp'
    timestamp.textContent = formatRelativeTimestamp(note.updatedAt || note.createdAt)

    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.className = 'note-item__delete'
    deleteButton.setAttribute('aria-label', `Delete note "${accessibleTitle}"`)
    deleteButton.innerHTML = TRASH_ICON_SVG
    deleteButton.addEventListener('click', (event) => {
      event.stopPropagation()
      deleteNote(note.id)
    })

    item.addEventListener('click', () => {
      selectNote(note.id)
    })

    item.appendChild(selectButton)
    item.appendChild(timestamp)
    item.appendChild(deleteButton)
    fragment.appendChild(item)
  })

  noteList.appendChild(fragment)
}

// Load the requested note into the editor and mark it active in the sidebar.
function selectNote(noteId, { focus = true } = {}) {
  if (!editor) return

  if (noteId === activeNoteId) {
    if (focus) {
      focusEditorAtEnd()
    }
    return
  }

  const targetNote = notes.find(note => note.id === noteId)
  if (!targetNote) return

  clearTimeout(saveTimeout)

  activeNoteId = noteId
  editor.innerHTML = targetNote.content || ''
  updateHeaderTitle(targetNote)

  renderNotesList()
  updateToolbarStates()

  if (focus) {
    focusEditorAtEnd()
  }

  persistStateImmediate()
}

// Insert a fresh note at the top of the list and switch the editor to it.
function createNote({ focus = true, persist = true } = {}) {
  const now = new Date().toISOString()
  const note = {
    id: generateNoteId(),
    content: '',
    createdAt: now,
    updatedAt: now,
    title: FALLBACK_NOTE_TITLE
  }

  notes.unshift(note)
  sortNotesByUpdated()

  activeNoteId = note.id

  if (editor) {
    editor.innerHTML = ''
    updateToolbarStates()
    updateHeaderTitle(note)

    if (focus) {
      focusEditorAtEnd()
    }
  }

  renderNotesList()

  if (persist) {
    persistStateImmediate()
  }

  return note
}

// Remove a note, then keep the editor pointed at the next available entry.
function deleteNote(noteId) {
  const index = notes.findIndex(note => note.id === noteId)
  if (index === -1) return

  notes.splice(index, 1)

  if (!notes.length) {
    createNote({ focus: true, persist: true })
    renderNotesList()
    return
  }

  sortNotesByUpdated()

  if (noteId === activeNoteId) {
    activeNoteId = notes[0].id
    if (editor) {
      editor.innerHTML = notes[0].content || ''
      updateToolbarStates()
      updateHeaderTitle(notes[0])
      focusEditorAtEnd()
    }
  }

  renderNotesList()
  persistStateImmediate()
}

// Apply editor changes to the active note, bump its timestamp, and re-render.
function updateActiveNoteContent(content) {
  const note = getActiveNote()
  if (!note) return

  note.content = content
  note.updatedAt = new Date().toISOString()
  note.title = deriveTitleFromContent(content)

  updateHeaderTitle(note)
  sortNotesByUpdated()
  renderNotesList()
  scheduleStateSave()
}

// Adjust the current text style using menu shortcuts (increase/decrease/reset).
function updateFontSize(direction) {
  const dropdown = document.getElementById('font-size-select')
  const fallbackIndex = FONT_STYLES.findIndex(style => style.key === 'body')
  const currentIndex = FONT_STYLES.findIndex(style => style.key === currentFontStyle)
  let nextIndex = currentIndex >= 0 ? currentIndex : fallbackIndex

  if (direction === 'increase') {
    nextIndex = Math.min(FONT_STYLES.length - 1, nextIndex + 1)
  } else if (direction === 'decrease') {
    nextIndex = Math.max(0, nextIndex - 1)
  } else if (direction === 'reset') {
    nextIndex = fallbackIndex
  }

  const targetStyle = FONT_STYLES[nextIndex] || FONT_STYLES[fallbackIndex]
  currentFontStyle = targetStyle.key

  if (dropdown) {
    dropdown.value = targetStyle.key
  }

  applyFontStyle(targetStyle)
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

// Toggle bullet or numbered list formatting for the current selection.
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

// Infer which predefined font style matches the current selection.
function detectSelectionStyle() {
  const editor = document.getElementById('notes')
  const selection = window.getSelection()
  if (!editor || !selection || selection.rangeCount === 0) return null

  let node = selection.anchorNode
  if (node && node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement
  }

  while (node && node !== editor) {
    if (node.dataset && node.dataset.fontStyle) {
      return node.dataset.fontStyle
    }
    node = node.parentElement
  }

  // If the caret is directly inside the editor with no styled wrapper, stick with the current style.
  if (node === editor) {
    return currentFontStyle
  }

  // Fallback: map computed font size to the nearest predefined style.
  const rangeNode = selection.anchorNode?.parentElement || editor
  const computedSize = parseFloat(window.getComputedStyle(rangeNode).fontSize)
  if (Number.isNaN(computedSize)) return null

  let closest = FONT_STYLES[0]
  let smallestDiff = Math.abs(computedSize - closest.size)
  FONT_STYLES.forEach(style => {
    const diff = Math.abs(computedSize - style.size)
    if (diff < smallestDiff) {
      closest = style
      smallestDiff = diff
    }
  })

  return closest?.key || null
}

// Apply an explicit font style span when users pick a style from the dropdown.
function applyFontStyle(style) {
  const editor = document.getElementById('notes')
  editor.focus()
  const { size, lineHeight, key, weight } = style
  
  // Check if we have selected text
  const selection = window.getSelection()
  if (selection.rangeCount > 0 && !selection.isCollapsed) {
    // Text is selected - wrap it in a span
    const range = selection.getRangeAt(0)
    const span = document.createElement('span')
    span.style.fontSize = size + 'px'
    span.style.lineHeight = lineHeight
    span.style.fontWeight = weight
    span.dataset.fontStyle = key
    
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
    // No selection - insert a caret span so future typing uses the chosen style.
    const range = selection.getRangeAt(0)
    const span = document.createElement('span')
    span.style.fontSize = size + 'px'
    span.style.lineHeight = lineHeight
    span.style.fontWeight = weight
    span.dataset.fontStyle = key
    span.innerHTML = '\u200b'
    range.insertNode(span)
    selection.removeAllRanges()
    const newRange = document.createRange()
    newRange.setStart(span.firstChild, 1)
    newRange.collapse(true)
    selection.addRange(newRange)
  }
  
  // Trigger save
  editor.dispatchEvent(new Event('input'))

  // Refresh toolbar selection immediately after applying the style.
  updateToolbarStates()
}

// Reflect the current selection's formatting by toggling toolbar button active states.
function updateToolbarStates() {
  // Check current formatting at cursor position
  const boldBtn = document.getElementById('bold-btn')
  const italicBtn = document.getElementById('italic-btn')
  const underlineBtn = document.getElementById('underline-btn')
  const bulletBtn = document.getElementById('bullet-btn')
  const numberBtn = document.getElementById('number-btn')
  const fontDropdown = document.getElementById('font-size-select')
  
  // Use browser's queryCommandState to check formatting
  boldBtn.classList.toggle('active', document.queryCommandState('bold'))
  italicBtn.classList.toggle('active', document.queryCommandState('italic'))
  underlineBtn.classList.toggle('active', document.queryCommandState('underline'))
  bulletBtn.classList.toggle('active', document.queryCommandState('insertUnorderedList'))
  numberBtn.classList.toggle('active', document.queryCommandState('insertOrderedList'))

  // Reflect current font style in the dropdown based on the selection.
  const activeStyleKey = detectSelectionStyle()
  if (fontDropdown) {
    if (activeStyleKey) {
      fontDropdown.value = activeStyleKey
      currentFontStyle = activeStyleKey
    } else if (!fontDropdown.value) {
      fontDropdown.value = currentFontStyle
    }
  }
}
// Map dropdown selections to predefined font sizes.
function setFontSize(styleKey) {
  const dropdown = document.getElementById('font-size-select')
  const style = FONT_STYLES.find(entry => entry.key === styleKey) || FONT_STYLES[0]

  currentFontStyle = style.key
  if (dropdown && dropdown.value !== style.key) {
    dropdown.value = style.key
  }

  applyFontStyle(style)
  updateToolbarStates()
}

// Adjust UI transparency as opacity changes from the slider, menu, or tray.
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
    editor.style.textShadow = 'none'
    editor.style.color = 'rgba(0, 0, 0, 0.92)'
  } else {
    editor.style.fontWeight = 'normal'
    editor.style.textShadow = 'none'
    editor.style.color = 'var(--text-primary)'
  }

  // Update the display
  const percentage = Math.round(value * 100)
  document.getElementById('opacity-value').textContent = percentage + '%'
  document.getElementById('opacity-slider').value = percentage
}

// Expand or collapse the sidebar while optionally persisting the preference.
function applySidebarState(collapsed, { persist = false, suppressAnimation = false } = {}) {
  const body = document.body
  const toggle = document.getElementById('toolbar-sidebar-toggle')

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
    toggle.title = isCollapsed ? 'Show sidebar' : 'Hide sidebar'
    toggle.classList.toggle('active', !isCollapsed)
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

// Toggle a body class so CSS can adapt spacing while fullscreen is active.
function updateFullscreenClass(isFullscreen) {
  const body = document.body
  if (!body) return
  body.classList.toggle('window-fullscreen', !!isFullscreen)
}

// Kick off app wiring after the HTML document is fully parsed.
window.addEventListener('DOMContentLoaded', async () => {
  editor = document.getElementById('notes')
  noteList = document.getElementById('note-list')
  newNoteButton = document.getElementById('toolbar-new-note-button')
  saveStatus = document.getElementById('save-status')
  privacyCheckbox = document.getElementById('privacy-checkbox')

  const opacitySlider = document.getElementById('opacity-slider')
  const toolbarWrapper = document.getElementById('toolbar-wrapper')
  const toolbarToggle = document.getElementById('toolbar-toggle')
  const sidebarToggle = document.getElementById('toolbar-sidebar-toggle')
  const fontSizeDropdown = document.getElementById('font-size-select')
  const isMac = navigator.platform.toUpperCase().includes('MAC')

  sidebarToggleShortcutHint = isMac ? '⌥⌘S' : 'Ctrl+Alt+S'

  // Default to full opacity on load so UI elements look crisp.
  updateOpacity(1.0)

  if (window.api?.onFullscreenChanged) {
    window.api.onFullscreenChanged((_, isFullscreen) => {
      updateFullscreenClass(isFullscreen)
    })
  }

  if (window.api?.getFullscreenState) {
    try {
      const isFullscreen = await window.api.getFullscreenState()
      updateFullscreenClass(isFullscreen)
    } catch (error) {
      console.error('getFullscreenState error', error)
    }
  }

  if (opacitySlider) {
    // Match the native slider track to the app's accent color.
    opacitySlider.style.background = 'linear-gradient(to right, var(--blue-primary) 0%, var(--blue-primary) 100%, var(--bg-tertiary) 100%, var(--bg-tertiary) 100%)'
  }

  if (fontSizeDropdown) {
    fontSizeDropdown.value = currentFontStyle
  }

  // Restore persisted state (notes array, active note, sidebar, etc.).
  const loadedState = await window.api.loadNotes()
  const preparedState = prepareNotes(loadedState?.notes)
  notes = preparedState.notes
  let stateChanged = preparedState.mutated

  const hasExistingContent = notes.some(note => {
    const text = (note.content || '').replace(/<[^>]*>/g, '').trim()
    return text.length > 0
  })

  const privacyValue = typeof loadedState?.privacy === 'boolean' ? loadedState.privacy : true
  if (privacyCheckbox) {
    privacyCheckbox.checked = privacyValue
  }
  updatePrivacyBadge(privacyValue)

  const initialSidebarCollapsed = typeof loadedState?.sidebarCollapsed === 'boolean' ? loadedState.sidebarCollapsed : true
  applySidebarState(initialSidebarCollapsed, { suppressAnimation: true })

  if (!notes.length) {
    // Ensure at least one note exists so the editor always has somewhere to write.
    const now = new Date().toISOString()
    notes.push({
      id: generateNoteId(),
      content: '',
      createdAt: now,
      updatedAt: now,
      title: FALLBACK_NOTE_TITLE
    })
    stateChanged = true
  }

  let launchBlankNoteId = null

  if (hasExistingContent) {
    const now = new Date().toISOString()
    const blankNote = {
      id: generateNoteId(),
      content: '',
      createdAt: now,
      updatedAt: now,
      title: FALLBACK_NOTE_TITLE
    }
    notes.unshift(blankNote)
    launchBlankNoteId = blankNote.id
    stateChanged = true
  }

  sortNotesByUpdated()

  if (launchBlankNoteId) {
    activeNoteId = launchBlankNoteId
  } else if (loadedState?.activeNoteId && notes.some(note => note.id === loadedState.activeNoteId)) {
    activeNoteId = loadedState.activeNoteId
  } else {
    activeNoteId = notes[0]?.id ?? null
    stateChanged = true
  }

  if (editor) {
    const activeNote = getActiveNote()
    editor.innerHTML = activeNote ? activeNote.content : ''
    updateHeaderTitle(activeNote)
  }

  renderNotesList()
  updateToolbarStates()

  if (newNoteButton) {
    // Clicking the button inserts a new blank note at the top of the list.
    newNoteButton.addEventListener('click', () => {
      if (editor) {
        updateActiveNoteContent(editor.innerHTML)
        persistStateImmediate()
      }
      createNote({ focus: true, persist: true })
    })
  }

  if (sidebarToggle) {
    // Toggle the sidebar visibility without losing the user's preference.
    sidebarToggle.addEventListener('click', () => {
      applySidebarState(!sidebarCollapsed, { persist: true })
    })
  }

  window.addEventListener('keydown', (event) => {
    const primaryModifier = isMac ? event.metaKey : event.ctrlKey

    if (!primaryModifier || !event.altKey) return
    if (event.key.toLowerCase() !== 's') return

    event.preventDefault()
    // Mirror the menu shortcut for toggling the sidebar.
    applySidebarState(!sidebarCollapsed, { persist: true })
  })

  if (editor) {
    editor.addEventListener('input', (e) => {
      updateActiveNoteContent(e.target.innerHTML)
    })

    // Refresh toolbar state whenever the selection changes via typing or clicking.
    editor.addEventListener('keyup', updateToolbarStates)
    editor.addEventListener('mouseup', updateToolbarStates)
    editor.addEventListener('focus', updateToolbarStates)

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

  document.addEventListener('selectionchange', () => {
    if (document.activeElement === editor) {
      updateToolbarStates()
    }
  })

  if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
      const value = e.target.value / 100
      const percentage = e.target.value

      e.target.style.background = `linear-gradient(to right, var(--blue-primary) 0%, var(--blue-primary) ${percentage}%, var(--bg-tertiary) ${percentage}%, var(--bg-tertiary) 100%)`

      updateOpacity(value)
    })
  }

  if (fontSizeDropdown) {
    fontSizeDropdown.addEventListener('change', (e) => {
      setFontSize(e.target.value)
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

  // Hidden file input reused for the plain-text and JSON import flows.
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.style.display = 'none'
  document.body.appendChild(fileInput)

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const content = await readFile(file)

      if (file.name.endsWith('.json')) {
        const data = JSON.parse(content)

        if (Array.isArray(data.notes)) {
          const imported = prepareNotes(data.notes)
          notes = imported.notes
          sortNotesByUpdated()

          if (data.activeNoteId && notes.some(note => note.id === data.activeNoteId)) {
            activeNoteId = data.activeNoteId
          } else {
            activeNoteId = notes[0]?.id ?? null
          }

          if (!notes.length) {
            const now = new Date().toISOString()
            notes.push({
              id: generateNoteId(),
              content: '',
              createdAt: now,
              updatedAt: now,
              title: FALLBACK_NOTE_TITLE
            })
            activeNoteId = notes[0].id
          }

          if (editor) {
            const activeNote = getActiveNote()
            editor.innerHTML = activeNote ? activeNote.content : ''
            updateHeaderTitle(activeNote)
          }

          renderNotesList()
          updateToolbarStates()
          persistStateImmediate()
        } else if (typeof data.notes === 'string') {
          if (!getActiveNote()) {
            const now = new Date().toISOString()
            notes = [{
              id: generateNoteId(),
              content: '',
              createdAt: now,
              updatedAt: now,
              title: FALLBACK_NOTE_TITLE
            }]
            activeNoteId = notes[0].id
          }

          if (editor) {
            editor.innerHTML = data.notes
            updateActiveNoteContent(editor.innerHTML)
            focusEditorAtEnd()
          }
        }
      } else {
        if (!getActiveNote()) {
          const now = new Date().toISOString()
          notes = [{
            id: generateNoteId(),
            content: '',
            createdAt: now,
            updatedAt: now,
            title: FALLBACK_NOTE_TITLE
          }]
          activeNoteId = notes[0].id
        }

        if (editor) {
          editor.innerHTML = content
          updateActiveNoteContent(editor.innerHTML)
          focusEditorAtEnd()
        }
      }
    } catch (error) {
      console.error('Import failed:', error)
    } finally {
      fileInput.value = ''
    }
  })

  if (privacyCheckbox) {
    // Keep the badge and persisted state in sync when privacy toggle flips.
    privacyCheckbox.addEventListener('change', async (e) => {
      const on = e.target.checked
      await window.api.togglePrivacy()
      updatePrivacyBadge(on)
      persistStateImmediate()
    })
  }

  // Export/import handlers register callbacks exposed via preload.
  window.api.onExportNotes(async () => {
    const activeNote = getActiveNote()
    if (!activeNote) return

    const timestamp = new Date().toISOString().split('T')[0]
    downloadFile(activeNote.content, `presenter-notes-${timestamp}.md`, 'text/markdown')
  })

  window.api.onImportNotes(() => {
    fileInput.accept = '.txt,.md,.markdown'
    fileInput.click()
  })

  window.api.onExportBackup(async () => {
    const timestamp = new Date().toISOString()
    const payload = {
      ...buildStatePayload(),
      exportedAt: timestamp
    }

    downloadFile(JSON.stringify(payload, null, 2), `notes-backup-${timestamp.split('T')[0]}.json`, 'application/json')
  })

  window.api.onImportBackup(() => {
    fileInput.accept = '.json'
    fileInput.click()
  })

  if (stateChanged) {
    persistStateImmediate()
  }

  if (editor) {
    focusEditorAtEnd()
  }
})

// Toolbar button shortcuts mimic the keyboard formatting accelerators.
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





// Subscribe to IPC-driven tweaks from menus, tray, and shortcuts.
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

// Show or hide the privacy badge text based on the active state.
function updatePrivacyBadge(on) {
  const badge = document.querySelector('.privacy-badge')
  const label = document.querySelector('.privacy-label')

  if (badge) {
    badge.style.display = on ? 'inline-block' : 'none'
  }

  if (label) {
    label.style.display = on ? 'none' : 'inline-block'
  }
}
