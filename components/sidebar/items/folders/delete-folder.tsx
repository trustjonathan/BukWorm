import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { ChatbotUIContext } from "@/context/context"
import { deleteFolder, deleteFolderAndItems } from "@/db/folders"
import { Tables } from "@/supabase/types"
import { ContentType } from "@/types"
import { IconTrash } from "@tabler/icons-react"
import { FC, useContext, useRef, useState } from "react"
import { toast } from "sonner"

interface DeleteFolderProps {
  folder: Tables<"folders">
  contentType: ContentType
}

export const DeleteFolder: FC<DeleteFolderProps> = ({
  folder,
  contentType
}) => {
  const {
    setChats,
    setFolders,
    setPresets,
    setPrompts,
    setFiles,
    setCollections,
    setAssistants,
    setTools,
    setModels
  } = useContext(ChatbotUIContext)

  const buttonRef = useRef<HTMLButtonElement>(null)

  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const stateUpdateFunctions = {
    chats: setChats,
    presets: setPresets,
    prompts: setPrompts,
    files: setFiles,
    collections: setCollections,
    assistants: setAssistants,
    tools: setTools,
    models: setModels
  }

  const handleDeleteFolderOnly = async () => {
    const setStateFunction = stateUpdateFunctions[contentType]

    if (!setStateFunction) return

    setIsDeleting(true)
    try {
      await deleteFolder(folder.id)

      setFolders(prevState => prevState.filter(c => c.id !== folder.id))
      setStateFunction((prevItems: any) =>
        prevItems.map((item: any) =>
          item.folder_id === folder.id
            ? {
                ...item,
                folder_id: null
              }
            : item
        )
      )
      setShowFolderDialog(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete folder."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteFolderAndItems = async () => {
    const setStateFunction = stateUpdateFunctions[contentType]

    if (!setStateFunction) return

    setIsDeleting(true)
    try {
      await deleteFolderAndItems(folder.id, contentType)

      setStateFunction((prevItems: any) =>
        prevItems.filter((item: any) => item.folder_id !== folder.id)
      )
      setFolders(prevState => prevState.filter(c => c.id !== folder.id))
      setShowFolderDialog(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete folder and its items."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label={`Delete ${folder.name} folder`}
        >
          <IconTrash size={18} />
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete {folder.name}</DialogTitle>

          <DialogDescription>
            Are you sure you want to delete this folder?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={isDeleting}
            onClick={() => setShowFolderDialog(false)}
          >
            Cancel
          </Button>

          <Button
            ref={buttonRef}
            variant="destructive"
            disabled={isDeleting}
            onClick={handleDeleteFolderAndItems}
          >
            Delete Folder & Included Items
          </Button>

          <Button
            ref={buttonRef}
            variant="destructive"
            disabled={isDeleting}
            onClick={handleDeleteFolderOnly}
          >
            Delete Folder Only
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
