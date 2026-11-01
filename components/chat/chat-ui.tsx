import Loading from "@/app/[locale]/loading"
import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { getAssistantToolsByAssistantId } from "@/db/assistant-tools"
import { getChatFilesByChatId } from "@/db/chat-files"
import { getChatById } from "@/db/chats"
import { getMessageFileItemsByMessageId } from "@/db/message-file-items"
import { getMessagesByChatId } from "@/db/messages"
import { getMessageImageFromStorage } from "@/db/storage/message-images"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLMID, MessageImage } from "@/types"
import { DEFAULT_GOOGLE_MODEL_ID } from "@/lib/models/llm/google-llm-list"
import {
  IconBolt,
  IconCircleFilled,
  IconLayoutSidebar,
  IconSparkles
} from "@tabler/icons-react"
import Image from "next/image"
import { useParams } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
import { Button } from "../ui/button"
import { useScroll } from "./chat-hooks/use-scroll"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { ChatScrollButtons } from "./chat-scroll-buttons"

interface ChatUIProps {}

export const ChatUI: FC<ChatUIProps> = ({}) => {
  useHotkey("o", () => handleNewChat())

  const params = useParams()

  const {
    chatMessages,
    setChatMessages,
    selectedChat,
    setSelectedChat,
    setChatSettings,
    setChatImages,
    assistants,
    setSelectedAssistant,
    setChatFileItems,
    setChatFiles,
    setShowFilesDisplay,
    setUseRetrieval,
    setSelectedTools,
    availableHostedModels,
    chatSettings,
    showSidebar,
    setShowSidebar
  } = useContext(ChatbotUIContext)

  const { handleNewChat, handleFocusChatInput } = useChatHandler()

  const {
    messagesContainerRef,
    messagesEndRef,
    handleScroll,
    scrollToBottom,
    setIsAtBottom,
    isAtBottom,
    isOverflowing
  } = useScroll()

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      await fetchMessages()
      await fetchChat()

      scrollToBottom()
      setIsAtBottom(true)
    }

    if (params.chatid) {
      fetchData().then(() => {
        handleFocusChatInput()
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  const fetchMessages = async () => {
    const fetchedMessages = await getMessagesByChatId(params.chatid as string)

    const imagePromises: Promise<MessageImage>[] = fetchedMessages.flatMap(
      message =>
        message.image_paths
          ? message.image_paths.map(async imagePath => {
              const url = await getMessageImageFromStorage(imagePath)

              if (url) {
                const response = await fetch(url)
                const blob = await response.blob()
                const base64 = await convertBlobToBase64(blob)

                return {
                  messageId: message.id,
                  path: imagePath,
                  base64,
                  url,
                  file: null
                }
              }

              return {
                messageId: message.id,
                path: imagePath,
                base64: "",
                url,
                file: null
              }
            })
          : []
    )

    const images: MessageImage[] = await Promise.all(imagePromises.flat())
    setChatImages(images)

    const messageFileItemPromises = fetchedMessages.map(
      async message => await getMessageFileItemsByMessageId(message.id)
    )

    const messageFileItems = await Promise.all(messageFileItemPromises)

    const uniqueFileItems = messageFileItems.flatMap(item => item.file_items)
    setChatFileItems(uniqueFileItems)

    const chatFiles = await getChatFilesByChatId(params.chatid as string)

    setChatFiles(
      chatFiles.files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        file: null
      }))
    )

    setUseRetrieval(true)
    setShowFilesDisplay(true)

    const fetchedChatMessages = fetchedMessages.map(message => {
      return {
        message,
        fileItems: messageFileItems
          .filter(messageFileItem => messageFileItem.id === message.id)
          .flatMap(messageFileItem =>
            messageFileItem.file_items.map(fileItem => fileItem.id)
          )
      }
    })

    setChatMessages(fetchedChatMessages)
  }

  const fetchChat = async () => {
    const chat = await getChatById(params.chatid as string)
    if (!chat) return

    if (chat.assistant_id) {
      const assistant = assistants.find(
        assistant => assistant.id === chat.assistant_id
      )

      if (assistant) {
        setSelectedAssistant(assistant)

        const assistantTools = (
          await getAssistantToolsByAssistantId(assistant.id)
        ).tools
        setSelectedTools(assistantTools)
      }
    }

    setSelectedChat(chat)
    setChatSettings({
      model: availableHostedModels.some(model => model.modelId === chat.model)
        ? (chat.model as LLMID)
        : DEFAULT_GOOGLE_MODEL_ID,
      prompt: chat.prompt,
      temperature: chat.temperature,
      contextLength: Math.min(chat.context_length, 32768),
      includeProfileContext: chat.include_profile_context,
      includeWorkspaceInstructions: chat.include_workspace_instructions,
      embeddingsProvider: "local"
    })
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="bg-background text-foreground relative flex h-full min-w-0 overflow-hidden transition-colors">
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/95 flex min-h-[64px] items-center justify-between gap-2 border-b px-3 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {/* Sidebar toggle button (visible on all screens) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowSidebar(prev => {
                  const next = !prev
                  localStorage.setItem("showSidebar", String(next))
                  return next
                })
              }}
              className="size-9 shrink-0 rounded-xl text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Toggle sidebar"
            >
              <IconLayoutSidebar size={20} />
            </Button>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {selectedChat?.name || "Matrix AI"}
              </div>
              <div className="mt-0.5 hidden items-center gap-1.5 text-xs text-slate-500 sm:flex dark:text-slate-400">
                <IconSparkles
                  size={13}
                  className="text-cyan-600 dark:text-cyan-400"
                />
                Matrix-powered · Streaming responses
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="relative flex min-w-0 flex-1 flex-col">
            {chatMessages.length === 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[55%] overflow-hidden"
                aria-hidden="true"
              >
                <div className="absolute -left-24 -top-32 size-[28rem] rounded-full bg-cyan-300/10 blur-3xl dark:bg-cyan-500/10" />
                <div className="absolute -right-24 -top-24 size-[28rem] rounded-full bg-indigo-300/10 blur-3xl dark:bg-indigo-500/10" />
              </div>
            )}

            {chatMessages.length === 0 && (
              <div className="pointer-events-none absolute inset-x-4 top-[24%] z-0 text-center">
                <div className="border-border bg-card mx-auto mb-5 flex size-20 items-center justify-center rounded-2xl border p-3 shadow-md">
                  <Image
                    src="/matrix-black.png"
                    alt="Matrix AI"
                    width={56}
                    height={56}
                    className="block object-contain dark:hidden"
                    priority
                  />
                  <Image
                    src="/matrix-white.png"
                    alt="Matrix AI"
                    width={56}
                    height={56}
                    className="hidden object-contain dark:block"
                    priority
                  />
                </div>
                <div className="text-foreground text-xl font-bold tracking-tight">
                  Matrix AI Workspace
                </div>
                <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-sm leading-relaxed">
                  Ask Matrix anything. Ready with thoughtful, step-by-step
                  reasoning and context-aware discussion.
                </p>
              </div>
            )}

            <div
              ref={messagesContainerRef}
              className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-auto"
              onScroll={handleScroll}
            >
              <ChatMessages />
              <div ref={messagesEndRef} />
            </div>

            <div className="relative z-10 w-full px-3 pb-3 pt-2 sm:px-5 sm:pb-5">
              <div className="pointer-events-none absolute inset-x-0 bottom-full mb-2 flex justify-center">
                <ChatScrollButtons
                  isAtBottom={isAtBottom}
                  isOverflowing={isOverflowing}
                  scrollToBottom={scrollToBottom}
                />
              </div>
              <ChatInput />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
