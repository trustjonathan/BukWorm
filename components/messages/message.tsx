import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import { MessageImage } from "@/types"
import { IconCaretDownFilled, IconCaretRightFilled } from "@tabler/icons-react"
import Image from "next/image"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { Button } from "../ui/button"
import { FileIcon } from "../ui/file-icon"
import { FilePreview } from "../ui/file-preview"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { MessageActions } from "./message-actions"
import { MessageMarkdown } from "./message-markdown"
import { useSmoothedText } from "./use-smoothed-text"

interface MessageProps {
  message: Tables<"messages">
  fileItems: Tables<"file_items">[]
  isEditing: boolean
  isLast: boolean
  onStartEdit: (message: Tables<"messages">) => void
  onCancelEdit: () => void
  onSubmitEdit: (value: string, sequenceNumber: number) => void
}

export const Message: FC<MessageProps> = ({
  message,
  fileItems,
  isEditing,
  isLast,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit
}) => {
  const {
    isGenerating,
    setIsGenerating,
    firstTokenReceived,
    streamRevealSkipped,
    streamingSpeed,
    chatMessages,
    chatImages,
    files
  } = useContext(ChatbotUIContext)

  const { handleSendMessage } = useChatHandler()

  const isStreamingMessage =
    message.role === "assistant" && isLast && isGenerating

  const editInputRef = useRef<HTMLTextAreaElement>(null)

  const [isHovering, setIsHovering] = useState(false)
  const [editedMessage, setEditedMessage] = useState(message.content)

  const [showImagePreview, setShowImagePreview] = useState(false)
  const [selectedImage, setSelectedImage] = useState<MessageImage | null>(null)

  const [showFileItemPreview, setShowFileItemPreview] = useState(false)
  const [selectedFileItem, setSelectedFileItem] =
    useState<Tables<"file_items"> | null>(null)

  const [viewSources, setViewSources] = useState(false)
  const [showGenerationMark, setShowGenerationMark] =
    useState(isStreamingMessage)
  const [hasReceivedToken, setHasReceivedToken] = useState(firstTokenReceived)

  useEffect(() => {
    if (firstTokenReceived) {
      setHasReceivedToken(true)
    } else if (isStreamingMessage) {
      setHasReceivedToken(false)
    }
  }, [firstTokenReceived, isStreamingMessage])

  useEffect(() => {
    if (isStreamingMessage) {
      setShowGenerationMark(true)
      return
    }

    if (!showGenerationMark) return

    const timer = setTimeout(() => setShowGenerationMark(false), 250)
    return () => clearTimeout(timer)
  }, [isStreamingMessage, showGenerationMark])

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message.content)
    } else {
      const textArea = document.createElement("textarea")
      textArea.value = message.content
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
    }
  }

  const handleSendEdit = () => {
    onSubmitEdit(editedMessage, message.sequence_number)
    onCancelEdit()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isEditing && event.key === "Enter" && event.metaKey) {
      handleSendEdit()
    }
  }

  const handleRegenerate = async () => {
    setIsGenerating(true)
    await handleSendMessage(
      editedMessage || chatMessages[chatMessages.length - 2].message.content,
      chatMessages,
      true
    )
  }

  const handleStartEdit = () => {
    onStartEdit(message)
  }

  const displayed = useSmoothedText(
    message.content,
    isStreamingMessage,
    message.id,
    streamRevealSkipped,
    streamingSpeed
  )
  const isRevealInProgress = displayed.text !== message.content

  useEffect(() => {
    setEditedMessage(message.content)

    if (isEditing && editInputRef.current) {
      const input = editInputRef.current
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }
  }, [isEditing])

  const fileAccumulator: Record<
    string,
    {
      id: string
      name: string
      count: number
      type: string
      description: string
    }
  > = {}

  const fileSummary = fileItems.reduce((acc, fileItem) => {
    const parentFile = files.find(file => file.id === fileItem.file_id)
    if (parentFile) {
      if (!acc[parentFile.id]) {
        acc[parentFile.id] = {
          id: parentFile.id,
          name: parentFile.name,
          count: 1,
          type: parentFile.type,
          description: parentFile.description
        }
      } else {
        acc[parentFile.id].count += 1
      }
    }
    return acc
  }, fileAccumulator)

  return (
    <div
      className={cn(
        "group flex w-full flex-col py-2",
        message.role === "user" && "items-end",
        message.role === "system" && "items-center"
      )}
      data-message-id={message.id}
      data-message-role={message.role}
      onClick={isStreamingMessage ? displayed.skipReveal : undefined}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocus={() => setIsHovering(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsHovering(false)
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          "flex w-full flex-col",
          message.role === "user" &&
            "bg-muted text-foreground max-w-[80%] rounded-lg px-4 py-3",
          message.role === "system" && "max-w-full items-center text-center"
        )}
      >
        <div className="space-y-3">
          {message.role === "system" && (
            <div className="text-muted-foreground text-sm font-medium">
              Prompt
            </div>
          )}
          {isEditing ? (
            <TextareaAutosize
              textareaRef={editInputRef}
              className="text-base"
              value={editedMessage}
              onValueChange={setEditedMessage}
              maxRows={20}
            />
          ) : (
            <>
              {showGenerationMark && !hasReceivedToken && (
                <GenerationMark isActive={isStreamingMessage} mode="thinking" />
              )}
              <MessageMarkdown
                content={displayed.text}
                isStreaming={isStreamingMessage || isRevealInProgress}
                newTextStart={displayed.newTextStart}
                newTextKind={displayed.newTextKind}
                trailingIndicator={
                  showGenerationMark && hasReceivedToken ? (
                    <GenerationMark
                      isActive={isStreamingMessage}
                      mode="streaming"
                    />
                  ) : undefined
                }
              />
            </>
          )}
        </div>

        {fileItems.length > 0 && (
          <div className="border-border mt-4 border-t pt-3">
            {!viewSources ? (
              <button
                type="button"
                aria-expanded={false}
                className="text-muted-foreground hover:text-foreground flex min-h-9 items-center text-sm font-medium"
                onClick={() => setViewSources(true)}
              >
                {fileItems.length}
                {fileItems.length > 1 ? " Sources " : " Source "}
                from {Object.keys(fileSummary).length}{" "}
                {Object.keys(fileSummary).length > 1 ? "Files" : "File"}{" "}
                <IconCaretRightFilled className="ml-1" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  aria-expanded={true}
                  className="text-muted-foreground hover:text-foreground flex min-h-9 items-center text-sm font-medium"
                  onClick={() => setViewSources(false)}
                >
                  {fileItems.length}
                  {fileItems.length > 1 ? " Sources " : " Source "}
                  from {Object.keys(fileSummary).length}{" "}
                  {Object.keys(fileSummary).length > 1 ? "Files" : "File"}{" "}
                  <IconCaretDownFilled className="ml-1" />
                </button>

                <div className="mt-3 space-y-4">
                  {Object.values(fileSummary).map((file, index) => (
                    <div key={index}>
                      <div className="flex items-center space-x-2">
                        <div>
                          <FileIcon type={file.type} />
                        </div>

                        <div className="truncate">{file.name}</div>
                      </div>

                      {fileItems
                        .filter(fileItem => {
                          const parentFile = files.find(
                            parentFile => parentFile.id === fileItem.file_id
                          )
                          return parentFile?.id === file.id
                        })
                        .map((fileItem, index) => (
                          <button
                            type="button"
                            aria-label={`Preview source from ${file.name}`}
                            key={index}
                            className="text-muted-foreground hover:text-foreground ml-8 mt-1.5 flex min-h-9 items-center space-x-2 text-left"
                            onClick={() => {
                              setSelectedFileItem(fileItem)
                              setShowFileItemPreview(true)
                            }}
                          >
                            <div className="text-sm font-normal">
                              <span className="mr-1 text-lg font-bold">-</span>{" "}
                              {fileItem.content.substring(0, 200)}...
                            </div>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {message.image_paths.map((path, index) => {
            const item = chatImages.find(image => image.path === path)

            return (
              <button
                type="button"
                key={index}
                aria-label={`Open image attachment ${index + 1}`}
                className="focus-visible:ring-ring min-h-9 rounded focus-visible:outline-none focus-visible:ring-2"
                onClick={() => {
                  setSelectedImage({
                    messageId: message.id,
                    path,
                    base64: path.startsWith("data") ? path : item?.base64 || "",
                    url: path.startsWith("data") ? "" : item?.url || "",
                    file: null
                  })

                  setShowImagePreview(true)
                }}
              >
                <Image
                  className="rounded hover:opacity-80"
                  src={path.startsWith("data") ? path : item?.base64}
                  alt=""
                  width={300}
                  height={300}
                  loading="lazy"
                />
              </button>
            )
          })}
        </div>
        {isEditing && (
          <div className="mt-4 flex justify-center space-x-2">
            <Button size="sm" onClick={handleSendEdit}>
              Save & Send
            </Button>

            <Button size="sm" variant="outline" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        )}
        <div
          className={cn(
            "mt-1 flex transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
            message.role === "user" ? "justify-end" : "justify-start",
            isHovering ? "min-h-8 opacity-100" : "hidden opacity-0"
          )}
        >
          <MessageActions
            onCopy={handleCopy}
            onEdit={handleStartEdit}
            isAssistant={message.role === "assistant"}
            isLast={isLast}
            isEditing={isEditing}
            isHovering={isHovering}
            onRegenerate={handleRegenerate}
          />
        </div>
      </div>

      {showImagePreview && selectedImage && (
        <FilePreview
          type="image"
          item={selectedImage}
          isOpen={showImagePreview}
          onOpenChange={(isOpen: boolean) => {
            setShowImagePreview(isOpen)
            setSelectedImage(null)
          }}
        />
      )}

      {showFileItemPreview && selectedFileItem && (
        <FilePreview
          type="file_item"
          item={selectedFileItem}
          isOpen={showFileItemPreview}
          onOpenChange={(isOpen: boolean) => {
            setShowFileItemPreview(isOpen)
            setSelectedFileItem(null)
          }}
        />
      )}
    </div>
  )
}

const GenerationMark: FC<{
  isActive: boolean
  mode: "thinking" | "streaming"
}> = ({ isActive, mode }) => (
  <span
    className={cn(
      "bg-background text-foreground ring-ring/50 duration-250 relative inline-flex shrink-0 items-center justify-center rounded-full align-middle shadow-sm ring-2 transition-[opacity,transform]",
      mode === "thinking" ? "size-9" : "size-7",
      isActive ? "animate-matrix-mark opacity-100" : "scale-75 opacity-0"
    )}
    aria-hidden="true"
  >
    <span className="matrix-mark-ring" />
    <Image
      src="/matrix-black.png"
      alt=""
      width={mode === "thinking" ? 30 : 24}
      height={mode === "thinking" ? 30 : 24}
      className={cn(
        "relative z-[1] object-contain dark:hidden",
        mode === "thinking" ? "size-[30px]" : "size-6"
      )}
    />
    <Image
      src="/matrix-white.png"
      alt=""
      width={mode === "thinking" ? 30 : 24}
      height={mode === "thinking" ? 30 : 24}
      className={cn(
        "relative z-[1] hidden object-contain dark:block",
        mode === "thinking" ? "size-[30px]" : "size-6"
      )}
    />
  </span>
)
