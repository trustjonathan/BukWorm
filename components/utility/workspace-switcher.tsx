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
import useHotkey from "@/lib/hooks/use-hotkey"
import { IconBuilding, IconHome, IconPlus } from "@tabler/icons-react"
import { IconSelector } from "@tabler/icons-react"
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
    workspaces,
    workspaceImages,
    selectedWorkspace,
    setSelectedWorkspace,
    setWorkspaces
  } = useContext(ChatbotUIContext)

  const { handleNewChat } = useChatHandler()

  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [search, setSearch] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [sharing, setSharing] = useState<"private" | "shared">("private")
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (!selectedWorkspace) return

    setValue(selectedWorkspace.id)
  }, [selectedWorkspace])

  const handleCreateWorkspace = async () => {
    if (!selectedWorkspace) return

    const createdWorkspace = await createWorkspace({
      user_id: selectedWorkspace.user_id,
      default_context_length: selectedWorkspace.default_context_length,
      default_model: selectedWorkspace.default_model,
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

    setSelectedWorkspace(workspace)
    setOpen(false)
    onNavigate?.()

    return router.push(`/${workspace.id}/chat`)
  }

  const workspaceImage = workspaceImages.find(
    image => image.workspaceId === selectedWorkspace?.id
  )
  const imageSrc = workspaceImage
    ? workspaceImage.url
    : selectedWorkspace?.is_home
      ? ""
      : ""

  const IconComponent = selectedWorkspace?.is_home ? IconHome : IconBuilding

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="border-input flex h-[36px]
        w-full cursor-pointer items-center justify-between rounded-md border px-2 py-1 hover:opacity-50"
        >
          <div className="flex items-center truncate">
            {selectedWorkspace && (
              <div className="flex items-center">
                {workspaceImage ? (
                  <Image
                    style={{ width: "22px", height: "22px" }}
                    className="mr-2 rounded"
                    src={imageSrc}
                    width={22}
                    height={22}
                    alt={selectedWorkspace.name}
                  />
                ) : (
                  <IconComponent className="mb-0.5 mr-2" size={22} />
                )}
              </div>
            )}

            {getWorkspaceName(value) || "Select workspace..."}
          </div>

          <IconSelector className="ml-2 shrink-0 opacity-50" />
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

            <div className="flex flex-col space-y-1">
              {workspaces
                .filter(workspace => workspace.is_home)
                .filter(workspace =>
                  workspace.name.toLowerCase().includes(search.toLowerCase())
                )
                .map(workspace => {
                  const image = workspaceImages.find(
                    image => image.workspaceId === workspace.id
                  )

                  return (
                    <Button
                      key={workspace.id}
                      className="flex items-center justify-start"
                      variant="ghost"
                      onClick={() => handleSelect(workspace.id)}
                    >
                      {image ? (
                        <Image
                          style={{ width: "28px", height: "28px" }}
                          className="mr-3 rounded"
                          src={image.url || ""}
                          width={28}
                          height={28}
                          alt={workspace.name}
                        />
                      ) : (
                        <IconHome className="mr-3" size={28} />
                      )}

                      <div className="text-lg font-semibold">
                        {workspace.name}
                      </div>
                    </Button>
                  )
                })}

              {workspaces
                .filter(
                  workspace =>
                    !workspace.is_home &&
                    workspace.name.toLowerCase().includes(search.toLowerCase())
                )
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(workspace => {
                  const image = workspaceImages.find(
                    image => image.workspaceId === workspace.id
                  )

                  return (
                    <Button
                      key={workspace.id}
                      className="flex items-center justify-start"
                      variant="ghost"
                      onClick={() => handleSelect(workspace.id)}
                    >
                      {image ? (
                        <Image
                          style={{ width: "28px", height: "28px" }}
                          className="mr-3 rounded"
                          src={image.url || ""}
                          width={28}
                          height={28}
                          alt={workspace.name}
                        />
                      ) : (
                        <IconBuilding className="mr-3" size={28} />
                      )}

                      <div className="text-lg font-semibold">
                        {workspace.name}
                      </div>
                    </Button>
                  )
                })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>
              Private workspaces are available now. Shared workspaces will be
              enabled when member access controls and invitations are ready.
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
              <option value="shared" disabled>
                Shared — coming soon
              </option>
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
