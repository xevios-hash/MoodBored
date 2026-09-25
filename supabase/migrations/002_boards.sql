-- MoodBored: Supabase table for board persistence
-- Run this in your Supabase SQL editor to enable board persistence across
-- Railway redeployments.

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upsert conflict resolution: INSERT ... ON CONFLICT (id) DO UPDATE
-- requires the PRIMARY KEY on id, which is already set above.

-- Allow the anon key to read/write (for the server.mjs sync)
-- Adjust RLS policies if you want stricter access control.
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_anon" ON boards
  FOR ALL USING (true) WITH CHECK (true);