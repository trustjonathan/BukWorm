CREATE TABLE public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX workspace_members_user_id_idx
  ON public.workspace_members(user_id);

CREATE TABLE public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX workspace_invites_workspace_id_idx
  ON public.workspace_invites(workspace_id);

CREATE TABLE public.workspace_user_preferences (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE public.chat_user_preferences (
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX workspace_user_preferences_user_archive_idx
  ON public.workspace_user_preferences(user_id, archived_at);
CREATE INDEX chat_user_preferences_user_archive_idx
  ON public.chat_user_preferences(user_id, archived_at);

CREATE OR REPLACE FUNCTION public.workspace_role(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN workspace.user_id = auth.uid() THEN 'owner'
    WHEN workspace.sharing <> 'shared' THEN NULL
    ELSE (
      SELECT member.role
      FROM public.workspace_members AS member
      WHERE member.workspace_id = workspace.id
        AND member.user_id = auth.uid()
    )
  END
  FROM public.workspaces AS workspace
  WHERE workspace.id = p_workspace_id;
$$;

CREATE OR REPLACE FUNCTION public.can_access_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.workspace_role(p_workspace_id) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    public.workspace_role(p_workspace_id) IN ('owner', 'admin'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    public.workspace_role(p_workspace_id) IN ('owner', 'admin', 'editor'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_file(p_file_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.files AS file
    WHERE file.id = p_file_id
      AND (
        file.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.file_workspaces AS link
          WHERE link.file_id = file.id
            AND public.can_access_workspace(link.workspace_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.collection_files AS collection_file
          JOIN public.collection_workspaces AS collection_workspace
            ON collection_workspace.collection_id = collection_file.collection_id
          WHERE collection_file.file_id = file.id
            AND public.can_access_workspace(collection_workspace.workspace_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_file(p_file_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.files AS file
    WHERE file.id = p_file_id
      AND (
        (
          file.user_id = auth.uid()
          AND NOT EXISTS (
            SELECT 1
            FROM public.file_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.file_id = file.id
              AND workspace.sharing = 'shared'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.collection_files AS collection_file
            JOIN public.collection_workspaces AS collection_workspace
              ON collection_workspace.collection_id =
                 collection_file.collection_id
            JOIN public.workspaces AS workspace
              ON workspace.id = collection_workspace.workspace_id
            WHERE collection_file.file_id = file.id
              AND workspace.sharing = 'shared'
          )
        )
        OR (
          EXISTS (
            SELECT 1
            FROM public.file_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.file_id = file.id
              AND workspace.sharing = 'shared'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.file_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.file_id = file.id
              AND workspace.sharing = 'shared'
              AND NOT public.can_edit_workspace(link.workspace_id)
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.collection_files AS collection_file
            JOIN public.collection_workspaces AS collection_workspace
              ON collection_workspace.collection_id =
                 collection_file.collection_id
            JOIN public.workspaces AS workspace
              ON workspace.id = collection_workspace.workspace_id
            WHERE collection_file.file_id = file.id
              AND workspace.sharing = 'shared'
              AND NOT public.can_edit_workspace(collection_workspace.workspace_id)
          )
        )
        OR (
          EXISTS (
            SELECT 1
            FROM public.collection_files AS collection_file
            JOIN public.collection_workspaces AS collection_workspace
              ON collection_workspace.collection_id =
                 collection_file.collection_id
            JOIN public.workspaces AS workspace
              ON workspace.id = collection_workspace.workspace_id
            WHERE collection_file.file_id = file.id
              AND workspace.sharing = 'shared'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.collection_files AS collection_file
            JOIN public.collection_workspaces AS collection_workspace
              ON collection_workspace.collection_id =
                 collection_file.collection_id
            JOIN public.workspaces AS workspace
              ON workspace.id = collection_workspace.workspace_id
            WHERE collection_file.file_id = file.id
              AND workspace.sharing = 'shared'
              AND NOT public.can_edit_workspace(collection_workspace.workspace_id)
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.file_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.file_id = file.id
              AND workspace.sharing = 'shared'
              AND NOT public.can_edit_workspace(link.workspace_id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_collection(p_collection_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collections AS collection
    WHERE collection.id = p_collection_id
      AND (
        collection.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.collection_workspaces AS link
          WHERE link.collection_id = collection.id
            AND public.can_access_workspace(link.workspace_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_collection(p_collection_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collections AS collection
    WHERE collection.id = p_collection_id
      AND (
        (
          collection.user_id = auth.uid()
          AND NOT EXISTS (
            SELECT 1
            FROM public.collection_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.collection_id = collection.id
              AND workspace.sharing = 'shared'
          )
        )
        OR (
          EXISTS (
            SELECT 1
            FROM public.collection_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.collection_id = collection.id
              AND workspace.sharing = 'shared'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.collection_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.collection_id = collection.id
              AND workspace.sharing = 'shared'
              AND NOT public.can_edit_workspace(link.workspace_id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_assistant(p_assistant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assistants AS assistant
    WHERE assistant.id = p_assistant_id
      AND (
        assistant.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.assistant_workspaces AS link
          WHERE link.assistant_id = assistant.id
            AND public.can_access_workspace(link.workspace_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_assistant(p_assistant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assistants AS assistant
    WHERE assistant.id = p_assistant_id
      AND (
        (
          assistant.user_id = auth.uid()
          AND NOT EXISTS (
            SELECT 1
            FROM public.assistant_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.assistant_id = assistant.id
              AND workspace.sharing = 'shared'
          )
        )
        OR (
          EXISTS (
            SELECT 1
            FROM public.assistant_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.assistant_id = assistant.id
              AND workspace.sharing = 'shared'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.assistant_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.assistant_id = assistant.id
              AND workspace.sharing = 'shared'
              AND NOT public.can_edit_workspace(link.workspace_id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_prompt(p_prompt_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.prompts AS resource
    WHERE resource.id = p_prompt_id
      AND (
        (
          resource.user_id = auth.uid()
          AND NOT EXISTS (
            SELECT 1 FROM public.prompt_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.prompt_id = resource.id
              AND workspace.sharing = 'shared'
          )
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.prompt_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.prompt_id = resource.id
              AND workspace.sharing = 'shared'
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.prompt_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.prompt_id = resource.id
              AND workspace.sharing = 'shared'
              AND NOT public.can_edit_workspace(link.workspace_id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_preset(p_preset_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.presets AS resource
    WHERE resource.id = p_preset_id
      AND (
        (
          resource.user_id = auth.uid()
          AND NOT EXISTS (
            SELECT 1 FROM public.preset_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.preset_id = resource.id
              AND workspace.sharing = 'shared'
          )
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.preset_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.preset_id = resource.id
              AND workspace.sharing = 'shared'
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.preset_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.preset_id = resource.id
              AND workspace.sharing = 'shared'
              AND NOT public.can_edit_workspace(link.workspace_id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_tool(p_tool_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tools AS resource
    WHERE resource.id = p_tool_id
      AND (
        (
          resource.user_id = auth.uid()
          AND NOT EXISTS (
            SELECT 1 FROM public.tool_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.tool_id = resource.id
              AND workspace.sharing = 'shared'
          )
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.tool_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.tool_id = resource.id
              AND workspace.sharing = 'shared'
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.tool_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.tool_id = resource.id
              AND workspace.sharing = 'shared'
              AND NOT public.can_manage_workspace(link.workspace_id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_model(p_model_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.models AS resource
    WHERE resource.id = p_model_id
      AND (
        (
          resource.user_id = auth.uid()
          AND NOT EXISTS (
            SELECT 1 FROM public.model_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.model_id = resource.id
              AND workspace.sharing = 'shared'
          )
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.model_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.model_id = resource.id
              AND workspace.sharing = 'shared'
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.model_workspaces AS link
            JOIN public.workspaces AS workspace
              ON workspace.id = link.workspace_id
            WHERE link.model_id = resource.id
              AND workspace.sharing = 'shared'
              AND NOT public.can_manage_workspace(link.workspace_id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_file_path(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.files AS file
    WHERE file.file_path = p_path
      AND public.can_access_file(file.id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_message_image_path(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messages AS message
    JOIN public.chats AS chat ON chat.id = message.chat_id
    WHERE message.id::TEXT = (storage.foldername(p_path))[3]
      AND chat.id::TEXT = (storage.foldername(p_path))[2]
      AND public.can_access_workspace(chat.workspace_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_assistant_image_path(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assistants AS assistant
    WHERE assistant.id::TEXT = (storage.foldername(p_path))[2]
      AND public.can_access_assistant(assistant.id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_workspace_image_path(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id::TEXT = (storage.foldername(p_path))[2]
      AND public.can_access_workspace(workspace.id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace_image_path(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id::TEXT = (storage.foldername(p_path))[2]
      AND public.can_manage_workspace(workspace.id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_assistant_image_path(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assistants AS assistant
    WHERE assistant.id::TEXT = (storage.foldername(p_path))[2]
      AND public.can_manage_assistant(assistant.id)
  );
$$;

CREATE OR REPLACE FUNCTION public.home_workspace_exists_for_current_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.user_id = auth.uid()
      AND workspace.is_home
  );
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_member_profiles(p_workspace_id UUID)
RETURNS TABLE (
  member_user_id UUID,
  display_name TEXT,
  username TEXT,
  image_url TEXT,
  role TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.can_access_workspace(p_workspace_id) THEN
    RAISE EXCEPTION 'Workspace access denied.';
  END IF;

  RETURN QUERY
    SELECT
      workspace.user_id,
      COALESCE(profile.display_name, 'Workspace owner'),
      profile.username,
      profile.image_url,
      'owner'::TEXT
    FROM public.workspaces AS workspace
    LEFT JOIN public.profiles AS profile
      ON profile.user_id = workspace.user_id
    WHERE workspace.id = p_workspace_id

    UNION ALL

    SELECT
      member.user_id,
      COALESCE(profile.display_name, 'Workspace member'),
      profile.username,
      profile.image_url,
      member.role
    FROM public.workspace_members AS member
    LEFT JOIN public.profiles AS profile
      ON profile.user_id = member.user_id
    WHERE member.workspace_id = p_workspace_id
    ORDER BY role, display_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_workspace_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Workspace ownership cannot be changed.';
  END IF;

  IF NEW.sharing IS DISTINCT FROM OLD.sharing
     AND OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the workspace owner can change workspace visibility.';
  END IF;

  IF OLD.is_home
     AND NEW.sharing IS DISTINCT FROM OLD.sharing
     AND NEW.sharing <> 'private' THEN
    RAISE EXCEPTION 'The home workspace must remain private.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_workspace_owner_change
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.prevent_workspace_owner_change();

CREATE OR REPLACE FUNCTION public.prevent_resource_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (to_jsonb(NEW) ->> 'user_id') IS DISTINCT FROM
     (to_jsonb(OLD) ->> 'user_id') THEN
    RAISE EXCEPTION 'Resource ownership cannot be changed.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_chat_owner_change
BEFORE UPDATE ON public.chats
FOR EACH ROW EXECUTE FUNCTION public.prevent_resource_owner_change();
CREATE TRIGGER prevent_folder_owner_change
BEFORE UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.prevent_resource_owner_change();
CREATE TRIGGER prevent_file_owner_change
BEFORE UPDATE ON public.files
FOR EACH ROW EXECUTE FUNCTION public.prevent_resource_owner_change();
CREATE TRIGGER prevent_collection_owner_change
BEFORE UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.prevent_resource_owner_change();
CREATE TRIGGER prevent_assistant_owner_change
BEFORE UPDATE ON public.assistants
FOR EACH ROW EXECUTE FUNCTION public.prevent_resource_owner_change();
CREATE TRIGGER prevent_prompt_owner_change
BEFORE UPDATE ON public.prompts
FOR EACH ROW EXECUTE FUNCTION public.prevent_resource_owner_change();
CREATE TRIGGER prevent_preset_owner_change
BEFORE UPDATE ON public.presets
FOR EACH ROW EXECUTE FUNCTION public.prevent_resource_owner_change();
CREATE TRIGGER prevent_tool_owner_change
BEFORE UPDATE ON public.tools
FOR EACH ROW EXECUTE FUNCTION public.prevent_resource_owner_change();
CREATE TRIGGER prevent_model_owner_change
BEFORE UPDATE ON public.models
FOR EACH ROW EXECUTE FUNCTION public.prevent_resource_owner_change();

CREATE OR REPLACE FUNCTION public.protect_viewer_chat_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.user_id = auth.uid()
     AND public.workspace_role(OLD.workspace_id) = 'viewer'
     AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM
         (to_jsonb(OLD) - 'updated_at') THEN
    RAISE EXCEPTION 'Viewers can continue their own chats but cannot edit chat settings.';
  END IF;

  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     AND (
       OLD.user_id <> auth.uid()
       OR NOT public.can_edit_workspace(OLD.workspace_id)
       OR NOT public.can_edit_workspace(NEW.workspace_id)
     ) THEN
    RAISE EXCEPTION 'Only chat owners with edit access in both workspaces can move a chat.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_viewer_chat_updates
BEFORE UPDATE ON public.chats
FOR EACH ROW
EXECUTE FUNCTION public.protect_viewer_chat_updates();

CREATE OR REPLACE FUNCTION public.create_workspace_invite(
  p_workspace_id UUID,
  p_role TEXT,
  p_token_hash TEXT
)
RETURNS public.workspace_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  invite public.workspace_invites;
  workspace_owner UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('admin', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid workspace role.';
  END IF;

  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid invitation token.';
  END IF;

  SELECT workspace.user_id
    INTO workspace_owner
    FROM public.workspaces AS workspace
    WHERE workspace.id = p_workspace_id
      AND workspace.sharing = 'shared';

  IF workspace_owner IS NULL OR NOT public.can_manage_workspace(p_workspace_id) THEN
    RAISE EXCEPTION 'Only workspace owners and admins can invite members.';
  END IF;

  IF p_role = 'admin' AND workspace_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Only the workspace owner can grant admin access.';
  END IF;

  INSERT INTO public.workspace_invites (
    workspace_id,
    token_hash,
    role,
    created_by,
    expires_at
  )
  VALUES (
    p_workspace_id,
    p_token_hash,
    p_role,
    auth.uid(),
    now() + interval '7 days'
  )
  RETURNING * INTO invite;

  RETURN invite;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token_hash TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  invite public.workspace_invites;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before accepting a workspace invitation.';
  END IF;

  SELECT *
    INTO invite
    FROM public.workspace_invites
    WHERE token_hash = p_token_hash
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > now()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invitation is invalid, expired, or already used.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id = invite.workspace_id
      AND workspace.sharing = 'shared'
  ) THEN
    RAISE EXCEPTION 'This workspace is no longer shared.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workspace_members AS member
    WHERE member.workspace_id = invite.workspace_id
      AND member.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id = invite.workspace_id
      AND workspace.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You already have access to this workspace.';
  END IF;

  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    invited_by
  )
  VALUES (
    invite.workspace_id,
    auth.uid(),
    invite.role,
    invite.created_by
  );

  UPDATE public.workspace_invites
    SET accepted_at = now(),
        accepted_by = auth.uid()
    WHERE id = invite.id;

  RETURN invite.workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_workspace_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.workspace_invites AS invite
    SET revoked_at = now()
    WHERE invite.id = p_invite_id
      AND invite.accepted_at IS NULL
      AND invite.revoked_at IS NULL
      AND public.can_manage_workspace(invite.workspace_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or access denied.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_workspace_member(
  p_workspace_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  workspace_owner UUID;
  target_role TEXT;
BEGIN
  SELECT workspace.user_id
    INTO workspace_owner
    FROM public.workspaces AS workspace
    WHERE workspace.id = p_workspace_id;

  SELECT member.role
    INTO target_role
    FROM public.workspace_members AS member
    WHERE member.workspace_id = p_workspace_id
      AND member.user_id = p_user_id;

  IF NOT public.can_manage_workspace(p_workspace_id) OR target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found or access denied.';
  END IF;

  IF target_role = 'admin' AND workspace_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Only the workspace owner can remove an admin.';
  END IF;

  DELETE FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_workspace_member_role(
  p_workspace_id UUID,
  p_user_id UUID,
  p_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  workspace_owner UUID;
  target_role TEXT;
BEGIN
  IF p_role IS NULL OR p_role NOT IN ('admin', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid workspace role.';
  END IF;

  SELECT workspace.user_id
    INTO workspace_owner
    FROM public.workspaces AS workspace
    WHERE workspace.id = p_workspace_id
      AND workspace.sharing = 'shared';

  SELECT member.role
    INTO target_role
    FROM public.workspace_members AS member
    WHERE member.workspace_id = p_workspace_id
      AND member.user_id = p_user_id;

  IF workspace_owner IS NULL
     OR target_role IS NULL
     OR NOT public.can_manage_workspace(p_workspace_id) THEN
    RAISE EXCEPTION 'Member not found or access denied.';
  END IF;

  IF workspace_owner <> auth.uid()
     AND (target_role = 'admin' OR p_role = 'admin') THEN
    RAISE EXCEPTION 'Only the workspace owner can grant or change admin access.';
  END IF;

  UPDATE public.workspace_members
    SET role = p_role
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_workspace(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace membership not found.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_workspace_members_when_private()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.sharing = 'shared' AND NEW.sharing <> 'shared' THEN
    DELETE FROM public.workspace_members
      WHERE workspace_id = NEW.id;

    UPDATE public.workspace_invites
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE workspace_id = NEW.id
        AND accepted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER revoke_workspace_members_when_private
AFTER UPDATE OF sharing ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.revoke_workspace_members_when_private();

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_user_preferences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.workspace_members,
  public.workspace_invites,
  public.workspace_user_preferences,
  public.chat_user_preferences
FROM anon, authenticated;
GRANT SELECT ON TABLE public.workspace_members TO authenticated;
GRANT SELECT ON TABLE public.workspace_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.workspace_user_preferences, public.chat_user_preferences
  TO authenticated;

REVOKE ALL ON FUNCTION public.workspace_role(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_workspace(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_workspace(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_edit_workspace(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_file(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_file(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_collection(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_collection(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_assistant(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_assistant(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_file_path(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_message_image_path(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_assistant_image_path(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_workspace_image_path(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_workspace_image_path(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_assistant_image_path(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.home_workspace_exists_for_current_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_workspace_member_profiles(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_workspace_invite(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_workspace_invite(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_workspace_invite(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_workspace_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_workspace_member_role(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_workspace(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_prompt(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_preset(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_tool(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_model(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.workspace_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_workspace(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_workspace(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_file(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_file(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_collection(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_collection(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_assistant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_assistant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_file_path(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_message_image_path(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_assistant_image_path(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_workspace_image_path(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace_image_path(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_assistant_image_path(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.home_workspace_exists_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_member_profiles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace_invite(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_workspace_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_workspace_member_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_workspace(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_prompt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_preset(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_tool(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_model(UUID) TO authenticated;

CREATE POLICY workspace_members_select
  ON public.workspace_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_workspace(workspace_id)
  );

CREATE POLICY workspace_invites_select
  ON public.workspace_invites FOR SELECT TO authenticated
  USING (public.can_manage_workspace(workspace_id));

CREATE POLICY workspace_preferences_manage_own
  ON public.workspace_user_preferences FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND public.can_access_workspace(workspace_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_workspace(workspace_id)
  );

CREATE POLICY chat_preferences_manage_own
  ON public.chat_user_preferences FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chats AS chat
      WHERE chat.id = chat_id
        AND public.can_access_workspace(chat.workspace_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chats AS chat
      WHERE chat.id = chat_id
        AND public.can_access_workspace(chat.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Allow full access to own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Allow view access to non-private workspaces" ON public.workspaces;

CREATE POLICY workspaces_select_accessible
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.can_access_workspace(id));

CREATE POLICY workspaces_insert_own
  ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      is_home = false
      OR NOT public.home_workspace_exists_for_current_user()
    )
  );

CREATE POLICY workspaces_update_managers
  ON public.workspaces FOR UPDATE TO authenticated
  USING (public.can_manage_workspace(id))
  WITH CHECK (public.can_manage_workspace(id));

CREATE POLICY workspaces_delete_owner
  ON public.workspaces FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND is_home = false);

DROP POLICY IF EXISTS "Allow full access to own folders" ON public.folders;

CREATE POLICY folders_select_workspace
  ON public.folders FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));

CREATE POLICY folders_insert_managers
  ON public.folders FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (type = 'chats' AND public.can_edit_workspace(workspace_id))
      OR (type <> 'chats' AND public.can_edit_workspace(workspace_id))
    )
  );

CREATE POLICY folders_update_managers
  ON public.folders FOR UPDATE TO authenticated
  USING (
    (type = 'chats' AND public.can_edit_workspace(workspace_id))
    OR (type <> 'chats' AND public.can_edit_workspace(workspace_id))
  )
  WITH CHECK (
    (type = 'chats' AND public.can_edit_workspace(workspace_id))
    OR (type <> 'chats' AND public.can_edit_workspace(workspace_id))
  );

CREATE POLICY folders_delete_managers
  ON public.folders FOR DELETE TO authenticated
  USING (
    (type = 'chats' AND public.can_edit_workspace(workspace_id))
    OR (type <> 'chats' AND public.can_manage_workspace(workspace_id))
  );

DROP POLICY IF EXISTS "Allow full access to own chats" ON public.chats;
DROP POLICY IF EXISTS "Allow view access to non-private chats" ON public.chats;

CREATE POLICY chats_select_workspace
  ON public.chats FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));

CREATE POLICY chats_insert_member
  ON public.chats FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_workspace(workspace_id)
  );

CREATE POLICY chats_update_own_or_admin
  ON public.chats FOR UPDATE TO authenticated
  USING (
    public.can_access_workspace(workspace_id)
    AND (
      user_id = auth.uid()
      OR public.can_edit_workspace(workspace_id)
    )
  )
  WITH CHECK (
    public.can_access_workspace(workspace_id)
    AND (
      user_id = auth.uid()
      OR public.can_edit_workspace(workspace_id)
    )
  );

CREATE POLICY chats_delete_own_or_admin
  ON public.chats FOR DELETE TO authenticated
  USING (
    public.can_access_workspace(workspace_id)
    AND (
      user_id = auth.uid()
      OR public.can_edit_workspace(workspace_id)
    )
  );

DROP POLICY IF EXISTS "Allow full access to own messages" ON public.messages;
DROP POLICY IF EXISTS "Allow view access to messages for non-private chats" ON public.messages;

CREATE POLICY messages_select_workspace
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chats AS chat
      WHERE chat.id = chat_id
        AND public.can_access_workspace(chat.workspace_id)
    )
  );

CREATE POLICY messages_insert_own_chat
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chats AS chat
      WHERE chat.id = chat_id
        AND public.can_access_workspace(chat.workspace_id)
        AND (
          chat.user_id = auth.uid()
          OR public.can_edit_workspace(chat.workspace_id)
        )
    )
  );

CREATE POLICY messages_update_editable_chat
  ON public.messages FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chats AS chat
      WHERE chat.id = chat_id
        AND public.can_access_workspace(chat.workspace_id)
        AND (
          chat.user_id = auth.uid()
          OR public.can_edit_workspace(chat.workspace_id)
        )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chats AS chat
      WHERE chat.id = chat_id
        AND public.can_access_workspace(chat.workspace_id)
        AND (
          chat.user_id = auth.uid()
          OR public.can_edit_workspace(chat.workspace_id)
        )
    )
  );

CREATE POLICY messages_delete_editable_chat
  ON public.messages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chats AS chat
      WHERE chat.id = chat_id
        AND public.can_access_workspace(chat.workspace_id)
        AND (
          chat.user_id = auth.uid()
          OR public.can_edit_workspace(chat.workspace_id)
        )
    )
  );

DROP POLICY IF EXISTS "Allow full access to own chat_files" ON public.chat_files;

CREATE POLICY chat_files_select_workspace
  ON public.chat_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chats AS chat
      WHERE chat.id = chat_id
        AND public.can_access_workspace(chat.workspace_id)
    )
  );

CREATE POLICY chat_files_insert_own_chat
  ON public.chat_files FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chats AS chat
      WHERE chat.id = chat_id
        AND chat.user_id = auth.uid()
        AND public.can_access_workspace(chat.workspace_id)
    )
    AND public.can_access_file(file_id)
  );

CREATE POLICY chat_files_delete_own_chat
  ON public.chat_files FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chats AS chat
      WHERE chat.id = chat_id
        AND chat.user_id = auth.uid()
        AND public.can_access_workspace(chat.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Allow full access to own message_file_items"
  ON public.message_file_items;

CREATE POLICY message_file_items_select_accessible
  ON public.message_file_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages AS message
      JOIN public.chats AS chat ON chat.id = message.chat_id
      WHERE message.id = message_id
        AND public.can_access_workspace(chat.workspace_id)
    )
  );

CREATE POLICY message_file_items_insert_own_chat
  ON public.message_file_items FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.messages AS message
      JOIN public.chats AS chat ON chat.id = message.chat_id
      WHERE message.id = message_id
        AND message.user_id = auth.uid()
        AND chat.user_id = auth.uid()
        AND public.can_access_workspace(chat.workspace_id)
    )
    AND EXISTS (
      SELECT 1
      FROM public.file_items AS item
      WHERE item.id = file_item_id
        AND public.can_access_file(item.file_id)
    )
  );

CREATE POLICY message_file_items_delete_own_chat
  ON public.message_file_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages AS message
      JOIN public.chats AS chat ON chat.id = message.chat_id
      WHERE message.id = message_id
        AND (
          chat.user_id = auth.uid()
          OR public.can_manage_workspace(chat.workspace_id)
        )
    )
  );

DROP POLICY IF EXISTS "Allow full access to own files" ON public.files;
DROP POLICY IF EXISTS "Allow view access to non-private files" ON public.files;
DROP POLICY IF EXISTS "Allow view access to files for non-private collections" ON public.files;

CREATE POLICY files_select_accessible
  ON public.files FOR SELECT TO authenticated
  USING (public.can_access_file(id));

CREATE POLICY files_insert_own
  ON public.files FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY files_update_owner_or_workspace_admin
  ON public.files FOR UPDATE TO authenticated
  USING (public.can_manage_file(id))
  WITH CHECK (public.can_manage_file(id));

CREATE POLICY files_delete_owner_or_workspace_admin
  ON public.files FOR DELETE TO authenticated
  USING (public.can_manage_file(id));

DROP POLICY IF EXISTS "Allow full access to own file items" ON public.file_items;
DROP POLICY IF EXISTS "Allow view access to non-private file items" ON public.file_items;

CREATE POLICY file_items_select_accessible
  ON public.file_items FOR SELECT TO authenticated
  USING (public.can_access_file(file_id));

CREATE POLICY file_items_insert_managers
  ON public.file_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_manage_file(file_id));

CREATE POLICY file_items_update_managers
  ON public.file_items FOR UPDATE TO authenticated
  USING (public.can_manage_file(file_id))
  WITH CHECK (public.can_manage_file(file_id));

CREATE POLICY file_items_delete_managers
  ON public.file_items FOR DELETE TO authenticated
  USING (public.can_manage_file(file_id));

DROP POLICY IF EXISTS "Allow full access to own file_workspaces" ON public.file_workspaces;

CREATE POLICY file_workspaces_select_accessible
  ON public.file_workspaces FOR SELECT TO authenticated
  USING (
    public.can_access_workspace(workspace_id)
    AND public.can_access_file(file_id)
  );

CREATE POLICY file_workspaces_insert_managers
  ON public.file_workspaces FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_edit_workspace(workspace_id)
    AND public.can_manage_file(file_id)
  );

CREATE POLICY file_workspaces_delete_managers
  ON public.file_workspaces FOR DELETE TO authenticated
  USING (
    public.can_edit_workspace(workspace_id)
    AND public.can_manage_file(file_id)
  );

DROP POLICY IF EXISTS "Allow public read access on non-private files"
  ON storage.objects;
CREATE POLICY shared_files_select_accessible
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.can_access_file_path(name)
    )
  );

DROP POLICY IF EXISTS "Allow public read access on non-private workspace images"
  ON storage.objects;
CREATE POLICY workspace_images_select_accessible
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'workspace_images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.can_access_workspace_image_path(name)
    )
  );
CREATE POLICY workspace_images_delete_managers
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'workspace_images'
    AND public.can_manage_workspace_image_path(name)
  );

DROP POLICY IF EXISTS "Allow public read access on non-private assistant images"
  ON storage.objects;
CREATE POLICY assistant_images_select_accessible
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'assistant_images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.can_access_assistant_image_path(name)
    )
  );
CREATE POLICY assistant_images_delete_managers
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'assistant_images'
    AND public.can_manage_assistant_image_path(name)
  );

DROP POLICY IF EXISTS "Allow read access to own message images"
  ON storage.objects;
CREATE POLICY message_images_select_accessible
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'message_images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.can_access_message_image_path(name)
    )
  );

DROP POLICY IF EXISTS "Allow full access to own collections" ON public.collections;
DROP POLICY IF EXISTS "Allow view access to non-private collections" ON public.collections;

CREATE POLICY collections_select_accessible
  ON public.collections FOR SELECT TO authenticated
  USING (public.can_access_collection(id));

CREATE POLICY collections_insert_own
  ON public.collections FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY collections_update_managers
  ON public.collections FOR UPDATE TO authenticated
  USING (public.can_manage_collection(id))
  WITH CHECK (public.can_manage_collection(id));

CREATE POLICY collections_delete_managers
  ON public.collections FOR DELETE TO authenticated
  USING (public.can_manage_collection(id));

DROP POLICY IF EXISTS "Allow full access to own collection_workspaces" ON public.collection_workspaces;

CREATE POLICY collection_workspaces_select_accessible
  ON public.collection_workspaces FOR SELECT TO authenticated
  USING (
    public.can_access_workspace(workspace_id)
    AND public.can_access_collection(collection_id)
  );

CREATE POLICY collection_workspaces_insert_managers
  ON public.collection_workspaces FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_edit_workspace(workspace_id)
    AND public.can_manage_collection(collection_id)
  );

CREATE POLICY collection_workspaces_delete_managers
  ON public.collection_workspaces FOR DELETE TO authenticated
  USING (
    public.can_edit_workspace(workspace_id)
    AND public.can_manage_collection(collection_id)
  );

DROP POLICY IF EXISTS "Allow full access to own collection_files" ON public.collection_files;
DROP POLICY IF EXISTS "Allow view access to collection files for non-private collections" ON public.collection_files;

CREATE POLICY collection_files_select_accessible
  ON public.collection_files FOR SELECT TO authenticated
  USING (public.can_access_collection(collection_id));

CREATE POLICY collection_files_insert_managers
  ON public.collection_files FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_manage_collection(collection_id)
    AND public.can_manage_file(file_id)
  );

CREATE POLICY collection_files_delete_managers
  ON public.collection_files FOR DELETE TO authenticated
  USING (
    public.can_manage_collection(collection_id)
    AND public.can_manage_file(file_id)
  );

DROP POLICY IF EXISTS "Allow full access to own assistants" ON public.assistants;
DROP POLICY IF EXISTS "Allow view access to non-private assistants" ON public.assistants;

CREATE POLICY assistants_select_accessible
  ON public.assistants FOR SELECT TO authenticated
  USING (public.can_access_assistant(id));

CREATE POLICY assistants_insert_own
  ON public.assistants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY assistants_update_managers
  ON public.assistants FOR UPDATE TO authenticated
  USING (public.can_manage_assistant(id))
  WITH CHECK (public.can_manage_assistant(id));

CREATE POLICY assistants_delete_managers
  ON public.assistants FOR DELETE TO authenticated
  USING (public.can_manage_assistant(id));

DROP POLICY IF EXISTS "Allow full access to own assistant_workspaces" ON public.assistant_workspaces;

CREATE POLICY assistant_workspaces_select_accessible
  ON public.assistant_workspaces FOR SELECT TO authenticated
  USING (
    public.can_access_workspace(workspace_id)
    AND public.can_access_assistant(assistant_id)
  );

CREATE POLICY assistant_workspaces_insert_managers
  ON public.assistant_workspaces FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_edit_workspace(workspace_id)
    AND public.can_manage_assistant(assistant_id)
  );

CREATE POLICY assistant_workspaces_delete_managers
  ON public.assistant_workspaces FOR DELETE TO authenticated
  USING (
    public.can_edit_workspace(workspace_id)
    AND public.can_manage_assistant(assistant_id)
  );

DROP POLICY IF EXISTS "Allow full access to own assistant_files" ON public.assistant_files;

CREATE POLICY assistant_files_select_accessible
  ON public.assistant_files FOR SELECT TO authenticated
  USING (
    public.can_access_assistant(assistant_id)
    AND public.can_access_file(file_id)
  );

CREATE POLICY assistant_files_insert_managers
  ON public.assistant_files FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_manage_assistant(assistant_id)
    AND public.can_manage_file(file_id)
  );

CREATE POLICY assistant_files_delete_managers
  ON public.assistant_files FOR DELETE TO authenticated
  USING (
    public.can_manage_assistant(assistant_id)
    AND public.can_manage_file(file_id)
  );

DROP POLICY IF EXISTS "Allow full access to own assistant_collections" ON public.assistant_collections;

CREATE POLICY assistant_collections_select_accessible
  ON public.assistant_collections FOR SELECT TO authenticated
  USING (
    public.can_access_assistant(assistant_id)
    AND public.can_access_collection(collection_id)
  );

CREATE POLICY assistant_collections_insert_managers
  ON public.assistant_collections FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_manage_assistant(assistant_id)
    AND public.can_manage_collection(collection_id)
  );

CREATE POLICY assistant_collections_delete_managers
  ON public.assistant_collections FOR DELETE TO authenticated
  USING (
    public.can_manage_assistant(assistant_id)
    AND public.can_manage_collection(collection_id)
  );

DROP POLICY IF EXISTS "Allow full access to own assistant_tools" ON public.assistant_tools;

CREATE POLICY assistant_tools_select_accessible
  ON public.assistant_tools FOR SELECT TO authenticated
  USING (
    public.can_access_assistant(assistant_id)
    AND EXISTS (
      SELECT 1
      FROM public.assistant_workspaces AS link
      WHERE link.assistant_id = assistant_tools.assistant_id
        AND public.can_access_workspace(link.workspace_id)
    )
    AND EXISTS (
      SELECT 1
      FROM public.tools AS tool
      WHERE tool.id = assistant_tools.tool_id
        AND (
          tool.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.tool_workspaces AS tool_link
            WHERE tool_link.tool_id = tool.id
              AND public.can_access_workspace(tool_link.workspace_id)
          )
        )
    )
  );

CREATE POLICY assistant_tools_manage_managers
  ON public.assistant_tools FOR ALL TO authenticated
  USING (public.can_manage_assistant(assistant_id))
  WITH CHECK (
    (user_id = auth.uid() OR public.can_manage_assistant(assistant_id))
    AND public.can_manage_assistant(assistant_id)
    AND public.can_manage_tool(tool_id)
  );

DROP POLICY IF EXISTS "Allow full access to own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Allow view access to non-private prompts" ON public.prompts;
DROP POLICY IF EXISTS "Allow full access to own prompt_workspaces" ON public.prompt_workspaces;

CREATE POLICY prompts_select_accessible
  ON public.prompts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.prompt_workspaces AS link
      WHERE link.prompt_id = prompts.id
        AND public.can_access_workspace(link.workspace_id)
    )
  );
CREATE POLICY prompts_insert_own
  ON public.prompts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY prompts_update_own_or_admin
  ON public.prompts FOR UPDATE TO authenticated
  USING (public.can_manage_prompt(id))
  WITH CHECK (public.can_manage_prompt(id));
CREATE POLICY prompts_delete_own_or_admin
  ON public.prompts FOR DELETE TO authenticated
  USING (public.can_manage_prompt(id));

CREATE POLICY prompt_workspaces_select_accessible
  ON public.prompt_workspaces FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));
CREATE POLICY prompt_workspaces_insert_managers
  ON public.prompt_workspaces FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_edit_workspace(workspace_id)
    AND public.can_manage_prompt(prompt_id)
  );
CREATE POLICY prompt_workspaces_delete_managers
  ON public.prompt_workspaces FOR DELETE TO authenticated
  USING (
    public.can_edit_workspace(workspace_id)
    AND public.can_manage_prompt(prompt_id)
  );

DROP POLICY IF EXISTS "Allow full access to own presets" ON public.presets;
DROP POLICY IF EXISTS "Allow view access to non-private presets" ON public.presets;
DROP POLICY IF EXISTS "Allow full access to own preset_workspaces" ON public.preset_workspaces;

CREATE POLICY presets_select_accessible
  ON public.presets FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.preset_workspaces AS link
      WHERE link.preset_id = presets.id
        AND public.can_access_workspace(link.workspace_id)
    )
  );
CREATE POLICY presets_insert_own
  ON public.presets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY presets_update_own_or_admin
  ON public.presets FOR UPDATE TO authenticated
  USING (public.can_manage_preset(id))
  WITH CHECK (public.can_manage_preset(id));
CREATE POLICY presets_delete_own_or_admin
  ON public.presets FOR DELETE TO authenticated
  USING (public.can_manage_preset(id));
CREATE POLICY preset_workspaces_select_accessible
  ON public.preset_workspaces FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));
CREATE POLICY preset_workspaces_insert_managers
  ON public.preset_workspaces FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_edit_workspace(workspace_id)
    AND public.can_manage_preset(preset_id)
  );
CREATE POLICY preset_workspaces_delete_managers
  ON public.preset_workspaces FOR DELETE TO authenticated
  USING (
    public.can_edit_workspace(workspace_id)
    AND public.can_manage_preset(preset_id)
  );

DROP POLICY IF EXISTS "Allow full access to own tools" ON public.tools;
DROP POLICY IF EXISTS "Allow view access to non-private tools" ON public.tools;
DROP POLICY IF EXISTS "Allow full access to own tool_workspaces" ON public.tool_workspaces;

CREATE POLICY tools_select_accessible
  ON public.tools FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tool_workspaces AS link
      WHERE link.tool_id = tools.id
        AND public.can_access_workspace(link.workspace_id)
    )
  );
CREATE POLICY tools_insert_own
  ON public.tools FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY tools_update_own_or_admin
  ON public.tools FOR UPDATE TO authenticated
  USING (public.can_manage_tool(id))
  WITH CHECK (public.can_manage_tool(id));
CREATE POLICY tools_delete_own_or_admin
  ON public.tools FOR DELETE TO authenticated
  USING (public.can_manage_tool(id));
CREATE POLICY tool_workspaces_select_accessible
  ON public.tool_workspaces FOR SELECT TO authenticated
  USING (public.can_access_workspace(workspace_id));
CREATE POLICY tool_workspaces_insert_managers
  ON public.tool_workspaces FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_edit_workspace(workspace_id)
    AND public.can_manage_tool(tool_id)
  );
CREATE POLICY tool_workspaces_delete_managers
  ON public.tool_workspaces FOR DELETE TO authenticated
  USING (
    public.can_edit_workspace(workspace_id)
    AND public.can_manage_tool(tool_id)
  );

DROP POLICY IF EXISTS "Allow full access to own models" ON public.models;
DROP POLICY IF EXISTS "Allow view access to non-private models" ON public.models;
DROP POLICY IF EXISTS "Allow full access to own model_workspaces" ON public.model_workspaces;

CREATE POLICY models_select_accessible
  ON public.models FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY models_insert_own
  ON public.models FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY models_update_own_or_admin
  ON public.models FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY models_delete_own_or_admin
  ON public.models FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY model_workspaces_select_accessible
  ON public.model_workspaces FOR SELECT TO authenticated
  USING (
    public.can_access_workspace(workspace_id)
    AND EXISTS (
      SELECT 1
      FROM public.models AS model
      WHERE model.id = model_workspaces.model_id
        AND model.user_id = auth.uid()
    )
  );
CREATE POLICY model_workspaces_insert_managers
  ON public.model_workspaces FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_manage_workspace(workspace_id)
    AND EXISTS (
      SELECT 1
      FROM public.models AS model
      WHERE model.id = model_workspaces.model_id
        AND model.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.workspaces AS workspace
      WHERE workspace.id = model_workspaces.workspace_id
        AND workspace.user_id = auth.uid()
        AND workspace.sharing <> 'shared'
    )
  );
CREATE POLICY model_workspaces_delete_managers
  ON public.model_workspaces FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.models AS model
      WHERE model.id = model_workspaces.model_id
        AND model.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.workspaces AS workspace
      WHERE workspace.id = model_workspaces.workspace_id
        AND workspace.user_id = auth.uid()
        AND workspace.sharing <> 'shared'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication
      WHERE pubname = 'supabase_realtime'
    ) THEN
      RAISE EXCEPTION 'Supabase Realtime publication is unavailable';
    END IF;

    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
END;
$$;
