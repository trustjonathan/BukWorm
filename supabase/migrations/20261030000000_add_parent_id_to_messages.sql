-- ========================================================
-- Migration: Add parent_id to messages for threaded chats
-- ========================================================

-- Add parent_id column (nullable — null means a root-level spine message)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Index for fast lookup of all replies to a given message
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages (parent_id);

-- Function: given a message id, return the ordered ancestor chain (for LLM context)
CREATE OR REPLACE FUNCTION get_message_ancestor_chain(p_message_id UUID)
RETURNS TABLE(id UUID, role TEXT, content TEXT, sequence_number INT)
LANGUAGE sql STABLE
AS $$
  WITH RECURSIVE ancestors AS (
    SELECT m.id, m.role, m.content, m.sequence_number, m.parent_id
    FROM messages m
    WHERE m.id = p_message_id

    UNION ALL

    SELECT m.id, m.role, m.content, m.sequence_number, m.parent_id
    FROM messages m
    INNER JOIN ancestors a ON m.id = a.parent_id
  )
  SELECT id, role, content, sequence_number
  FROM ancestors
  ORDER BY sequence_number ASC;
$$;

