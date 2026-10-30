import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { buildMessageTree, getAncestorChain } from "@/lib/thread-tree"
import { Tables } from "@/supabase/types"
import { ChatMessage } from "@/types"
import { FC, useContext, useState } from "react"
import { ThreadedMessage } from "../messages/threaded-message"

interface ChatMessagesProps {}

export const ChatMessages: FC<ChatMessagesProps> = ({}) => {
  const {
    chatMessages,
    chatFileItems,
    setChatMessages,
    setIsGenerating,
    setFirstTokenReceived,
    chatSettings,
    profile,
    selectedWorkspace,
    availableHostedModels,
    availableLocalModels,
    availableOpenRouterModels,
    models
  } = useContext(ChatbotUIContext)

  const { handleSendMessage, handleSendEdit } = useChatHandler()

  const [editingMessage, setEditingMessage] = useState<Tables<"messages">>()

  // Build the tree once per render from the flat chatMessages array
  const tree = buildMessageTree(chatMessages)

  /**
   * Called when the user replies to a message (e.g. via swipe-left on an agent message).
   * Sends the reply to Gemini using only the ancestor chain of that branch.
   */
  const handleReplyInThread = (parentId: string, replyText: string) => {
    // Build the ancestor chain leading to parentId so Gemini gets the exact branch context
    const ancestorChain = getAncestorChain(tree, parentId)

    // Fire off Gemini in that branch's context with parentId
    handleSendMessage(replyText, ancestorChain, false, undefined, parentId)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-1 px-4 py-6">
      <div className="mb-5 font-mono text-xs uppercase tracking-wider text-cyan-400">
        Comments (and Agent Notes)
        <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
          {chatMessages.length}
        </span>
      </div>

      {tree.map((node, idx) => (
        <ThreadedMessage
          key={node.chatMessage.message.id}
          node={node}
          depth={0}
          isLastSibling={idx === tree.length - 1}
          onReplyInThread={handleReplyInThread}
          onStartEdit={setEditingMessage}
          onCancelEdit={() => setEditingMessage(undefined)}
          onSubmitEdit={handleSendEdit}
          onRegenerate={ancestorMessages => {
            // Regenerate using the branch context
            handleSendMessage(
              ancestorMessages[ancestorMessages.length - 1]?.content ?? "",
              chatMessages,
              true
            )
          }}
          editingMessageId={editingMessage?.id}
        />
      ))}
    </div>
  )
}
