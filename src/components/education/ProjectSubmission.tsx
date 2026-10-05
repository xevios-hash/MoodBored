import { useState, useCallback, useRef } from 'react'
import type { GradeLevel, Slide } from '@/types'
import { ProjectTemplate, PROJECT_TEMPLATES, getTemplatesByGrade, calculateRubricScore, generateRubricFeedback, RubricCriteria } from '@/lib/projectTemplates'

interface ProjectSubmissionProps {
  slide: Slide
  gradeLevel: GradeLevel
  onSubmit: (submission: ProjectSubmissionData) => void
  onClose: () => void
}

export interface ProjectSubmissionData {
  projectId: string
  title: string
  description: string
  content: string
  files: File[]
  url?: string
  submittedAt: string
  rubricScores?: Record<string, number>
}

export function ProjectSubmission({ slide, gradeLevel, onSubmit, onClose }: ProjectSubmissionProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [url, setUrl] = useState('')
  const [activeTab, setActiveTab] = useState<'write' | 'upload' | 'link'>('write')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      alert('Please enter a title for your project')
      return
    }

    setIsSubmitting(true)
    
    // Simulate submission delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    const submission: ProjectSubmissionData = {
      projectId: slide.id,
      title: title.trim(),
      description: description.trim(),
      content: content.trim(),
      files,
      url: url.trim() || undefined,
      submittedAt: new Date().toISOString(),
    }

    onSubmit(submission)
    setIsSubmitting(false)
    onClose()
  }, [title, description, content, files, url, slide.id, onSubmit, onClose])

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (selectedFiles) {
      setFiles(prev => [...prev, ...Array.from(selectedFiles)])
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <div className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Submit Project</h2>
          <p className="text-sm text-gray-500">{slide.title}</p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your project a title..."
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe your project..."
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-purple-500 focus:outline-none"
              rows={2}
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {(['write', 'upload', 'link'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab === 'write' ? '✏️ Write' : tab === 'upload' ? '📎 Upload' : '🔗 Link'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'write' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Work
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your project here..."
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:outline-none"
                rows={8}
              />
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Files
              </label>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragOver
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
                <div className="text-4xl mb-2">📎</div>
                <div className="text-gray-600 mb-1">
                  Drag & drop files here, or <span className="text-purple-600 font-medium">browse</span>
                </div>
                <div className="text-xs text-gray-400">
                  Support for images, documents, PDFs, and more
                </div>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📄</span>
                        <div>
                          <div className="text-sm font-medium text-gray-700">{file.name}</div>
                          <div className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="p-1 rounded hover:bg-gray-200"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'link' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Link
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-purple-500 focus:outline-none"
              />
              <div className="mt-2 text-xs text-gray-500">
                Paste a link to your project (Google Docs, GitHub, etc.)
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
            className="px-5 py-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              'Submit Project'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Component for viewing rubric
export function RubricViewer({ 
  rubric, 
  scores, 
  showFeedback = true 
}: { 
  rubric: RubricCriteria[], 
  scores: Record<string, number>,
  showFeedback?: boolean 
}) {
  const result = calculateRubricScore(rubric, scores)
  const feedback = generateRubricFeedback(rubric, scores)

  return (
    <div className="space-y-4">
      {/* Score summary */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800">Rubric Score</div>
          <div className={`text-2xl font-bold ${
            result.percentage >= 90 ? 'text-green-600' :
            result.percentage >= 80 ? 'text-blue-600' :
            result.percentage >= 70 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {result.grade} ({result.percentage}%)
          </div>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
            style={{ width: `${result.percentage}%` }}
          />
        </div>
        <div className="text-sm text-gray-500 mt-2">
          {result.earnedPoints} / {result.totalPoints} points
        </div>
      </div>

      {/* Criteria breakdown */}
      <div className="space-y-3">
        {rubric.map((criteria) => (
          <div key={criteria.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-800">{criteria.name}</div>
              <div className="text-sm text-gray-600">
                {scores[criteria.id] || 0} / {criteria.maxPoints}
              </div>
            </div>
            <div className="text-sm text-gray-500 mb-2">{criteria.description}</div>
            <div className="flex gap-1">
              {criteria.levels.map((level) => (
                <div
                  key={level.points}
                  className={`flex-1 px-2 py-1 rounded text-xs text-center ${
                    (scores[criteria.id] || 0) >= level.points
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {level.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {showFeedback && feedback.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="font-semibold text-blue-800 mb-2">Feedback</div>
          <div className="space-y-1">
            {feedback.map((f, idx) => (
              <div key={idx} className="text-sm text-blue-700">{f}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Component for selecting project template
export function ProjectTemplateSelector({
  gradeLevel,
  onSelect,
  onClose,
}: {
  gradeLevel: GradeLevel
  onSelect: (template: ProjectTemplate) => void
  onClose: () => void
}) {
  const templates = getTemplatesByGrade(gradeLevel)

  return (
    <div className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Choose a Project</h2>
          <p className="text-sm text-gray-500">Select a project template to get started</p>
        </div>

        {/* Templates */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className="text-left p-5 rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{template.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{template.name}</div>
                    <div className="text-sm text-gray-500 mb-2">{template.description}</div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>⏱️ {template.estimatedTime}</span>
                      <span>📋 {template.deliverables.length} deliverable{template.deliverables.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
