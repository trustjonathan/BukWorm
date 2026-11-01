import { supabase } from "@/lib/supabase/browser-client"
import { Tables } from "@/supabase/types"

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer"
export type AssignableWorkspaceRole = Exclude<WorkspaceRole, "owner">

export type WorkspaceMemberProfile = {
  member_user_id: string
  display_name: string
  username: string | null
  image_url: string | null
  role: WorkspaceRole
}

export type WorkspaceInviteSummary = Pick<
  Tables<"workspace_invites">,
  "id" | "role" | "created_at" | "expires_at"
>

const parseWorkspaceRole = (role: string): WorkspaceRole => {
  switch (role) {
    case "owner":
    case "admin":
    case "editor":
    case "viewer":
      return role
    default:
      throw new Error("The workspace returned an invalid access role.")
  }
}

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  )

  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export const getWorkspaceMemberProfiles = async (workspaceId: string) => {
  const { data, error } = await supabase.rpc("get_workspace_member_profiles", {
    p_workspace_id: workspaceId
  })

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error("No workspace member profiles were returned.")
  }

  return data.map(member => ({
    ...member,
    role: parseWorkspaceRole(member.role)
  }))
}

export const getWorkspaceRole = async (workspaceId: string) => {
  const { data, error } = await supabase.rpc("workspace_role", {
    p_workspace_id: workspaceId
  })

  if (error) {
    throw new Error(error.message)
  }

  return data === null ? null : parseWorkspaceRole(data)
}

export const getWorkspaceRoles = async (
  workspaces: Tables<"workspaces">[],
  userId: string
) => {
  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)

  if (error) {
    throw new Error(error.message)
  }

  const roles: Record<string, WorkspaceRole> = {}
  for (const workspace of workspaces) {
    if (workspace.user_id === userId) {
      roles[workspace.id] = "owner"
    }
  }

  for (const membership of memberships) {
    roles[membership.workspace_id] = parseWorkspaceRole(membership.role)
  }

  return roles
}

export const getWorkspaceInvites = async (workspaceId: string) => {
  const { data, error } = await supabase
    .from("workspace_invites")
    .select("id, role, created_at, expires_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export const createWorkspaceInvite = async (
  workspaceId: string,
  role: AssignableWorkspaceRole
) => {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("")
  const tokenHash = await hashToken(token)
  const { data, error } = await supabase.rpc("create_workspace_invite", {
    p_workspace_id: workspaceId,
    p_role: role,
    p_token_hash: tokenHash
  })

  if (error) {
    throw new Error(error.message)
  }

  return { invite: data, token }
}

export const acceptWorkspaceInvite = async (token: string) => {
  const { data, error } = await supabase.rpc("accept_workspace_invite", {
    p_token_hash: await hashToken(token)
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export const revokeWorkspaceInvite = async (inviteId: string) => {
  const { error } = await supabase.rpc("revoke_workspace_invite", {
    p_invite_id: inviteId
  })

  if (error) {
    throw new Error(error.message)
  }
}

export const removeWorkspaceMember = async (
  workspaceId: string,
  userId: string
) => {
  const { error } = await supabase.rpc("remove_workspace_member", {
    p_workspace_id: workspaceId,
    p_user_id: userId
  })

  if (error) {
    throw new Error(error.message)
  }
}

export const setWorkspaceMemberRole = async (
  workspaceId: string,
  userId: string,
  role: AssignableWorkspaceRole
) => {
  const { error } = await supabase.rpc("set_workspace_member_role", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_role: role
  })

  if (error) {
    throw new Error(error.message)
  }
}

export const leaveWorkspace = async (workspaceId: string) => {
  const { error } = await supabase.rpc("leave_workspace", {
    p_workspace_id: workspaceId
  })

  if (error) {
    throw new Error(error.message)
  }
}

export const getChatPreferencesByUserId = async (userId: string) => {
  const { data, error } = await supabase
    .from("chat_user_preferences")
    .select("*")
    .eq("user_id", userId)

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export const getWorkspacePreferencesByUserId = async (userId: string) => {
  const { data, error } = await supabase
    .from("workspace_user_preferences")
    .select("*")
    .eq("user_id", userId)

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export const saveChatPreference = async (
  preference: Tables<"chat_user_preferences">
) => {
  const { data, error } = await supabase
    .from("chat_user_preferences")
    .upsert(
      { ...preference, updated_at: new Date().toISOString() },
      { onConflict: "chat_id,user_id" }
    )
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export const saveWorkspacePreference = async (
  preference: Tables<"workspace_user_preferences">
) => {
  const { data, error } = await supabase
    .from("workspace_user_preferences")
    .upsert(
      { ...preference, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,user_id" }
    )
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}
