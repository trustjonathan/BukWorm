import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { IconInfoCircle, IconMessagePlus } from "@tabler/icons-react"
import { FC, useContext, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { Button } from "../ui/button"

interface ChatSecondaryButtonsProps {}

export const ChatSecondaryButtons: FC<ChatSecondaryButtonsProps> = ({}) => {
  const { selectedChat } = useContext(ChatbotUIContext)

  const { handleNewChat } = useChatHandler()
  const [isInfoOpen, setIsInfoOpen] = useState(false)

  return (
    <>
      {selectedChat && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Show chat information"
            title="Chat information"
            onClick={() => setIsInfoOpen(true)}
          >
            <IconInfoCircle size={20} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Start a new chat"
            title="Start a new chat"
            onClick={handleNewChat}
          >
            <IconMessagePlus size={20} />
          </Button>

          <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Chat information</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 break-words text-sm">
                <div>Model: {selectedChat.model}</div>
                <div>Prompt: {selectedChat.prompt}</div>
                <div>Temperature: {selectedChat.temperature}</div>
                <div>Context Length: {selectedChat.context_length}</div>
                <div>
                  Profile Context:{" "}
                  {selectedChat.include_profile_context
                    ? "Enabled"
                    : "Disabled"}
                </div>
                <div>
                  Workspace Instructions:{" "}
                  {selectedChat.include_workspace_instructions
                    ? "Enabled"
                    : "Disabled"}
                </div>
                <div>
                  Embeddings Provider: {selectedChat.embeddings_provider}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  )
}
