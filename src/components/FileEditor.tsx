// Monaco Editor Component for MoodBored IDE
import { useState, useRef, useCallback, useEffect } from 'react'
import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import { X, Save, Copy, Download, RotateCcw, GitBranch } from 'lucide-react'
import { showToast } from '@/lib/toasts'

interface FileEditorProps {
  filePath: string
  fileName: string
  content: string
  language: string
  onSave: (content: string) => void
  onClose: () => void
}

export function FileEditor({ filePath, fileName, content, language, onSave, onClose }: FileEditorProps) {
  const [editedContent, setEditedContent] = useState(content)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const editorRef = useRef<any>(null)

  // Handle editor mount
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    // Add save shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave()
    })

    // Focus editor
    editor.focus()
  }

  // Handle content change
  const handleEditorChange: OnChange = (value) => {
    setEditedContent(value || '')
    setIsDirty(true)
  }

  // Save file
  const handleSave = useCallback(async () => {
    if (!isDirty) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: editedContent }),
      })

      if (res.ok) {
        setIsDirty(false)
        onSave(editedContent)
        showToast('File saved', 'success')
      } else {
        const data = await res.json()
        showToast(`Failed to save: ${data.error}`, 'error')
      }
    } catch (err) {
      showToast('Failed to save file', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [editedContent, filePath, isDirty, onSave])

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(editedContent)
    showToast('Copied to clipboard', 'success')
  }

  // Download file
  const handleDownload = () => {
    const blob = new Blob([editedContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    showToast('File downloaded', 'success')
  }

  // Reset to original
  const handleReset = () => {
    setEditedContent(content)
    setIsDirty(false)
    showToast('Reset to original', 'info')
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape' && !e.shiftKey) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, onClose])

  // Get language for Monaco
  const monacoLanguage = language === 'typescriptreact' ? 'typescript'
    : language === 'javascriptreact' ? 'javascript'
    : language

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[min(1100px,95vw)] h-[min(750px,90vh)] glass-card rounded-xl shadow-2xl flex flex-col animate-scaleIn overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between bg-surface-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📄</span>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{fileName}</h2>
                <p className="text-2xs text-text-muted">
                  {filePath}
                  {isDirty && <span className="text-yellow-500 ml-2">● Unsaved</span>}
                  {!isDirty && <span className="text-green-500 ml-2">✓ Saved</span>}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Font size */}
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={() => setFontSize(Math.max(10, fontSize - 2))}
                className="p-1 rounded hover:bg-surface-2 text-text-muted"
                title="Decrease font size"
              >
                <span className="text-xs">A-</span>
              </button>
              <span className="text-2xs text-text-muted w-6 text-center">{fontSize}</span>
              <button
                onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                className="p-1 rounded hover:bg-surface-2 text-text-muted"
                title="Increase font size"
              >
                <span className="text-xs">A+</span>
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={handleReset}
              disabled={!isDirty}
              className="btn btn-ghost text-xs flex items-center gap-1"
              title="Reset to original"
            >
              <RotateCcw size={12} />
            </button>
            <button
              onClick={handleCopy}
              className="btn btn-ghost text-xs flex items-center gap-1"
              title="Copy content"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={handleDownload}
              className="btn btn-ghost text-xs flex items-center gap-1"
              title="Download file"
            >
              <Download size={12} />
            </button>
            <div className="w-px h-6 bg-white/[0.06] mx-1" />
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="btn btn-primary text-xs flex items-center gap-1"
            >
              <Save size={12} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost text-xs p-1.5"
              title="Close (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language={monacoLanguage}
            value={editedContent}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              fontSize,
              fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
              fontLigatures: true,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              formatOnPaste: true,
              formatOnType: true,
              tabSize: 2,
              renderLineHighlight: 'all',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
            }}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center justify-between text-2xs text-text-muted bg-surface-1">
          <div className="flex items-center gap-4">
            <span>{language}</span>
            <span>{editedContent.split('\n').length} lines</span>
            <span>{editedContent.length} chars</span>
          </div>
          <div className="flex items-center gap-4">
            <span>⌘S to save</span>
            <span>Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
