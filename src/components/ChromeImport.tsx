import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import type { ChromeTab } from '@/types'
import { getChromeTabs, groupTabsByDomain, generateImportSummary } from '@/lib/chrome-import'

interface ChromeImportProps {
  onClose: () => void
}

export function ChromeImport({ onClose }: ChromeImportProps) {
  const [tabs, setTabs] = useState<ChromeTab[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTabs, setSelectedTabs] = useState<Set<number>>(new Set())
  const [groupByDomain, setGroupByDomain] = useState(true)
  const importChromeTabs = useStore((s) => s.importChromeTabs)

  useEffect(() => {
    loadTabs()
  }, [])

  const loadTabs = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getChromeTabs()
      if (result.length === 0) {
        setError('No Chrome tabs found. Make sure Chrome is running with --remote-debugging-port=9222')
      } else {
        setTabs(result)
        setSelectedTabs(new Set(result.map((_, i) => i)))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get Chrome tabs')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => {
    const selected = tabs.filter((_, i) => selectedTabs.has(i))
    if (selected.length > 0) {
      importChromeTabs(selected)
      onClose()
    }
  }

  const toggleTab = (index: number) => {
    const next = new Set(selectedTabs)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setSelectedTabs(next)
  }

  const toggleAll = () => {
    if (selectedTabs.size === tabs.length) {
      setSelectedTabs(new Set())
    } else {
      setSelectedTabs(new Set(tabs.map((_, i) => i)))
    }
  }

  const grouped = groupByDomain ? groupTabsByDomain(tabs) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Import Chrome Tabs</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {tabs.length} tabs found · {selectedTabs.size} selected
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setGroupByDomain(!groupByDomain)}
              className="btn btn-ghost text-xs px-2 py-1"
            >
              {groupByDomain ? 'List' : 'Group'}
            </button>
            <button onClick={onClose} className="btn btn-ghost text-xs px-2 py-1">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-sm text-text-secondary mb-2">{error}</div>
              <div className="text-xs text-text-muted mb-4">
                To enable Chrome import:<br />
                1. Close all Chrome windows<br />
                2. Open Terminal and run:<br />
                <code className="bg-surface-2 px-2 py-1 rounded mt-1 inline-block">
                  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
                </code>
              </div>
              <button onClick={loadTabs} className="btn btn-accent text-xs px-3 py-1.5">
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && tabs.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={toggleAll}
                  className="btn btn-ghost text-xs px-2 py-1"
                >
                  {selectedTabs.size === tabs.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {grouped ? (
                // Grouped by domain
                Array.from(grouped.entries()).map(([domain, domainTabs]) => (
                  <div key={domain} className="mb-3">
                    <div className="flex items-center gap-2 px-2 py-1 bg-surface-1 rounded-t-lg">
                      <span className="text-xs font-medium text-text-secondary">{domain}</span>
                      <span className="text-2xs text-text-muted">({domainTabs.length})</span>
                    </div>
                    <div className="border border-border/50 rounded-b-lg overflow-hidden">
                      {domainTabs.map((tab) => {
                        const idx = tabs.indexOf(tab)
                        return (
                          <TabItem
                            key={idx}
                            tab={tab}
                            selected={selectedTabs.has(idx)}
                            onToggle={() => toggleTab(idx)}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))
              ) : (
                // Flat list
                <div className="space-y-1">
                  {tabs.map((tab, idx) => (
                    <TabItem
                      key={idx}
                      tab={tab}
                      selected={selectedTabs.has(idx)}
                      onToggle={() => toggleTab(idx)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && tabs.length > 0 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-border">
            <div className="text-xs text-text-muted">
              {selectedTabs.size} tabs will be added as web nodes
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn btn-ghost text-xs px-3 py-1.5">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedTabs.size === 0}
                className="btn btn-accent text-xs px-3 py-1.5"
              >
                Import {selectedTabs.size} Tabs
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TabItem({ tab, selected, onToggle }: {
  tab: ChromeTab
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-fast ${
        selected ? 'bg-accent/5' : 'hover:bg-surface-2'
      }`}
    >
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
        selected ? 'bg-accent border-accent' : 'border-border'
      }`}>
        {selected && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
      {tab.favIconUrl && (
        <img src={tab.favIconUrl} alt="" className="w-4 h-4 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-primary truncate">{tab.title}</div>
        <div className="text-2xs text-text-muted truncate">{tab.url}</div>
      </div>
      {tab.pinned && <span className="text-2xs text-accent">📌</span>}
    </button>
  )
}