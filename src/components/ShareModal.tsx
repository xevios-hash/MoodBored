import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/stores/useStore'
import { X, Copy, Check, Link, Users, Shield, Trash2 } from 'lucide-react'
import { showToast } from '@/lib/toasts'
import {
  createShareLink, listShareLinks, updateShareRole, revokeShareLink, getShareUrl,
  type BoardShare, type ShareRole,
} from '@/lib/collaboration'

interface Props {
  onClose: () => void
}

export function ShareModal({ onClose }: Props) {
  const project = useStore((s) => s.project)
  const [shares, setShares] = useState<BoardShare[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Load existing shares
  useEffect(() => {
    listShareLinks(project.id).then((s) => {
      setShares(s)
      setLoading(false)
    })
  }, [project.id])

  const handleCreate = async (role: ShareRole) => {
    setCreating(true)
    const share = await createShareLink(project.id, role)
    if (share) {
      setShares([share, ...shares])
      const url = getShareUrl(project.id, share.share_token)
      await navigator.clipboard.writeText(url)
      setCopiedId(share.id)
      showToast(`${role === 'editor' ? 'Edit' : 'View'} link copied to clipboard`, 'success')
      setTimeout(() => setCopiedId(null), 2000)
    } else {
      showToast('Failed to create share link — are you signed in?', 'error')
    }
    setCreating(false)
  }

  const handleCopy = async (share: BoardShare) => {
    const url = getShareUrl(project.id, share.share_token)
    await navigator.clipboard.writeText(url)
    setCopiedId(share.id)
    showToast('Link copied', 'success')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRoleChange = async (share: BoardShare, newRole: ShareRole) => {
    const ok = await updateShareRole(share.id, newRole)
    if (ok) {
      setShares(shares.map(s => s.id === share.id ? { ...s, role: newRole } : s))
      showToast(`Role changed to ${newRole}`, 'success')
    }
  }

  const handleRevoke = async (share: BoardShare) => {
    const ok = await revokeShareLink(share.id)
    if (ok) {
      setShares(shares.filter(s => s.id !== share.id))
      showToast('Share link revoked', 'info')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-fadeIn" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(480px,90vw)] glass-card rounded-xl shadow-panel overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Share Board</h2>
            <p className="text-xs text-text-muted mt-0.5">Anyone with a link can view. You choose who can edit.</p>
          </div>
          <button onClick={onClose} className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Create new share links */}
          <div className="flex gap-2">
            <button
              onClick={() => handleCreate('viewer')}
              disabled={creating}
              className="btn btn-ghost flex-1 flex items-center justify-center gap-2"
            >
              <Link size={14} />
              Copy View Link
            </button>
            <button
              onClick={() => handleCreate('editor')}
              disabled={creating}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Users size={14} />
              Copy Edit Link
            </button>
          </div>

          {/* Existing shares */}
          {loading ? (
            <div className="text-center py-4 text-text-muted text-sm">Loading...</div>
          ) : shares.length === 0 ? (
            <div className="text-center py-4 text-text-muted text-sm">
              No active share links. Create one above.
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Active Links</label>
              {shares.map((share) => (
                <div key={share.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {share.role === 'editor' ? 'Edit access' : 'View only'}
                      </span>
                      <span className="text-2xs text-text-muted">
                        {new Date(share.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <code className="text-2xs text-text-muted block truncate">
                      {getShareUrl(project.id, share.share_token)}
                    </code>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={share.role}
                      onChange={(e) => handleRoleChange(share, e.target.value as ShareRole)}
                      className="input text-xs py-1 px-2 w-20"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      onClick={() => handleCopy(share)}
                      className="btn p-1 text-text-muted hover:text-accent"
                      title="Copy link"
                    >
                      {copiedId === share.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={() => handleRevoke(share)}
                      className="btn p-1 text-text-muted hover:text-danger"
                      title="Revoke link"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          <div className="p-3 bg-accent/5 rounded-lg border border-accent/10">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={14} className="text-accent" />
              <span className="text-xs font-medium text-text-primary">How sharing works</span>
            </div>
            <ul className="text-2xs text-text-muted space-y-0.5">
              <li>• View links: anyone can see the board but can't change it</li>
              <li>• Edit links: anyone can add, move, and remove items</li>
              <li>• No sign-up required to view or edit</li>
              <li>• You can change roles or revoke links anytime</li>
              <li>• Anonymous users get fun names like "Blue Penguin"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}