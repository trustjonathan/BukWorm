"use client"

import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { ChatbotUIContext } from "@/context/context"
import { createWorkspace } from "@/db/workspaces"
import { saveWorkspacePreference } from "@/db/workspace-collaboration"
import useHotkey from "@/lib/hooks/use-hotkey"
import { Tables } from "@/supabase/types"
import {
  IconArchive,
  IconBuilding,
  IconChevronDown,
  IconHome,
  IconPlus,
  IconStar
} from "@tabler/icons-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Input } from "../ui/input"

interface WorkspaceSwitcherProps {
  onNavigate?: () => void
}

export const WorkspaceSwitcher: FC<WorkspaceSwitcherProps> = ({
  onNavigate
}) => {
  useHotkey(";", () => setOpen(prevState => !prevState))

  const {
    profile,
    workspaces,
    workspacePreferences,
    setWorkspacePreferences,
    setWorkspaceRoles,
    workspaceImages,
    selectedWorkspace,
    setSelectedWorkspace,
    setWorkspaces,
    setIsTemporaryChat
  } = useContext(ChatbotUIContext)

  const { handleNewChat } = useChatHandler()

  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [search, setSearch] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [sharing, setSharing] = useState<"private" | "shared">("private")
  const [isCreating, setIsCreating] = useState(false)
  const [showArchivedWorkspaces, setShowArchivedWorkspaces] = useState(false)

  useEffect(() => {
    if (!selectedWorkspace) return

    setValue(selectedWorkspace.id)
  }, [selectedWorkspace])

  const handleCreateWorkspace = async () => {
    if (!selectedWorkspace || !profile) return

    const createdWorkspace = await createWorkspace({
      user_id: profile.user_id,
      default_context_length: selectedWorkspace.default_context_length,
      default_model: profile.default_model || selectedWorkspace.default_model,
      default_prompt: selectedWorkspace.default_prompt,
      default_temperature: selectedWorkspace.default_temperature,
      description: "",
      embeddings_provider: "local",
      include_profile_context: selectedWorkspace.include_profile_context,
      include_workspace_instructions:
        selectedWorkspace.include_workspace_instructions,
      instructions: selectedWorkspace.instructions,
      is_home: false,
      name: "New Workspace",
      sharing
    })

    setWorkspaces([...workspaces, createdWorkspace])
    setWorkspaceRoles(current => ({
      ...current,
      [createdWorkspace.id]: "owner"
    }))
    setIsTemporaryChat(false)
    setSelectedWorkspace(createdWorkspace)
    setOpen(false)
    setCreateDialogOpen(false)
    onNavigate?.()

    return router.push(`/${createdWorkspace.id}/chat`)
  }

  const getWorkspaceName = (workspaceId: string) => {
    const workspace = workspaces.find(workspace => workspace.id === workspaceId)

    if (!workspace) return

    return workspace.name
  }

  const handleSelect = (workspaceId: string) => {
    const workspace = workspaces.find(workspace => workspace.id === workspaceId)

    if (!workspace) return

    setIsTemporaryChat(false)
    setSelectedWorkspace(workspace)
    setOpen(false)
    onNavigate?.()

    return router.push(`/${workspace.id}/chat`)
  }

  const handleWorkspacePreference = async (
    workspace: Tables<"workspaces">,
    update: { is_starred?: boolean; archived_at?: string | null }
  ) => {
    if (!profile) return

    const current = workspacePreferences.find(
      preference => preference.workspace_id === workspace.id
    )
    try {
      const updated = await saveWorkspacePreference({
        workspace_id: workspace.id,
        user_id: profile.user_id,
        is_starred: update.is_starred ?? current?.is_starred ?? false,
        archived_at:
          update.archived_at !== undefined
            ? update.archived_at
            : current?.archived_at ?? null,
        updated_at: new Date().toISOString()
      })
      setWorkspacePreferences(preferences => [
        updated,
        ...preferences.filter(item => item.workspace_id !== workspace.id)
      ])

      if (update.archived_at && selectedWorkspace?.id === workspace.id) {
        const homeWorkspace = workspaces.find(
          item => item.is_home && item.user_id === profile.user_id
        )
        if (homeWorkspace) {
          setIsTemporaryChat(false)
          setSelectedWorkspace(homeWorkspace)
          router.push(`/${homeWorkspace.id}/chat`)
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update workspace preferences."
      )
    }
  }

  const visibleWorkspaces = workspaces
    .filter(workspace => {
      const archived = Boolean(
        workspacePreferences.find(
          preference => preference.workspace_id === workspace.id
        )?.archived_at
      )
      return archived === showArchivedWorkspaces
    })
    .filter(workspace =>
      workspace.name.toLowerCase().includes(search.toLowerCase())
    )
  const sortByStarred = (
    first: Tables<"workspaces">,
    second: Tables<"workspaces">
  ) => {
    const firstStarred = workspacePreferences.some(
      preference =>
        preference.workspace_id === first.id && preference.is_starred
    )
    const secondStarred = workspacePreferences.some(
      preference =>
        preference.workspace_id === second.id && preference.is_starred
    )
    return (
      Number(secondStarred) - Number(firstStarred) ||
      first.name.localeCompare(second.name)
    )
  }

  const renderWorkspace = (
    workspace: Tables<"workspaces">,
    isHome: boolean
  ) => {
    const image = workspaceImages.find(
      item => item.workspaceId === workspace.id
    )
    const isStarred = workspacePreferences.some(
      preference =>
        preference.workspace_id === workspace.id && preference.is_starred
    )
    const isArchived = workspacePreferences.some(
      preference =>
        preference.workspace_id === workspace.id && preference.archived_at
    )
    const WorkspaceIcon = isHome ? IconHome : IconBuilding

    return (
      <div key={workspace.id} className="flex min-w-0 items-center gap-1">
        <Button
          className="flex min-w-0 flex-1 items-center justify-start"
          variant="ghost"
          onClick={() => handleSelect(workspace.id)}
        >
          {image ? (
            <Image
              className="mr-3 size-7 shrink-0 rounded object-cover"
              src={image.url || ""}
              width={28}
              height={28}
              alt={workspace.name}
            />
          ) : (
            <WorkspaceIcon className="mr-3 size-7 shrink-0" />
          )}
          <span className="truncate text-left text-sm font-semibold">
            {workspace.name}
          </span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label={
            isStarred ? `Unstar ${workspace.name}` : `Star ${workspace.name}`
          }
          title={isStarred ? "Unstar workspace" : "Star workspace"}
          onClick={() =>
            void handleWorkspacePreference(workspace, {
              is_starred: !isStarred
            })
          }
        >
          <IconStar size={16} fill={isStarred ? "currentColor" : "none"} />
        </Button>

        {!isHome && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label={
              isArchived
                ? `Restore ${workspace.name} from archive`
                : `Archive ${workspace.name}`
            }
            title={isArchived ? "Restore workspace" : "Archive workspace"}
            onClick={() =>
              void handleWorkspacePreference(workspace, {
                archived_at: isArchived ? null : new Date().toISOString()
              })
            }
          >
            <IconArchive size={16} />
          </Button>
        )}
      </div>
    )
  }

  const IconComponent = selectedWorkspace?.is_home ? IconHome : IconBuilding

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          data-sidebar-workspace-trigger
          className="hover:bg-accent focus-visible:ring-ring flex h-11 w-full cursor-pointer items-center justify-between rounded-lg px-3 text-left text-[15px] outline-none focus-visible:ring-2"
        >
          <div className="flex items-center truncate">
            {selectedWorkspace && (
              <IconComponent className="mr-3 shrink-0" size={19} />
            )}
            <span className="truncate">
              {getWorkspaceName(value) || "Select workspace..."}
            </span>
          </div>

          <IconChevronDown
            className="text-muted-foreground ml-2 shrink-0"
            size={16}
          />
        </PopoverTrigger>

        <PopoverContent className="p-2">
          <div className="space-y-2">
            <Button
              className="flex w-full items-center space-x-2"
              size="sm"
              onClick={() => {
                setOpen(false)
                setSharing("private")
                setCreateDialogOpen(true)
              }}
            >
              <IconPlus />
              <div className="ml-2">New Workspace</div>
            </Button>

            <Input
              placeholder="Search workspaces..."
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Button
              type="button"
              className="w-full justify-start"
              variant="ghost"
              size="sm"
              onClick={() => setShowArchivedWorkspaces(value => !value)}
            >
              <IconArchive className="mr-2" size={16} />
              {showArchivedWorkspaces
                ? "Show active workspaces"
                : "Archived workspaces"}
            </Button>

            <div className="flex flex-col space-y-1">
              {visibleWorkspaces
                .filter(workspace => workspace.is_home)
                .sort(sortByStarred)
                .map(workspace => renderWorkspace(workspace, true))}

              {visibleWorkspaces
                .filter(workspace => !workspace.is_home)
                .sort(sortByStarred)
                .map(workspace => renderWorkspace(workspace, false))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>
              Share a workspace with collaborators using a single-use invite
              link from Workspace Settings.
            </DialogDescription>
          </DialogHeader>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Workspace visibility
            <select
              className="border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 focus-visible:outline-none focus-visible:ring-2"
              value={sharing}
              onChange={event =>
                setSharing(event.target.value as "private" | "shared")
              }
            >
              <option value="private">Private</option>
              <option value="shared">Shared</option>
            </select>
          </label>

          <DialogFooter>
            <Button
              variant="ghost"
              disabled={isCreating}
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={isCreating}
              onClick={async () => {
                setIsCreating(true)
                try {
                  await handleCreateWorkspace()
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Failed to create workspace."
                  )
                } finally {
                  setIsCreating(false)
                }
              }}
            >
              Create workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
