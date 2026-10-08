import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { listProjects, createProject, migrateFromLocalStorage, type ProjectMeta } from '@/lib/storage'
import { TEMPLATES } from '@/lib/templates'
import { Plus, FolderOpen, Clock, Trash2 } from 'lucide-react'
import { getRandomVideoBackground } from '@/lib/videoBackgrounds'

interface StartScreenProps {
  onProjectLoaded: () => void
}

export function StartScreen({ onProjectLoaded }: StartScreenProps) {
  const [recentProjects, setRecentProjects] = useState<ProjectMeta[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const setProject = useStore((s) => s.setProject)
  const importProject = useStore((s) => s.importProject)

  // Get session video (same as splash screen)
  const getSessionVideo = () => {
    const stored = sessionStorage.getItem('moodbored-session-video')
    if (stored) {
      try { return JSON.parse(stored) } catch {}
    }
    const video = getRandomVideoBackground()
    sessionStorage.setItem('moodbored-session-video', JSON.stringify(video))
    return video
  }
  const sessionVideo = getSessionVideo()

  useEffect(() => {
    migrateFromLocalStorage().then(() => {
      listProjects().then(setRecentProjects)
    })
  }, [])

  const handleNewProject = async () => {
    if (!selectedTemplate || !projectName.trim()) return
    const template = TEMPLATES.find((t) => t.id === selectedTemplate)
    if (!template) return

    const project = template.create(projectName.trim())
    await createProject(projectName.trim(), `Created from ${template.name} template`, selectedTemplate, project)
    setProject(project)
    onProjectLoaded()
  }

  const handleOpenRecent = async (meta: ProjectMeta) => {
    const { getProject } = await import('@/lib/storage')
    const project = await getProject(meta.id)
    if (project) {
      setProject(project)
      onProjectLoaded()
    }
  }

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const { deleteProject } = await import('@/lib/storage')
    await deleteProject(id)
    setRecentProjects((prev) => prev.filter((p) => p.id !== id))
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          const success = importProject(reader.result)
          if (success) {
            const { project } = useStore.getState()
            await createProject(project.name, 'Imported project', 'import', project)
            onProjectLoaded()
          }
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  if (showTemplates) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Video background */}
        <video autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}>
          <source src={sessionVideo.url} type="video/mp4" />
        </video>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 1 }} />

        <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#1a1028', marginBottom: 8 }}>
          Start Creating
        </h2>
        <p style={{ fontSize: 15, color: '#5a5070', marginBottom: 32 }}>
          Collect ideas, save websites, and organize your thoughts
        </p>

        {/* Primary action - big obvious button */}
        <button
          onClick={() => { setSelectedTemplate('blank'); setProjectName('My Board'); setTimeout(() => handleNewProject(), 10) }}
          style={{
            background: '#6a5aae', color: 'white', border: 'none', borderRadius: 16,
            padding: '18px 48px', fontSize: 18, fontWeight: 600, cursor: 'pointer',
            marginBottom: 24, boxShadow: '0 4px 20px rgba(106,90,174,0.3)',
            transition: 'transform 150ms, box-shadow 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(106,90,174,0.4)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(106,90,174,0.3)' }}
        >
          New Board
        </button>

        {/* Secondary - templates collapsed */}
        <details style={{ marginBottom: 32, textAlign: 'center' }}>
          <summary style={{ fontSize: 13, color: '#8a7aaa', cursor: 'pointer', padding: '8px 16px' }}>
            Or start from a template →
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 600, width: '100%', marginTop: 16 }}>
            {TEMPLATES.filter(t => t.id !== 'blank').map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedTemplate(t.id); setProjectName('My Board'); setTimeout(() => handleNewProject(), 10) }}
                style={{
                  background: '#ffffff', border: '1px solid #e5e7eb',
                  borderRadius: 10, padding: 14, cursor: 'pointer', textAlign: 'left',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8b7dc8' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1028' }}>{t.name}</div>
              </button>
            ))}
          </div>
        </details>

        {selectedTemplate && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNewProject()}
              placeholder="Name your project..."
              style={{
                background: '#ffffff', border: '2px solid #8b7dc8', borderRadius: 10,
                padding: '10px 16px', fontSize: 16, width: 300, outline: 'none',
                color: '#1a1028', fontFamily: 'inherit',
              }}
              autoFocus
            />
            <button
              onClick={handleNewProject}
              disabled={!projectName.trim()}
              style={{
                background: projectName.trim() ? '#8b7dc8' : '#9ca3af',
                color: '#ffffff', border: 'none', borderRadius: 10,
                padding: '10px 24px', fontSize: 15, fontWeight: 600,
                cursor: projectName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Create
            </button>
          </div>
        )}

        <button
          onClick={() => setShowTemplates(false)}
          style={{ background: 'none', border: 'none', color: '#8a7aaa', cursor: 'pointer', fontSize: 14, position: 'relative', zIndex: 2 }}
        >
          ← Back
        </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Video background */}
      <video autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}>
        <source src={sessionVideo.url} type="video/mp4" />
      </video>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', zIndex: 1 }} />

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 2, padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="MoodBored" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: '#8b7dc8' }}>MoodBored</span>
        </div>
        <button
          onClick={handleImport}
          style={{
            background: 'none', border: '1px solid #dee2e6', borderRadius: 8,
            padding: '6px 16px', fontSize: 13, color: '#8a7aaa', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <FolderOpen size={14} /> Import
        </button>
      </div>

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1a1028', marginBottom: 8 }}>
          Welcome to MoodBored
        </h1>
        <p style={{ fontSize: 16, color: '#8a7aaa', marginBottom: 48, textAlign: 'center' }}>
          Collaborative mood-board workspace for humans and AI
        </p>

        {/* Action cards */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 48 }}>
          {/* New Project */}
          <button
            onClick={() => setShowTemplates(true)}
            style={{
              background: '#ffffff', border: '2px solid #8b7dc8', borderRadius: 16,
              padding: '32px 40px', cursor: 'pointer', textAlign: 'center',
              transition: 'all 200ms ease', width: 200,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(13,148,136,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            <Plus size={32} style={{ color: '#8b7dc8', marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1028', marginBottom: 4 }}>New Project</div>
            <div style={{ fontSize: 12, color: '#8a7aaa' }}>Start from a template</div>
          </button>

          {/* Open File */}
          <button
            onClick={handleImport}
            style={{
              background: '#ffffff', border: '2px solid #dee2e6', borderRadius: 16,
              padding: '32px 40px', cursor: 'pointer', textAlign: 'center',
              transition: 'all 200ms ease', width: 200,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            <FolderOpen size={32} style={{ color: '#8a7aaa', marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1028', marginBottom: 4 }}>Open File</div>
            <div style={{ fontSize: 12, color: '#8a7aaa' }}>Import a .json project</div>
          </button>
        </div>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div style={{ width: '100%', maxWidth: 600 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#8a7aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Recent Projects
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentProjects.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleOpenRecent(p)}
                  style={{
                    background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10,
                    padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8b7dc8'; e.currentTarget.style.background = '#f0ecfa' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#ffffff' }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1028' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {new Date(p.updated).toLocaleDateString()} · {p.template}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(p.id, e)}
                    style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4 }}
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
