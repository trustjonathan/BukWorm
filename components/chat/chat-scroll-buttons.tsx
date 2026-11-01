import { IconChevronDown } from "@tabler/icons-react"
import { FC } from "react"
import { Button } from "../ui/button"

interface ChatScrollButtonsProps {
  isAtBottom: boolean
  isOverflowing: boolean
  scrollToBottom: () => void
}

export const ChatScrollButtons: FC<ChatScrollButtonsProps> = ({
  isAtBottom,
  isOverflowing,
  scrollToBottom
}) => {
  if (isAtBottom || !isOverflowing) return null

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className="border-border bg-background pointer-events-auto size-10 rounded-full border shadow-md"
      aria-label="Jump to latest message"
      onClick={scrollToBottom}
    >
      <IconChevronDown size={16} />
      <span className="sr-only">Jump to latest</span>
    </Button>
  )
}
