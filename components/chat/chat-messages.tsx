import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import {
  createMessageLike,
  deleteMessageLike,
  getMessageLikes
} from "@/db/message-likes"
import { deleteMessage } from "@/db/messages"
import { supabase } from "@/lib/supabase/browser-client"
import { buildMessageTree } from "@/lib/thread-tree"
import { Tables } from "@/supabase/types"
import { FC, useContext, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Message } from "../messages/message"
import { ThreadedMessage } from "../messages/threaded-message"

export const ChatMessages: FC = () => {
  const {
    chatMessages,
    setChatMessages,
    chatFileItems,
    selectedChat,
    selectedWorkspace,
    workspaceRoles,
    profile
  } = useContext(ChatbotUIContext)
  const { handleSendEdit, handleSendMessage } = useChatHandler()
  const [editingMessage, setEditingMessage] = useState<Tables<"messages">>()
  const [messageLikes, setMessageLikes] = useState<Tables<"message_likes">[]>(
    []
  )
  const messageIdsKey = chatMessages.map(item => item.message.id).join(",")
  const messageTree = useMemo(
    () => buildMessageTree(chatMessages),
    [chatMessages]
  )
  const isGroupWorkspace = selectedWorkspace?.sharing === "shared"
  const canInteract =
    !selectedWorkspace ||
    selectedWorkspace.sharing !== "shared" ||
    workspaceRoles[selectedWorkspace.id] !== "viewer"
  const canDeleteAnyReply = Boolean(
    selectedWorkspace &&
      isGroupWorkspace &&
      ["owner", "admin"].includes(workspaceRoles[selectedWorkspace.id])
  )

  useEffect(() => {
    const messageIds = messageIdsKey.split(",").filter(Boolean)
    if (!isGroupWorkspace || messageIds.length === 0) {
      setMessageLikes([])
      return
    }

    let active = true
    const loadLikes = async () => {
      try {
        const likes = await getMessageLikes(messageIds)
        if (active) setMessageLikes(likes)
      } catch (error) {
        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to load message likes."
          )
        }
      }
    }

    void loadLikes()
    const channel = supabase
      .channel(`message-likes-${selectedChat?.id || selectedWorkspace?.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_likes" },
        () => void loadLikes()
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [isGroupWorkspace, messageIdsKey, selectedChat?.id, selectedWorkspace?.id])

  const handleToggleLike = async (messageId: string) => {
    if (!profile || !canInteract) return

    const existing = messageLikes.find(
      like => like.message_id === messageId && like.user_id === profile.user_id
    )

    try {
      if (existing) {
        await deleteMessageLike(messageId, profile.user_id)
        setMessageLikes(current => current.filter(like => like !== existing))
      } else {
        const like = await createMessageLike(messageId, profile.user_id)
        setMessageLikes(current => [...current, like])
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update message like."
      )
    }
  }

  const handleRegenerate = (messages: Tables<"messages">[]) => {
    const target = messages[messages.length - 1]
    if (!target) return

    const history = chatMessages.filter(
      item => item.message.sequence_number <= target.sequence_number
    )
    void handleSendMessage(target.content, history, true)
  }

  const handleDeleteReply = async (message: Tables<"messages">) => {
    try {
      await deleteMessage(message.id)
      setChatMessages(current =>
        current.filter(item => item.message.id !== message.id)
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete this reply."
      )
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2 px-4 py-6">
      {isGroupWorkspace
        ? messageTree.map((node, index) => (
            <ThreadedMessage
              key={node.chatMessage.message.id}
              node={node}
              isLastSibling={index === messageTree.length - 1}
              onReplyInThread={(parentId, replyText) =>
                void handleSendMessage(
                  replyText,
                  chatMessages,
                  false,
                  undefined,
                  parentId
                )
              }
              onStartEdit={setEditingMessage}
              onCancelEdit={() => setEditingMessage(undefined)}
              onSubmitEdit={handleSendEdit}
              onRegenerate={handleRegenerate}
              editingMessageId={editingMessage?.id}
              canInteract={canInteract}
              canDeleteAnyReply={canDeleteAnyReply}
              messageLikes={messageLikes}
              onToggleLike={messageId => void handleToggleLike(messageId)}
              onDeleteReply={message => void handleDeleteReply(message)}
            />
          ))
        : chatMessages.map((chatMessage, index) => (
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
