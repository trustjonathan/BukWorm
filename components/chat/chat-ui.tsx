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
import { ChatHelp } from "./chat-help"
import { useScroll } from "./chat-hooks/use-scroll"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { ChatSettings } from "./chat-settings"
import { ChatScrollButtons } from "./chat-scroll-buttons"
import { ChatSecondaryButtons } from "./chat-secondary-buttons"
import { QuickSettings } from "./quick-settings"

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
    messagesStartRef,
    messagesEndRef,
    handleScroll,
    scrollToBottom,
    setIsAtBottom,
    isAtTop,
    isAtBottom,
    isOverflowing,
    scrollToTop
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
    <div className="relative flex h-full min-w-0 overflow-hidden bg-slate-50 text-slate-800 transition-colors dark:bg-[#070a13] dark:text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -left-40 -top-48 size-[32rem] rounded-full bg-cyan-300/15 blur-3xl dark:bg-cyan-500/10" />
        <div className="absolute -bottom-56 -right-32 size-[34rem] rounded-full bg-indigo-300/15 blur-3xl dark:bg-indigo-500/10" />
      </div>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[64px] items-center justify-between gap-2 border-b border-slate-200/80 bg-white/70 px-3 backdrop-blur-xl sm:gap-3 sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/40">
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

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <QuickSettings />
            <ChatSettings />
            <ChatSecondaryButtons />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="relative flex min-w-0 flex-1 flex-col">
            {chatMessages.length === 0 && (
              <div className="pointer-events-none absolute inset-x-4 top-[24%] z-0 text-center">
                <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-[2rem] border border-cyan-200 bg-white p-3 shadow-xl shadow-cyan-900/10 dark:border-cyan-300/20 dark:bg-slate-900 dark:shadow-cyan-950/40">
                  <Image
                    src="/matrix.png"
                    alt="Matrix AI"
                    width={56}
                    height={56}
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Matrix AI Workspace
                </div>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Ask Matrix anything. Ready with thoughtful, step-by-step
                  reasoning and context-aware discussion.
                </p>
              </div>
            )}

            <div className="absolute left-3 top-2 z-10 flex justify-center">
              <ChatScrollButtons
                isAtTop={isAtTop}
                isAtBottom={isAtBottom}
                isOverflowing={isOverflowing}
                scrollToTop={scrollToTop}
                scrollToBottom={scrollToBottom}
              />
            </div>

            <div
              className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-auto"
              onScroll={handleScroll}
            >
              <div ref={messagesStartRef} />
              <ChatMessages />
              <div ref={messagesEndRef} />
            </div>

            <div className="relative z-10 w-full px-3 pb-3 pt-2 sm:px-5 sm:pb-5">
              <ChatInput />
            </div>
            <div className="absolute bottom-2 right-2 z-20 hidden md:block lg:bottom-4 lg:right-4">
              <ChatHelp />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
