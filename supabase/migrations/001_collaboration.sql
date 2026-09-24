-- MoodBored Collaboration Schema
-- Run this in your Supabase SQL editor to enable real-time collaboration.
-- This is additive — it doesn't modify existing tables.

-- ─── Board Shares ──────────────────────────────────────────────────
-- Each board can have multiple share links with different roles.
-- The share_token IS the access credential — no auth required to use it.

CREATE TABLE IF NOT EXISTS board_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_board_shares_token ON board_shares(share_token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_board_shares_board ON board_shares(board_id);

-- ─── RLS Policies ──────────────────────────────────────────────────

ALTER TABLE board_shares ENABLE ROW LEVEL SECURITY;

-- Anyone can read a share by token (for joining a board)
CREATE POLICY "share_read_by_token" ON board_shares
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Only the board owner can create/manage shares
CREATE POLICY "share_manage_by_owner" ON board_shares
  FOR ALL USING (
    created_by = auth.uid()
    OR board_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- Projects: allow read access via share token (no auth required)
-- This is handled client-side — the share token grants read access to the project data.
-- Write access is enforced by the client checking the role before sending mutations.

-- ─── Realtime ──────────────────────────────────────────────────────
-- Enable realtime for the board_shares table so clients get notified
-- when shares are created/revoked.

ALTER PUBLICATION supabase_realtime ADD TABLE board_shares;