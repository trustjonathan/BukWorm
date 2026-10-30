"use client"

import { ChatbotUIContext } from "@/context/context"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import { LLM, LLMID, MessageImage, ModelProvider } from "@/types"
import { MessageNode } from "@/types/threaded-chat"
import {
  IconArrowBackUp,
  IconBolt,
  IconCaretDownFilled,
  IconCaretRightFilled,
  IconCheck,
  IconCircleFilled,
  IconCopy,
  IconEdit,
  IconFileText,
  IconMessage,
  IconMoodSmile,
  IconPencil,
  IconRepeat,
  IconSend,
  IconX
} from "@tabler/icons-react"
import Image from "next/image"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { BranchElbow } from "./thread-connector"
import { MessageMarkdown } from "./message-markdown"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { WithTooltip } from "../ui/with-tooltip"
import { ModelIcon } from "../models/model-icon"

const ICON_SIZE = 32

interface ThreadedMessageProps {
  node: MessageNode
  /** Flat depth from root (root=0, first reply=1, …) */
  depth?: number
  /** Whether this node is the last child of its parent */
  isLastSibling?: boolean
  /** Called when the user replies in-thread (via swipe-left on agent message or reply action) */
  onReplyInThread: (parentId: string, replyText: string) => void
  onStartEdit: (message: Tables<"messages">) => void
  onCancelEdit: () => void
  onSubmitEdit: (value: string, sequenceNumber: number) => void
  onRegenerate: (ancestorChain: Tables<"messages">[]) => void
  editingMessageId?: string
}

