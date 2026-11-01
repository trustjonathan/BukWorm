BEGIN;

DROP POLICY IF EXISTS messages_delete_editable_chat ON public.messages;

CREATE POLICY messages_delete_editable_chat
  ON public.messages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chats AS chat
      JOIN public.workspaces AS workspace
        ON workspace.id = chat.workspace_id
      WHERE chat.id = messages.chat_id
        AND public.can_access_workspace(workspace.id)
        AND (
          (
            workspace.sharing = 'shared'
            AND messages.role = 'user'
            AND messages.parent_id IS NOT NULL
            AND public.can_edit_workspace(workspace.id)
            AND (
              messages.user_id = auth.uid()
              OR public.can_manage_workspace(workspace.id)
            )
          )
          OR (
            workspace.sharing <> 'shared'
            AND (
              chat.user_id = auth.uid()
              OR public.can_edit_workspace(workspace.id)
            )
          )
        )
    )
  );

COMMIT;
