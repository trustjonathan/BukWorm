import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
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
import { deleteChat } from "@/db/chats"
import useHotkey from "@/lib/hooks/use-hotkey"
import { Tables } from "@/supabase/types"
import { IconTrash } from "@tabler/icons-react"
import { useParams } from "next/navigation"
import { FC, useContext, useRef, useState } from "react"
import { toast } from "sonner"

interface DeleteChatProps {
  chat: Tables<"chats">
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}

export const DeleteChat: FC<DeleteChatProps> = ({
  chat,
  open,
  onOpenChange,
  showTrigger = true
}) => {
  const { setChats, selectedChat } = useContext(ChatbotUIContext)
  const { handleNewChat } = useChatHandler()
  const params = useParams()
  const routeChatId = params.chatid
  const isActive =
    typeof routeChatId === "string"
      ? routeChatId === chat.id
      : selectedChat?.id === chat.id

  const buttonRef = useRef<HTMLButtonElement>(null)

  const [internalOpen, setInternalOpen] = useState(false)
  const showChatDialog = open ?? internalOpen
  const setShowChatDialog = onOpenChange ?? setInternalOpen

  const [isDeleting, setIsDeleting] = useState(false)

  useHotkey(
    "Backspace",
    () => {
      if (isActive) setShowChatDialog(true)
    },
    isActive
  )

  const handleDeleteChat = async () => {
    setIsDeleting(true)
    try {
      await deleteChat(chat.id)

      setChats(prevState => prevState.filter(c => c.id !== chat.id))

      setShowChatDialog(false)

      if (isActive) {
        await handleNewChat()
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete chat."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      buttonRef.current?.click()
    }
  }

  return (
    <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={`Delete ${chat.name}`}
          >
            <IconTrash size={18} />
          </Button>
        </DialogTrigger>
      )}

      <DialogContent onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Delete {chat.name}</DialogTitle>

          <DialogDescription>
            Are you sure you want to delete this chat?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={isDeleting}
            onClick={() => setShowChatDialog(false)}
          >
            Cancel
          </Button>

          <Button
            ref={buttonRef}
            variant="destructive"
            disabled={isDeleting}
            onClick={handleDeleteChat}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
