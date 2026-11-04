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
import { supabase } from "@/lib/supabase/browser-client"
import { Tables } from "@/supabase/types"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLMID, MessageImage } from "@/types"
import { getDefaultModelId } from "@/lib/models/llm/llm-list"
import {
  IconBolt,
  IconCircleFilled,
  IconLayoutSidebar,
  IconShare,
  IconSpy
} from "@tabler/icons-react"
import Image from "next/image"
import { useParams } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
import { toast } from "sonner"
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
    setShowSidebar,
    isGenerating,
    isTemporaryChat,
    setIsTemporaryChat,
    profile
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
  const [realtimeStatus, setRealtimeStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting")
  const chatId = typeof params.chatid === "string" ? params.chatid : null
  const firstName = profile?.display_name.trim().split(/\s+/)[0]

  useEffect(() => {
    const fetchData = async () => {
      await fetchMessages()
      await fetchChat()

      scrollToBottom()
      setIsAtBottom(true)
    }

    if (params.chatid) {
      setIsTemporaryChat(false)
      fetchData().then(() => {
        handleFocusChatInput()
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!chatId) return

    let active = true
    setRealtimeStatus("connecting")
    const channel = supabase
      .channel(`chat-messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`
        },
        payload => {
          if (payload.eventType === "DELETE") {
            const deletedMessage = payload.old as { id?: string }
            if (!deletedMessage.id) return

            setChatMessages(messages =>
              messages.filter(
                message => message.message.id !== deletedMessage.id
              )
            )
            return
          }

          const message = payload.new as Tables<"messages">
          if (!message.id || message.chat_id !== chatId) return

          setChatMessages(messages => {
            const existingIndex = messages.findIndex(
              item => item.message.id === message.id
            )
            const nextMessages =
              existingIndex >= 0
                ? messages.map((item, index) =>
                    index === existingIndex ? { ...item, message } : item
                  )
                : [...messages, { message, fileItems: [] }]

            return nextMessages.sort(
              (left, right) =>
                left.message.sequence_number - right.message.sequence_number ||
                left.message.created_at.localeCompare(
                  right.message.created_at
                ) ||
                left.message.id.localeCompare(right.message.id)
            )
          })

          if (message.image_paths.length > 0) {
            void Promise.all(
              message.image_paths.map(async path => {
                const url = await getMessageImageFromStorage(path)
                if (!url) return null

                const response = await fetch(url)
                if (!response.ok) {
                  throw new Error(`Failed to load message image: ${path}`)
                }

                const blob = await response.blob()
                const base64 = await convertBlobToBase64(blob)

                return {
                  messageId: message.id,
                  path,
                  base64,
                  url,
                  file: null
                }
              })
            )
              .then(images => {
                setChatImages(currentImages => {
                  const loadedImages = images.filter(
                    (image): image is NonNullable<typeof image> =>
                      image !== null
                  )
                  const loadedPaths = new Set(
                    loadedImages.map(image => image.path)
                  )

                  return [
                    ...currentImages.filter(
                      image => !loadedPaths.has(image.path)
                    ),
                    ...loadedImages
                  ]
                })
              })
              .catch(error => {
                console.error(
                  "Failed to load a live chat message image:",
                  error
                )
              })
          }
        }
      )
      .subscribe(status => {
        if (!active) return

        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected")
          return
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("error")
          console.error(
            `Supabase message subscription for chat ${chatId} failed: ${status}`
          )
          return
        }

        if (status === "CLOSED") {
          setRealtimeStatus("error")
        }
      })

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [chatId, setChatImages, setChatMessages])

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

    setChatMessages(currentMessages => {
      const messagesById = new Map(
        fetchedChatMessages.map(item => [item.message.id, item])
      )

      for (const current of currentMessages) {
        if (current.message.chat_id !== params.chatid) continue

        const fetched = messagesById.get(current.message.id)
        messagesById.set(
          current.message.id,
          fetched
            ? {
                ...fetched,
                message: current.message,
                fileItems:
                  current.fileItems.length > 0
                    ? current.fileItems
                    : fetched.fileItems
              }
            : current
        )
      }

      return [...messagesById.values()].sort(
        (left, right) =>
          left.message.sequence_number - right.message.sequence_number ||
          left.message.created_at.localeCompare(right.message.created_at) ||
          left.message.id.localeCompare(right.message.id)
      )
    })
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
        : getDefaultModelId(profile?.default_model),
      prompt: chat.prompt,
      temperature: chat.temperature,
      contextLength: Math.min(chat.context_length, 32768),
      includeProfileContext: chat.include_profile_context,
      includeWorkspaceInstructions: chat.include_workspace_instructions,
      embeddingsProvider: "local"
    })
  }

  const handleShareChat = async () => {
    if (!selectedChat) return

    try {
      const chatUrl = new URL(
        `/${selectedChat.workspace_id}/chat/${selectedChat.id}`,
        window.location.origin
      ).toString()
      await navigator.clipboard.writeText(chatUrl)
      toast.success(
        "Chat link copied. Workspace access is required to open it."
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not copy the chat link."
      )
    }
  }

  const handleTemporaryChatToggle = async () => {
    if (isGenerating) {
      toast.error("Stop the current response before changing chat mode.")
      return
    }

    const enableTemporary = !isTemporaryChat
    setIsTemporaryChat(enableTemporary)
    await handleNewChat(enableTemporary)
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="bg-background text-foreground relative flex h-full min-w-0 overflow-hidden transition-colors">
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background flex min-h-14 items-center justify-between gap-2 border-b px-3 sm:min-h-[64px] sm:gap-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
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
              className="text-muted-foreground size-11 shrink-0 rounded-full sm:size-9"
              aria-label="Toggle sidebar"
            >
              <IconLayoutSidebar size={20} />
            </Button>

            {selectedChat && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {selectedChat.name}
                </div>
                <div className="text-muted-foreground mt-0.5 hidden items-center gap-1.5 text-xs sm:flex">
                  {isTemporaryChat ? (
                    <>
                      <IconSpy size={13} />
                      Incognito chat · not saved to Matrix
                    </>
                  ) : (
                    "Matrix-powered · Streaming responses"
                  )}
                </div>
                {chatId && !isTemporaryChat && (
                  <div
                    className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[11px]"
                    role="status"
                    aria-live="polite"
                  >
                    <IconCircleFilled
                      size={8}
                      className={
                        realtimeStatus === "connected"
                          ? "text-emerald-500"
                          : realtimeStatus === "error"
                            ? "text-destructive"
                            : "text-amber-500"
                      }
                      aria-hidden="true"
                    />
                    {realtimeStatus === "connected"
                      ? "Live updates connected"
                      : realtimeStatus === "error"
                        ? "Live updates unavailable"
                        : "Connecting to live updates"}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {selectedChat && !isTemporaryChat && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="Share chat link"
                title="Share chat link"
                onClick={() => void handleShareChat()}
              >
                <IconShare size={18} />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className={`min-h-11 gap-2 rounded-full px-3 text-xs font-medium sm:min-h-9 ${
                isTemporaryChat
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              }`}
              aria-label={`Incognito chat ${isTemporaryChat ? "on" : "off"}`}
              aria-pressed={isTemporaryChat}
              title="Toggle incognito mode"
              onClick={() => void handleTemporaryChatToggle()}
            >
              <IconSpy size={18} />
              {isTemporaryChat && <span className="font-semibold">On</span>}
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="relative flex min-w-0 flex-1 flex-col">
            <div
              ref={messagesContainerRef}
              className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-auto"
              onScroll={handleScroll}
            >
              {chatMessages.length === 0 && (
                <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center">
                  <Image
                    src="/matrix-logo-light.png"
                    alt=""
                    width={56}
                    height={56}
                    className="block size-14 object-contain dark:hidden"
                    priority
                  />
                  <Image
                    src="/matrix-logo-dark.png"
                    alt=""
                    width={56}
                    height={56}
                    className="hidden size-14 object-contain dark:block"
                    priority
                  />
                  <h1 className="text-foreground text-[28px] font-semibold leading-tight tracking-tight">
                    {firstName ? `Hey, ${firstName}` : "Hey there"}
                  </h1>
                </div>
              )}
              <ChatMessages />
              <div ref={messagesEndRef} />
            </div>

            <div className="relative z-10 mx-auto w-full max-w-4xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-5 sm:pb-5">
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
