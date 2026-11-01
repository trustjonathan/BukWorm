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
      members.member_user_id,
      members.display_name,
      members.username,
      members.image_url,
      members.role
    FROM (
      SELECT
        workspace.user_id AS member_user_id,
        COALESCE(profile.display_name, 'Workspace owner') AS display_name,
        profile.username AS username,
        profile.image_url AS image_url,
        'owner'::TEXT AS role
      FROM public.workspaces AS workspace
      LEFT JOIN public.profiles AS profile
        ON profile.user_id = workspace.user_id
      WHERE workspace.id = p_workspace_id

      UNION ALL

      SELECT
        member.user_id AS member_user_id,
        COALESCE(profile.display_name, 'Workspace member') AS display_name,
        profile.username AS username,
        profile.image_url AS image_url,
        member.role AS role
      FROM public.workspace_members AS member
      LEFT JOIN public.profiles AS profile
        ON profile.user_id = member.user_id
      WHERE member.workspace_id = p_workspace_id
    ) AS members
    ORDER BY members.role, members.display_name;
END;
$$;
