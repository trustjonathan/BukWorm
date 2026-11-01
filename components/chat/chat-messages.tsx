import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { FC, useContext, useState } from "react"
import { Message } from "../messages/message"

export const ChatMessages: FC = () => {
  const { chatMessages, chatFileItems } = useContext(ChatbotUIContext)
  const { handleSendEdit } = useChatHandler()
  const [editingMessage, setEditingMessage] = useState<Tables<"messages">>()

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2 px-4 py-6">
      {chatMessages.map((chatMessage, index) => (
        <Message
          key={chatMessage.message.id}
          message={chatMessage.message}
          fileItems={chatFileItems.filter(fileItem =>
            chatMessage.fileItems.includes(fileItem.id)
          )}
          isEditing={editingMessage?.id === chatMessage.message.id}
          isLast={index === chatMessages.length - 1}
          onStartEdit={setEditingMessage}
          onCancelEdit={() => setEditingMessage(undefined)}
          onSubmitEdit={handleSendEdit}
        />
      ))}
    </div>
  )
}
