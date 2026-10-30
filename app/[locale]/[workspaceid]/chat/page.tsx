"use client"

import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatUI } from "@/components/chat/chat-ui"
import useHotkey from "@/lib/hooks/use-hotkey"

export default function ChatPage() {
  const { handleFocusChatInput } = useChatHandler()

  useHotkey("l", () => handleFocusChatInput())

  return <ChatUI />
}
