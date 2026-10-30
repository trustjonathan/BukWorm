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
  IconBook,
  IconBolt,
  IconCircleFilled,
  IconSparkles
} from "@tabler/icons-react"
import { useParams } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
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
    chatSettings
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
    <div className="relative flex h-full min-w-0 overflow-hidden bg-gradient-to-br from-sky-50 via-white to-violet-50 text-slate-800 dark:bg-[#070a13] dark:bg-none dark:text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -left-40 -top-48 size-[32rem] rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/10" />
        <div className="absolute -bottom-56 -right-32 size-[34rem] rounded-full bg-violet-300/20 blur-3xl dark:bg-indigo-500/10" />
      </div>

      <aside className="relative z-10 hidden w-64 shrink-0 flex-col border-r border-sky-200/70 bg-white/55 p-5 backdrop-blur-xl xl:flex dark:border-slate-800/80 dark:bg-slate-950/45">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-cyan-300/70 bg-gradient-to-br from-cyan-100 to-indigo-100 text-indigo-600 shadow-lg shadow-cyan-500/10 dark:border-cyan-400/30 dark:from-cyan-400/15 dark:to-indigo-400/15 dark:text-cyan-200">
            <IconBook size={23} stroke={1.8} />
          </div>
          <div>
            <div className="font-semibold tracking-tight">BukWorm</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Your Gemini workspace
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-200/80 bg-white/70 p-4 shadow-sm shadow-cyan-900/5 dark:border-cyan-400/20 dark:bg-slate-900/65">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <IconCircleFilled
              className={
                availableHostedModels.some(model => model.provider === "google")
                  ? "text-emerald-500"
                  : "text-amber-500"
              }
              size={9}
            />
            Gemini{" "}
            {availableHostedModels.some(model => model.provider === "google")
              ? "ready"
              : "connecting"}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {chatSettings?.model || DEFAULT_GOOGLE_MODEL_ID}
          </p>
        </div>

        <div className="mt-3 rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-white/80 to-violet-50/80 p-4 dark:border-indigo-400/15 dark:from-slate-900/70 dark:to-indigo-950/35">
          <IconBolt
            className="mb-2 text-indigo-500 dark:text-cyan-300"
            size={18}
          />
          <div className="text-sm font-semibold">Fast by default</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Gemini Flash-Lite keeps everyday conversations responsive.
          </p>
        </div>

        <div className="mt-auto rounded-2xl border border-sky-200/70 bg-white/60 p-4 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
          Your conversation history stays available as your chat grows.
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[68px] items-center justify-between gap-2 border-b border-sky-200/70 bg-white/45 px-3 backdrop-blur-xl sm:gap-3 sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/30">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {selectedChat?.name || "New chat"}
            </div>
            <div className="mt-1 hidden items-center gap-1.5 text-xs text-slate-500 sm:flex dark:text-slate-400">
              <IconSparkles
                size={13}
                className="text-cyan-600 dark:text-cyan-300"
              />
              Gemini-powered · Streaming responses
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
              <div className="pointer-events-none absolute inset-x-4 top-[27%] z-0 text-center">
                <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl border border-cyan-200/80 bg-white/70 text-indigo-600 shadow-xl shadow-cyan-900/10 dark:border-cyan-300/20 dark:bg-slate-900/70 dark:text-cyan-200 dark:shadow-cyan-950/30">
                  <IconSparkles size={28} stroke={1.6} />
                </div>
                <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  A little more insight, instantly.
                </div>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Ask BukWorm anything. Gemini keeps the conversation flowing
                  with the context of your chat.
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