export const ThreadedMessage: FC<ThreadedMessageProps> = ({
  node,
  depth = 0,
  isLastSibling = true,
  onReplyInThread,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onRegenerate,
  editingMessageId
}) => {
  const {
    profile,
    isGenerating,
    firstTokenReceived,
    availableLocalModels,
    availableOpenRouterModels,
    assistants,
    assistantImages,
    selectedAssistant,
    chatImages,
    toolInUse,
    files,
    models
  } = useContext(ChatbotUIContext)

  const { chatMessage, children } = node
  const message = chatMessage.message
  const [isHovering, setIsHovering] = useState(false)
  const [isReplying, setIsReplying] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [showChildren, setShowChildren] = useState(true)
  const [editedMessage, setEditedMessage] = useState(message.content)
  const [viewSources, setViewSources] = useState(false)
  const [showCheckmark, setShowCheckmark] = useState(false)
  const editInputRef = useRef<HTMLTextAreaElement>(null)

  // ── Swipe-to-Reply Gesture State (WhatsApp style) ─────────────────────────
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)
  const isHorizontalSwipe = useRef<boolean | null>(null)
  const SWIPE_THRESHOLD = 50 // px required to activate reply

  const isEditing = editingMessageId === message.id
  const isAssistant = message.role === "assistant"
  const isSystem = message.role === "system"
  const isLastAndGenerating =
    isGenerating && !firstTokenReceived && children.length === 0 && isAssistant

  // ── Swipe Event Handlers ──────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    // Swipe-to-reply is active on agent messages
    if (!isAssistant || isEditing || isGenerating) return

    const target = e.target as HTMLElement
    // Ignore drag start if touching interactive elements like links, buttons, codeblocks
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("textarea") ||
      target.closest("pre") ||
      target.closest("code")
    ) {
      return
    }

    swipeStartX.current = e.clientX
    swipeStartY.current = e.clientY
    isHorizontalSwipe.current = null
    setIsSwiping(true)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (
      !isSwiping ||
      swipeStartX.current === null ||
      swipeStartY.current === null
    )
      return

    const deltaX = e.clientX - swipeStartX.current
    const deltaY = e.clientY - swipeStartY.current

    // Detect direction lock
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY)
      }
    }

    if (!isHorizontalSwipe.current) return

    // Swipe left (negative deltaX)
    if (deltaX < 0) {
      const clamped = Math.max(-80, deltaX)
      setSwipeOffset(clamped)
    } else {
      setSwipeOffset(0)
    }
  }

  const handlePointerEnd = () => {
    if (!isSwiping) return
    setIsSwiping(false)

    if (swipeOffset <= -SWIPE_THRESHOLD) {
      setIsReplying(true)
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(25)
        } catch (_) {}
      }
    }

    setSwipeOffset(0)
    swipeStartX.current = null
    swipeStartY.current = null
    isHorizontalSwipe.current = null
  }

  // ── Derive model / assistant display data ────────────────────────────────
  const MODEL_DATA = [
    ...models.map(m => ({
      modelId: m.model_id as LLMID,
      modelName: m.name,
      provider: "custom" as ModelProvider,
      hostedId: m.id,
      platformLink: "",
      imageInput: false
    })),
    ...LLM_LIST,
    ...availableLocalModels,
    ...availableOpenRouterModels
  ].find(llm => llm.modelId === message.model) as LLM

  const modelDetails = LLM_LIST.find(m => m.modelId === message.model)
  const messageAssistantImage = assistantImages.find(
    img => img.assistantId === message.assistant_id
  )?.base64

  // ── Node dot colors ───────────────────────────────────────────────────────
  const nodeDotClass = isAssistant
    ? "border-cyan-400 text-cyan-400 bg-slate-900"
    : "border-orange-400 text-orange-400 bg-slate-900"

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message.content)
    } else {
      const el = document.createElement("textarea")
      el.value = message.content
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
    }
    setShowCheckmark(true)
  }

  useEffect(() => {
    if (showCheckmark) {
      const t = setTimeout(() => setShowCheckmark(false), 2000)
      return () => clearTimeout(t)
    }
  }, [showCheckmark])

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return
    onReplyInThread(message.id, replyText.trim())
    setReplyText("")
    setIsReplying(false)
  }

  useEffect(() => {
    setEditedMessage(message.content)
    if (isEditing && editInputRef.current) {
      const input = editInputRef.current
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }
  }, [isEditing, message.content])

  return (
    <div className="relative flex w-full flex-col">
      {/* ── Main message row ──────────────────────────────────────────────── */}
      <div
        className="group relative flex gap-3"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Left column: node dot + vertical trunk line */}
        <div className="relative flex shrink-0 flex-col items-center">
          {/* Node dot */}
          <div
            className={cn(
              "z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 shadow-md transition-transform duration-150 group-hover:scale-105",
              nodeDotClass
            )}
          >
            {isSystem ? (
              <IconPencil size={16} />
            ) : isAssistant ? (
              messageAssistantImage ? (
                <Image
                  src={messageAssistantImage}
                  alt="assistant"
                  height={ICON_SIZE}
                  width={ICON_SIZE}
                  className="rounded-full object-cover"
                />
              ) : (
                <ModelIcon
                  provider={modelDetails?.provider ?? "custom"}
                  height={18}
                  width={18}
                />
              )
            ) : profile?.image_url ? (
              <Image
                src={profile.image_url}
                alt="user"
                height={ICON_SIZE}
                width={ICON_SIZE}
                className="rounded-full object-cover"
              />
            ) : (
              <IconMoodSmile size={16} />
            )}
          </div>

          {/* Vertical trunk line (visible when there are children or active inline reply) */}
          {(children.length > 0 || isReplying) && showChildren && (
            <div className="mt-1 w-[2px] flex-1 bg-slate-800 dark:bg-slate-800" />
          )}
        </div>

        {/* Right column: message content with swipe gesture */}
        <div className="mb-4 min-w-0 flex-1">
          {/* Header */}
          <div className="mb-1 flex items-baseline gap-2">
            {isSystem ? (
              <span className="text-sm font-semibold text-slate-300">
                System Prompt
              </span>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-200">
                  {isAssistant
                    ? message.assistant_id
                      ? assistants.find(a => a.id === message.assistant_id)
                          ?.name ?? "Assistant"
                      : selectedAssistant?.name ?? MODEL_DATA?.modelName
                    : profile?.display_name ?? profile?.username ?? "You"}
                </span>
                {isAssistant && (
                  <span className="rounded border border-cyan-800 bg-cyan-950 px-1.5 py-0.5 font-mono text-[10px] text-cyan-400">
                    AGENT NODE
                  </span>
                )}
              </>
            )}
          </div>

          {/* Message Bubble Container with Swipe-to-Reply */}
          <div className="relative overflow-visible">
            {/* Swipe reveal reply indicator on the right edge */}
            {isAssistant && (
              <div
                className={cn(
                  "pointer-events-none absolute right-2 top-1/2 z-0 flex -translate-y-1/2 items-center justify-center transition-all duration-150",
                  swipeOffset < -15
                    ? "scale-100 opacity-100"
                    : "scale-75 opacity-0"
                )}
              >
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border shadow-lg transition-all",
                    swipeOffset <= -SWIPE_THRESHOLD
                      ? "scale-110 border-cyan-300 bg-cyan-500 text-slate-950 shadow-cyan-500/40"
                      : "border-slate-700 bg-slate-800 text-slate-300"
                  )}
                >
                  <IconArrowBackUp size={16} />
                </div>
              </div>
            )}

            {/* Draggable / Swipable Bubble */}
            <div
              className={cn(
                "relative z-[1] select-none rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-sm leading-relaxed text-slate-200 shadow-sm transition-transform",
                isAssistant && "cursor-grab touch-pan-y active:cursor-grabbing"
              )}
              style={{
                transform: `translateX(${swipeOffset}px)`,
                transition: isSwiping
                  ? "none"
                  : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              {isLastAndGenerating ? (
                (() => {
                  switch (toolInUse) {
                    case "none":
                      return (
                        <IconCircleFilled className="animate-pulse" size={20} />
                      )
                    case "retrieval":
                      return (
                        <div className="flex animate-pulse items-center gap-2">
                          <IconFileText size={18} />
                          <span>Searching files…</span>
                        </div>
                      )
                    default:
                      return (
                        <div className="flex animate-pulse items-center gap-2">
                          <IconBolt size={18} />
                          <span>Using {toolInUse}…</span>
                        </div>
                      )
                  }
                })()
              ) : isEditing ? (
                <TextareaAutosize
                  textareaRef={editInputRef}
                  className="text-md w-full bg-transparent"
                  value={editedMessage}
                  onValueChange={setEditedMessage}
                  maxRows={20}
                />
              ) : (
                <MessageMarkdown content={message.content} />
              )}

              {/* Action toolbar — top-right, hover-revealed */}
              <div
                className={cn(
                  "absolute right-2 top-2 z-10 flex items-center gap-1.5 transition-opacity",
                  isHovering || isEditing ? "opacity-100" : "opacity-0"
                )}
              >
                {isEditing ? (
                  <>
                    <button
                      className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                      onClick={() =>
                        onSubmitEdit(editedMessage, message.sequence_number)
                      }
                    >
                      Save
                    </button>
                    <button
                      className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-slate-700"
                      onClick={onCancelEdit}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {/* Reply in-thread button (for desktop click or swipe affordance) */}
                    {isAssistant && !isGenerating && (
                      <WithTooltip
                        side="top"
                        delayDuration={600}
                        display={<div>Reply in thread (or swipe left)</div>}
                        trigger={
                          <IconArrowBackUp
                            size={15}
                            className="cursor-pointer text-slate-400 transition-colors hover:text-cyan-400"
                            onClick={() => setIsReplying(r => !r)}
                          />
                        }
                      />
                    )}

                    {/* Copy */}
                    <WithTooltip
                      side="top"
                      delayDuration={600}
                      display={<div>Copy</div>}
                      trigger={
                        showCheckmark ? (
                          <IconCheck size={15} className="text-emerald-400" />
                        ) : (
                          <IconCopy
                            size={15}
                            className="cursor-pointer text-slate-400 hover:text-slate-200"
                            onClick={handleCopy}
                          />
                        )
                      }
                    />

                    {/* Edit (user only) */}
                    {!isAssistant && !isSystem && (
                      <WithTooltip
                        side="top"
                        delayDuration={600}
                        display={<div>Edit</div>}
                        trigger={
                          <IconEdit
                            size={15}
                            className="cursor-pointer text-slate-400 hover:text-slate-200"
                            onClick={() => onStartEdit(message)}
                          />
                        }
                      />
                    )}

                    {/* Regenerate (last assistant) */}
                    {isAssistant && !isGenerating && (
                      <WithTooltip
                        side="top"
                        delayDuration={600}
                        display={<div>Regenerate</div>}
                        trigger={
                          <IconRepeat
                            size={15}
                            className="cursor-pointer text-slate-400 hover:text-slate-200"
                            onClick={() => onRegenerate([message])}
                          />
                        }
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* File sources section */}
          {node.chatMessage.fileItems.length > 0 && (
            <div className="border-primary mt-3 border-t pt-3 text-sm font-bold">
              {!viewSources ? (
                <div
                  className="flex cursor-pointer items-center hover:opacity-70"
                  onClick={() => setViewSources(true)}
                >
                  {node.chatMessage.fileItems.length} Source
                  {node.chatMessage.fileItems.length > 1 && "s"}
                  <IconCaretRightFilled className="ml-1" size={14} />
                </div>
              ) : (
                <>
                  <div
                    className="flex cursor-pointer items-center hover:opacity-70"
                    onClick={() => setViewSources(false)}
                  >
                    {node.chatMessage.fileItems.length} Source
                    {node.chatMessage.fileItems.length > 1 && "s"}
                    <IconCaretDownFilled className="ml-1" size={14} />
                  </div>
                  <div className="mt-2 space-y-1 text-xs font-normal">
                    {node.chatMessage.fileItems.map((id, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-slate-400"
                      >
                        <IconFileText size={12} />
                        <span>{id}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Thread controls: replies count toggle (No "Add Note" button) */}
          {children.length > 0 && (
            <div className="mt-2 flex items-center justify-end text-xs text-slate-500">
              <button
                className="flex items-center gap-1 font-mono text-[11px] text-cyan-500 hover:underline"
                onClick={() => setShowChildren(s => !s)}
              >
                <IconMessage size={12} />
                {showChildren
                  ? `Hide ${children.length} ${children.length === 1 ? "reply" : "replies"}`
                  : `${children.length} ${children.length === 1 ? "reply" : "replies"} ›`}
              </button>
            </div>
          )}

          {/* Inline reply form (activated via swipe-left on agent message or reply action) */}
          {isReplying && (
            <form
              onSubmit={handleReplySubmit}
              className="animate-in fade-in slide-in-from-top-2 mt-3 flex flex-col gap-2 rounded-xl border border-cyan-500/40 bg-slate-950/85 p-3 shadow-lg shadow-cyan-950/30 duration-150"
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 text-xs text-cyan-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <IconArrowBackUp size={14} className="text-cyan-400" />
                  Replying in thread to{" "}
                  {isAssistant
                    ? selectedAssistant?.name ??
                      MODEL_DATA?.modelName ??
                      "Agent"
                    : "message"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsReplying(false)}
                  className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                >
                  <IconX size={14} />
                </button>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-orange-400/60 bg-slate-900">
                  {profile?.image_url ? (
                    <Image
                      src={profile.image_url}
                      alt="you"
                      height={28}
                      width={28}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <IconMoodSmile size={14} className="text-orange-400" />
                  )}
                </div>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleReplySubmit(e as any)
                    }
                  }}
                  placeholder="Type a reply in this thread... (Enter to send)"
                  rows={2}
                  autoFocus
                  className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:brightness-110 disabled:opacity-40"
                >
                  <IconSend size={12} />
                  <span>Reply</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── Nested children branches ────────────────────────────────────────── */}
      {showChildren && children.length > 0 && (
        <div className="ml-[18px] border-l-2 border-slate-800 pl-5">
          {children.map((child, idx) => (
            <ThreadedMessage
              key={child.chatMessage.message.id}
              node={child}
              depth={depth + 1}
              isLastSibling={idx === children.length - 1}
              onReplyInThread={onReplyInThread}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSubmitEdit={onSubmitEdit}
              onRegenerate={onRegenerate}
              editingMessageId={editingMessageId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
