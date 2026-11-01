"use client"

import {
  AssignableWorkspaceRole,
  createWorkspaceInvite,
  getWorkspaceInvites,
  getWorkspaceMemberProfiles,
  leaveWorkspace,
  removeWorkspaceMember,
  revokeWorkspaceInvite,
  setWorkspaceMemberRole,
  WorkspaceInviteSummary,
  WorkspaceMemberProfile,
  WorkspaceRole
} from "@/db/workspace-collaboration"
import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { formatDistanceToNow } from "date-fns"
import { usePathname, useRouter } from "next/navigation"
import { FC, useContext, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"

interface WorkspaceCollaborationSettingsProps {
  workspace: Tables<"workspaces">
}

const roleOptions: AssignableWorkspaceRole[] = ["admin", "editor", "viewer"]

const roleLabel = (role: WorkspaceRole) =>
  role.charAt(0).toUpperCase() + role.slice(1)

export const WorkspaceCollaborationSettings: FC<
  WorkspaceCollaborationSettingsProps
> = ({ workspace }) => {
  const {
    profile,
    workspaces,
    setWorkspaces,
    setWorkspaceRoles,
    setSelectedWorkspace
  } = useContext(ChatbotUIContext)
  const pathname = usePathname()
  const router = useRouter()
  const locale = pathname.split("/").filter(Boolean)[0] || "en"
  const isOwner = profile?.user_id === workspace.user_id

  const [members, setMembers] = useState<WorkspaceMemberProfile[]>([])
  const [invites, setInvites] = useState<WorkspaceInviteSummary[]>([])
  const [inviteRole, setInviteRole] =
    useState<AssignableWorkspaceRole>("viewer")
  const [inviteLink, setInviteLink] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const currentRole = useMemo(
    () =>
      isOwner
        ? "owner"
        : members.find(member => member.member_user_id === profile?.user_id)
            ?.role,
    [isOwner, members, profile?.user_id]
  )
  const canManage = currentRole === "owner" || currentRole === "admin"

  const refresh = async () => {
    if (!profile || workspace.sharing !== "shared") {
      setMembers([])
      setInvites([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const loadedMembers = await getWorkspaceMemberProfiles(workspace.id)
      setMembers(loadedMembers)

      const role = isOwner
        ? "owner"
        : loadedMembers.find(
            member => member.member_user_id === profile.user_id
          )?.role
      if (role === "owner" || role === "admin") {
        setInvites(await getWorkspaceInvites(workspace.id))
      } else {
        setInvites([])
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not load workspace access."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [workspace.id, workspace.sharing, profile?.user_id])

  const handleCreateInvite = async () => {
    setBusy(true)
    try {
      const { token } = await createWorkspaceInvite(workspace.id, inviteRole)
      setInviteLink(
        `${window.location.origin}/${locale}/invite/${encodeURIComponent(token)}`
      )
      await refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create invite."
      )
    } finally {
      setBusy(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      toast.success("Invitation link copied.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Could not copy invitation link: ${error.message}`
          : "Could not copy invitation link."
      )
    }
  }

  const handleRoleChange = async (
    userId: string,
    role: AssignableWorkspaceRole
  ) => {
    setBusy(true)
    try {
      await setWorkspaceMemberRole(workspace.id, userId, role)
      await refresh()
      toast.success("Member role updated.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update member role."
      )
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveMember = async (member: WorkspaceMemberProfile) => {
    if (
      !window.confirm(
        `Remove ${member.display_name} from this workspace? Their own workspace and chats will not be deleted.`
      )
    ) {
      return
    }

    setBusy(true)
    try {
      await removeWorkspaceMember(workspace.id, member.member_user_id)
      await refresh()
      toast.success("Member removed.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not remove workspace member."
      )
    } finally {
      setBusy(false)
    }
  }

  const handleLeaveWorkspace = async () => {
    if (!profile) return
    if (!window.confirm("Leave this workspace? Your chats will remain here.")) {
      return
    }

    const homeWorkspace = workspaces.find(
      item => item.is_home && item.user_id === profile.user_id
    )
    if (!homeWorkspace) {
      toast.error("Your home workspace could not be found.")
      return
    }

    setBusy(true)
    try {
      await leaveWorkspace(workspace.id)
      setWorkspaces(current => current.filter(item => item.id !== workspace.id))
      setWorkspaceRoles(current => {
        const next = { ...current }
        delete next[workspace.id]
        return next
      })
      setSelectedWorkspace(homeWorkspace)
      router.push(`/${homeWorkspace.id}/chat`)
      toast.success("You left the workspace.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not leave workspace."
      )
    } finally {
      setBusy(false)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    setBusy(true)
    try {
      await revokeWorkspaceInvite(inviteId)
      await refresh()
      toast.success("Invitation revoked.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not revoke invitation."
      )
    } finally {
      setBusy(false)
    }
  }

  if (workspace.sharing !== "shared") {
    return (
      <div className="text-muted-foreground rounded-md border p-4 text-sm">
        Enable shared visibility and save this workspace to invite
        collaborators.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Members</h3>
          <p className="text-muted-foreground text-xs">
            Owners and admins manage access. Editors can collaborate; viewers
            can read and continue their own chats.
          </p>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading access…</p>
        ) : members.length === 0 ? (
          <p className="text-muted-foreground text-sm">No members yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {members.map(member => {
              const isCurrentUser = member.member_user_id === profile?.user_id
              const canChangeMember =
                canManage &&
                member.role !== "owner" &&
                (isOwner || member.role !== "admin")

              return (
                <li
                  key={member.member_user_id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {member.display_name}
                      {isCurrentUser && " (you)"}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {member.username
                        ? `@${member.username}`
                        : member.member_user_id}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canChangeMember ? (
                      <select
                        aria-label={`Role for ${member.display_name}`}
                        className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                        disabled={busy}
                        value={member.role}
                        onChange={event =>
                          void handleRoleChange(
                            member.member_user_id,
                            event.target.value as AssignableWorkspaceRole
                          )
                        }
                      >
                        {roleOptions
                          .filter(role => isOwner || role !== "admin")
                          .map(role => (
                            <option key={role} value={role}>
                              {roleLabel(role)}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {roleLabel(member.role)}
                      </span>
                    )}

                    {canManage &&
                      member.role !== "owner" &&
                      (isOwner || member.role !== "admin") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleRemoveMember(member)}
                        >
                          Remove
                        </Button>
                      )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {currentRole && currentRole !== "owner" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void handleLeaveWorkspace()}
        >
          Leave workspace
        </Button>
      )}

      {canManage && (
        <>
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Invite with a link</h3>
              <p className="text-muted-foreground text-xs">
                Links are single-use and expire after seven days.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Invitation role"
                className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                value={inviteRole}
                onChange={event =>
                  setInviteRole(event.target.value as AssignableWorkspaceRole)
                }
              >
                {roleOptions
                  .filter(role => isOwner || role !== "admin")
                  .map(role => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
              </select>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void handleCreateInvite()}
              >
                Create invitation
              </Button>
            </div>

            {inviteLink && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label="Invitation link"
                  className="border-input bg-muted min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
                  readOnly
                  value={inviteLink}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleCopyLink()}
                >
                  Copy link
                </Button>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Pending invitations</h3>
            {invites.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No pending invitations.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {invites.map(invite => (
                  <li
                    key={invite.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {roleLabel(invite.role as WorkspaceRole)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Expires{" "}
                        {formatDistanceToNow(new Date(invite.expires_at), {
                          addSuffix: true
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleRevokeInvite(invite.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
