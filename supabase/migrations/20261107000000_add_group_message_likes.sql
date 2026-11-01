BEGIN;

CREATE TABLE public.message_likes (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_likes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.message_likes TO authenticated;

CREATE POLICY message_likes_select_workspace_members
  ON public.message_likes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages AS message
      JOIN public.chats AS chat ON chat.id = message.chat_id
      WHERE message.id = message_likes.message_id
        AND public.can_access_workspace(chat.workspace_id)
    )
  );

CREATE POLICY message_likes_insert_editors
  ON public.message_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.messages AS message
      JOIN public.chats AS chat ON chat.id = message.chat_id
      WHERE message.id = message_likes.message_id
        AND public.can_edit_workspace(chat.workspace_id)
    )
  );

CREATE POLICY message_likes_delete_editors
  ON public.message_likes FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.messages AS message
      JOIN public.chats AS chat ON chat.id = message.chat_id
      WHERE message.id = message_likes.message_id
        AND public.can_edit_workspace(chat.workspace_id)
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_likes;
  END IF;
END
$$;

COMMIT;
