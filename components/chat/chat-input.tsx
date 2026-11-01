import { ChatbotUIContext } from "@/context/context"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import {
  IconBolt,
  IconCirclePlus,
  IconPlayerStopFilled,
  IconSend
} from "@tabler/icons-react"
import Image from "next/image"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Input } from "../ui/input"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { ChatCommandInput } from "./chat-command-input"
import { ChatFilesDisplay } from "./chat-files-display"
import { useChatHandler } from "./chat-hooks/use-chat-handler"
import { useChatHistoryHandler } from "./chat-hooks/use-chat-history"
import { usePromptAndCommand } from "./chat-hooks/use-prompt-and-command"
import { useSelectFileHandler } from "./chat-hooks/use-select-file-handler"

interface ChatInputProps {}

export const ChatInput: FC<ChatInputProps> = ({}) => {
  const { t } = useTranslation()

  useHotkey("l", () => {
    handleFocusChatInput()
  })

  const [isTyping, setIsTyping] = useState<boolean>(false)

  const {
    isAssistantPickerOpen,
    focusAssistant,
    setFocusAssistant,
    userInput,
    chatMessages,
    isGenerating,
    selectedPreset,
    selectedAssistant,
    focusPrompt,
    setFocusPrompt,
    focusFile,
    focusTool,
    setFocusTool,
    isToolPickerOpen,
    isPromptPickerOpen,
    setIsPromptPickerOpen,
    isFilePickerOpen,
    setFocusFile,
    chatSettings,
    selectedTools,
    setSelectedTools,
    assistantImages
  } = useContext(ChatbotUIContext)

  const {
    chatInputRef,
    handleSendMessage,
    handleStopMessage,
    handleFocusChatInput
  } = useChatHandler()

  const { handleInputChange } = usePromptAndCommand()

  const { filesToAccept, handleSelectDeviceFiles } = useSelectFileHandler()

  const {
    setNewMessageContentToNextUserMessage,
    setNewMessageContentToPreviousUserMessage
  } = useChatHistoryHandler()

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => {
      handleFocusChatInput()
    }, 200) // FIX: hacky
  }, [selectedPreset, selectedAssistant])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isTyping && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      setIsPromptPickerOpen(false)
      handleSendMessage(userInput, chatMessages, false)
    }

    // Consolidate conditions to avoid TypeScript error
    if (
      isPromptPickerOpen ||
      isFilePickerOpen ||
      isToolPickerOpen ||
      isAssistantPickerOpen
    ) {
      if (
        event.key === "Tab" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
      ) {
        event.preventDefault()
        // Toggle focus based on picker type
        if (isPromptPickerOpen) setFocusPrompt(!focusPrompt)
        if (isFilePickerOpen) setFocusFile(!focusFile)
        if (isToolPickerOpen) setFocusTool(!focusTool)
        if (isAssistantPickerOpen) setFocusAssistant(!focusAssistant)
      }
    }

    if (event.key === "ArrowUp" && event.shiftKey && event.ctrlKey) {
      event.preventDefault()
      setNewMessageContentToPreviousUserMessage()
    }

    if (event.key === "ArrowDown" && event.shiftKey && event.ctrlKey) {
      event.preventDefault()
      setNewMessageContentToNextUserMessage()
    }

    //use shift+ctrl+up and shift+ctrl+down to navigate through chat history
    if (event.key === "ArrowUp" && event.shiftKey && event.ctrlKey) {
      event.preventDefault()
      setNewMessageContentToPreviousUserMessage()
    }

    if (event.key === "ArrowDown" && event.shiftKey && event.ctrlKey) {
      event.preventDefault()
      setNewMessageContentToNextUserMessage()
    }

    if (
      isAssistantPickerOpen &&
      (event.key === "Tab" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown")
    ) {
      event.preventDefault()
      setFocusAssistant(!focusAssistant)
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const imagesAllowed = LLM_LIST.find(
      llm => llm.modelId === chatSettings?.model
    )?.imageInput

    const files: File[] = []
    const items = event.clipboardData.items
    for (const item of items) {
      if (item.type.indexOf("image") === 0) {
        if (!imagesAllowed) {
          toast.error("Images are not supported for the current model.")
          return
        }
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length > 0) void handleSelectDeviceFiles(files)
  }

  return (
    <>
      <div className="flex flex-col flex-wrap justify-center gap-2">
        <ChatFilesDisplay />

        {selectedTools &&
          selectedTools.map((tool, index) => (
            <div key={index} className="flex justify-center">
              <button
                type="button"
                aria-label={`Remove tool ${tool.name}`}
                className="bg-accent text-accent-foreground hover:bg-accent/80 focus-visible:ring-ring flex min-h-9 items-center justify-center gap-1 rounded-md px-3 py-1 focus-visible:outline-none focus-visible:ring-2"
                onClick={() =>
                  setSelectedTools(
                    selectedTools.filter(
                      selectedTool => selectedTool.id !== tool.id
                    )
                  )
                }
              >
                <IconBolt size={20} />
                <span>{tool.name}</span>
              </button>
            </div>
          ))}

        {selectedAssistant && (
          <div className="border-primary mx-auto flex w-fit items-center space-x-2 rounded-lg border p-1.5">
            {selectedAssistant.image_path && (
              <Image
                className="rounded"
                src={
                  assistantImages.find(
                    img => img.path === selectedAssistant.image_path
                  )?.base64
                }
                width={28}
                height={28}
                alt={selectedAssistant.name}
              />
            )}

            <div className="text-sm font-bold">
              Talking to {selectedAssistant.name}
            </div>
          </div>
        )}
      </div>

      <div className="border-border bg-card focus-within:ring-ring/30 relative mt-3 flex min-h-[60px] w-full items-center justify-center rounded-xl border shadow-sm transition-shadow focus-within:ring-2">
        <div className="absolute bottom-[76px] left-0 max-h-[300px] w-full overflow-auto rounded-xl dark:border-none">
          <ChatCommandInput />
        </div>

        <>
          <button
            type="button"
            aria-label="Add attachments"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring absolute bottom-3 left-3 flex size-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <IconCirclePlus />
          </button>

          {/* Hidden input to select files from device */}
          <Input
            ref={fileInputRef}
            className="hidden"
            type="file"
            multiple
            onChange={e => {
              if (!e.target.files) return
              void handleSelectDeviceFiles(e.target.files)
              e.target.value = ""
            }}
            accept={filesToAccept}
          />
        </>

        <TextareaAutosize
          textareaRef={chatInputRef}
          className="ring-offset-background placeholder:text-muted-foreground flex w-full resize-none rounded-md border-none bg-transparent px-14 py-2 text-base focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={t("Ask Matrix anything... (starts a new thread)")}
          onValueChange={handleInputChange}
          value={userInput}
          minRows={1}
          maxRows={18}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsTyping(true)}
          onCompositionEnd={() => setIsTyping(false)}
        />

        <div className="absolute bottom-3 right-3">
          {isGenerating ? (
            <button
              type="button"
              aria-label="Stop generating"
              className="text-destructive hover:bg-destructive/10 focus-visible:ring-ring flex size-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
              onClick={handleStopMessage}
            >
              <IconPlayerStopFilled />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send message"
              disabled={!userInput}
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring flex size-9 items-center justify-center rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handleSendMessage(userInput, chatMessages, false)}
            >
              <IconSend />
            </button>
          )}
        </div>
      </div>
    </>
  )
}
