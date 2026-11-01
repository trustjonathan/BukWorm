import { ChatbotUIContext } from "@/context/context"
import {
  type UIEventHandler,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react"

export const useScroll = () => {
  const { isGenerating, chatMessages } = useContext(ChatbotUIContext)

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(false)
  const lastAutoScrolledUserId = useRef<string | null>(null)

  const [isAtBottom, setIsAtBottom] = useState(true)
  const [userScrolled, setUserScrolled] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  const scrollToBottom = useCallback(() => {
    isAutoScrolling.current = true
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" })
    setIsAtBottom(true)
    setUserScrolled(false)
    requestAnimationFrame(() => {
      isAutoScrolling.current = false
    })
  }, [])

  const scrollLatestUserNearTop = useCallback(() => {
    const latestUserMessage = [...chatMessages]
      .reverse()
      .find(({ message }) => message.role === "user")
    const container = messagesContainerRef.current
    if (!latestUserMessage || !container) return

    const messageElement = Array.from(
      container.querySelectorAll<HTMLElement>("[data-message-id]")
    ).find(
      element => element.dataset.messageId === latestUserMessage.message.id
    )
    if (!messageElement) return

    isAutoScrolling.current = true
    messageElement.scrollIntoView({ behavior: "instant", block: "start" })
    setIsAtBottom(false)
    setUserScrolled(true)
    requestAnimationFrame(() => {
      isAutoScrolling.current = false
    })
  }, [chatMessages])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      setIsOverflowing(container.scrollHeight > container.clientHeight)
    }

    if (chatMessages.length === 0) {
      lastAutoScrolledUserId.current = null
      return
    }

    const latestUserMessage = [...chatMessages]
      .reverse()
      .find(({ message }) => message.role === "user")

    if (
      isGenerating &&
      latestUserMessage &&
      lastAutoScrolledUserId.current !== latestUserMessage.message.id
    ) {
      lastAutoScrolledUserId.current = latestUserMessage.message.id
      scrollLatestUserNearTop()
      return
    }

    if (isGenerating && isAtBottom && !userScrolled) {
      scrollToBottom()
    }
  }, [
    chatMessages,
    isAtBottom,
    isGenerating,
    scrollLatestUserNearTop,
    scrollToBottom,
    userScrolled
  ])

  const handleScroll: UIEventHandler<HTMLDivElement> = useCallback(event => {
    const target = event.currentTarget
    const bottom =
      Math.ceil(target.scrollTop + target.clientHeight) >=
      target.scrollHeight - 2
    setIsAtBottom(bottom)

    if (!bottom && !isAutoScrolling.current) {
      setUserScrolled(true)
    } else if (bottom) {
      setUserScrolled(false)
    }

    setIsOverflowing(target.scrollHeight > target.clientHeight)
  }, [])

  return {
    messagesContainerRef,
    messagesEndRef,
    isAtBottom,
    userScrolled,
    isOverflowing,
    handleScroll,
    scrollToBottom,
    setIsAtBottom
  }
}
