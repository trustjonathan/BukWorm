import { ChatbotUIContext } from "@/context/context"
import { WORKSPACE_INSTRUCTIONS_MAX } from "@/db/limits"
import {
  deleteWorkspaceImage,
  getWorkspaceImageFromStorage,
  uploadWorkspaceImage
} from "@/db/storage/workspace-images"
import { updateWorkspace } from "@/db/workspaces"
import { getWorkspaceRole, WorkspaceRole } from "@/db/workspace-collaboration"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import { ChatSettings, LLMID } from "@/types"
import { Tables } from "@/supabase/types"
import { DEFAULT_GOOGLE_MODEL_ID } from "@/lib/models/llm/google-llm-list"
import { IconHome, IconSettings } from "@tabler/icons-react"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { ChatSettingsForm } from "../ui/chat-settings-form"
import ImagePicker from "../ui/image-picker"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { LimitDisplay } from "../ui/limit-display"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "../ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { DeleteWorkspace } from "./delete-workspace"
import { WorkspaceCollaborationSettings } from "./workspace-collaboration-settings"

interface WorkspaceSettingsProps {
  embedded?: boolean
  onClose?: () => void
}

export const WorkspaceSettings: FC<WorkspaceSettingsProps> = ({
  embedded = false,
  onClose
}) => {
  const {
    profile,
    selectedWorkspace,
    setSelectedWorkspace,
    setWorkspaces,
    setChatSettings,
    workspaceImages,
    setWorkspaceImages
  } = useContext(ChatbotUIContext)

  const buttonRef = useRef<HTMLButtonElement>(null)

  const [isOpen, setIsOpen] = useState(false)

  const [name, setName] = useState(selectedWorkspace?.name || "")
  const [imageLink, setImageLink] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [description, setDescription] = useState(
    selectedWorkspace?.description || ""
  )
  const [instructions, setInstructions] = useState(
    selectedWorkspace?.instructions || ""
  )
  const [sharing, setSharing] = useState<"private" | "shared">(
    selectedWorkspace?.sharing === "shared" ? "shared" : "private"
  )
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole | null>(null)
  const isOwner = profile?.user_id === selectedWorkspace?.user_id
  const canManageWorkspace =
    workspaceRole === "owner" || workspaceRole === "admin"

  const [defaultChatSettings, setDefaultChatSettings] = useState<ChatSettings>({
    model: (selectedWorkspace?.default_model ||
      DEFAULT_GOOGLE_MODEL_ID) as LLMID,
    prompt:
      selectedWorkspace?.default_prompt ??
      "You are a friendly, helpful AI assistant.",
    temperature: selectedWorkspace?.default_temperature ?? 0.5,
    contextLength: selectedWorkspace?.default_context_length ?? 4096,
    includeProfileContext: selectedWorkspace?.include_profile_context ?? true,
    includeWorkspaceInstructions:
      selectedWorkspace?.include_workspace_instructions ?? true,
    embeddingsProvider:
      selectedWorkspace?.embeddings_provider === "openai" ? "openai" : "local"
  })

  useEffect(() => {
    setName(selectedWorkspace?.name || "")
    setDescription(selectedWorkspace?.description || "")
    setInstructions(selectedWorkspace?.instructions || "")
    setSharing(selectedWorkspace?.sharing === "shared" ? "shared" : "private")
    setSelectedImage(null)

    setDefaultChatSettings({
      model: (selectedWorkspace?.default_model ||
        DEFAULT_GOOGLE_MODEL_ID) as LLMID,
      prompt:
        selectedWorkspace?.default_prompt ??
        "You are a friendly, helpful AI assistant.",
      temperature: selectedWorkspace?.default_temperature ?? 0.5,
      contextLength: selectedWorkspace?.default_context_length ?? 4096,
      includeProfileContext: selectedWorkspace?.include_profile_context ?? true,
      includeWorkspaceInstructions:
        selectedWorkspace?.include_workspace_instructions ?? true,
      embeddingsProvider:
        selectedWorkspace?.embeddings_provider === "openai" ? "openai" : "local"
    })
  }, [selectedWorkspace])

  useEffect(() => {
    let active = true
    if (!selectedWorkspace || !profile) {
      setWorkspaceRole(null)
      return
    }

    getWorkspaceRole(selectedWorkspace.id)
      .then(role => {
        if (active) setWorkspaceRole(role)
      })
      .catch(error => {
        if (!active) return
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load workspace role."
        )
      })

    return () => {
      active = false
    }
  }, [selectedWorkspace?.id, profile?.user_id])

  useEffect(() => {
    const workspaceImage =
      workspaceImages.find(
        image => image.path === selectedWorkspace?.image_path
      )?.base64 || ""

    setImageLink(workspaceImage)
  }, [workspaceImages, selectedWorkspace?.id, selectedWorkspace?.image_path])

  const handleSave = async () => {
    if (!selectedWorkspace) return
    if (!canManageWorkspace) {
      toast.error("Only workspace owners and admins can update settings.")
      return
    }

    try {
      const previousImagePath = selectedWorkspace.image_path
      const imagePath = selectedImage
        ? await uploadWorkspaceImage(selectedWorkspace, selectedImage)
        : previousImagePath

      let updatedWorkspace: Tables<"workspaces">
      try {
        updatedWorkspace = await updateWorkspace(selectedWorkspace.id, {
          ...selectedWorkspace,
          name,
          sharing,
          description,
          image_path: imagePath,
          instructions,
          default_model: defaultChatSettings.model,
          default_prompt: defaultChatSettings.prompt,
          default_temperature: defaultChatSettings.temperature,
          default_context_length: defaultChatSettings.contextLength,
          embeddings_provider: defaultChatSettings.embeddingsProvider,
          include_profile_context: defaultChatSettings.includeProfileContext,
          include_workspace_instructions:
            defaultChatSettings.includeWorkspaceInstructions
        })
      } catch (error) {
        if (selectedImage && imagePath !== previousImagePath) {
          await deleteWorkspaceImage(imagePath).catch(cleanupError => {
            console.error(
              "Could not clean up an unused workspace image.",
              cleanupError
            )
          })
        }

        throw error
      }

      setChatSettings(defaultChatSettings)

      if (!embedded) setIsOpen(false)
      setSelectedWorkspace(updatedWorkspace)
      setWorkspaces(workspaces => {
        return workspaces.map(workspace => {
          if (workspace.id === selectedWorkspace.id) {
            return updatedWorkspace
          }

          return workspace
        })
      })

      toast.success("Workspace updated!")

      if (selectedImage) {
        try {
          const url = await getWorkspaceImageFromStorage(imagePath)

          if (url) {
            const response = await fetch(url)
            const blob = await response.blob()
            const base64 = await convertBlobToBase64(blob)

            setWorkspaceImages(prev => [
              ...prev.filter(
                image => image.workspaceId !== selectedWorkspace.id
              ),
              {
                workspaceId: selectedWorkspace.id,
                path: imagePath,
                base64,
                url
              }
            ])
          }
        } catch (error) {
          toast.error(
            error instanceof Error
              ? `Workspace saved, but its image preview could not refresh: ${error.message}`
              : "Workspace saved, but its image preview could not refresh."
          )
        }

        if (previousImagePath && previousImagePath !== imagePath) {
          try {
            await deleteWorkspaceImage(previousImagePath)
          } catch (error) {
            toast.error(
              error instanceof Error
                ? `Workspace saved, but image cleanup failed: ${error.message}`
                : "Workspace saved, but the previous image could not be removed."
            )
          }
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save workspace."
      )
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      buttonRef.current?.click()
    }
  }

  if (!selectedWorkspace || !profile) return null

  const settingsContent = (
    <>
      <div className="grow overflow-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            Workspace Settings
            {selectedWorkspace?.is_home && <IconHome />}
          </SheetTitle>

          {selectedWorkspace?.is_home && (
            <div className="text-sm font-light">
              This is your home workspace for personal use.
            </div>
          )}
        </SheetHeader>

        <Tabs defaultValue="main">
          <TabsList className="mt-4 grid w-full grid-cols-3">
            <TabsTrigger value="main">Main</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
          </TabsList>

          <TabsContent className="mt-4 space-y-4" value="main">
            <>
              <div className="space-y-1">
                <Label>Workspace Name</Label>

                <Input
                  placeholder="Name..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Workspace Image</Label>

                <ImagePicker
                  src={imageLink}
                  image={selectedImage}
                  onSrcChange={setImageLink}
                  onImageChange={setSelectedImage}
                  width={50}
                  height={50}
                />
              </div>
            </>

            <div className="space-y-1">
              <Label>
                How would you like the AI to respond in this workspace?
              </Label>

              <TextareaAutosize
                placeholder="Instructions... (optional)"
                value={instructions}
                onValueChange={setInstructions}
                minRows={5}
                maxRows={10}
                maxLength={1500}
              />

              <LimitDisplay
                used={instructions.length}
                limit={WORKSPACE_INSTRUCTIONS_MAX}
              />
            </div>
          </TabsContent>

          <TabsContent className="mt-5" value="defaults">
            <div className="mb-4 text-sm">
              These are the settings your workspace begins with when selected.
            </div>

            <ChatSettingsForm
              chatSettings={defaultChatSettings}
              onChangeChatSettings={setDefaultChatSettings}
            />
          </TabsContent>

          <TabsContent className="mt-5 space-y-5" value="access">
            {!selectedWorkspace.is_home && (
              <div className="space-y-2">
                <Label htmlFor="workspace-visibility">
                  Workspace visibility
                </Label>
                <select
                  id="workspace-visibility"
                  className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 focus-visible:outline-none focus-visible:ring-2"
                  disabled={!isOwner}
                  value={sharing}
                  onChange={event =>
                    setSharing(event.target.value as "private" | "shared")
                  }
                >
                  <option value="private">Private</option>
                  <option value="shared">Shared</option>
                </select>
                <p className="text-muted-foreground text-xs">
                  Making a workspace private removes its members and revokes
                  pending invitations.
                </p>
              </div>
            )}

            <WorkspaceCollaborationSettings workspace={selectedWorkspace} />
          </TabsContent>
        </Tabs>
      </div>

      <div className="mt-6 flex justify-between">
        <div>
          {!selectedWorkspace.is_home && isOwner && (
            <DeleteWorkspace
              workspace={selectedWorkspace}
              onDelete={() => (embedded ? onClose?.() : setIsOpen(false))}
            />
          )}
        </div>

        <div className="space-x-2">
          <Button
            variant="ghost"
            onClick={() => (embedded ? onClose?.() : setIsOpen(false))}
          >
            Cancel
          </Button>

          <Button
            ref={buttonRef}
            disabled={!canManageWorkspace}
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div className="flex min-h-[400px] flex-col" onKeyDown={handleKeyDown}>
        {settingsContent}
      </div>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label="Workspace settings"
        >
          <IconSettings size={18} />
        </Button>
      </SheetTrigger>

      <SheetContent
        className="flex flex-col justify-between"
        side="left"
        onKeyDown={handleKeyDown}
      >
        {settingsContent}
      </SheetContent>
    </Sheet>
  )
}
