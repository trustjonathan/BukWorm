import { ChatbotUIContext } from "@/context/context"
import { IconCheck, IconCopy, IconEdit, IconRepeat } from "@tabler/icons-react"
import { FC, useContext, useEffect, useState } from "react"
import { Button } from "../ui/button"

export const MESSAGE_ICON_SIZE = 18

interface MessageActionsProps {
  isAssistant: boolean
  isLast: boolean
  isEditing: boolean
  isHovering: boolean
  onCopy: () => void
  onEdit: () => void
  onRegenerate: () => void
}

export const MessageActions: FC<MessageActionsProps> = ({
  isAssistant,
  isLast,
  isEditing,
  isHovering,
  onCopy,
  onEdit,
  onRegenerate
}) => {
  const { isGenerating } = useContext(ChatbotUIContext)

  const [showCheckmark, setShowCheckmark] = useState(false)

  const handleCopy = () => {
    onCopy()
    setShowCheckmark(true)
  }

  useEffect(() => {
    if (showCheckmark) {
      const timer = setTimeout(() => {
        setShowCheckmark(false)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [showCheckmark])

  return (isLast && isGenerating) || isEditing ? null : (
    <div className="text-muted-foreground flex items-center gap-1">
      {!isAssistant && isHovering && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Edit message"
          onClick={onEdit}
        >
          <IconEdit />
        </Button>
      )}

      {(isHovering || isLast) && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={showCheckmark ? "Copied" : "Copy message"}
          onClick={handleCopy}
          disabled={showCheckmark}
        >
          {showCheckmark ? <IconCheck /> : <IconCopy />}
        </Button>
      )}

      {isLast && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Regenerate response"
          onClick={onRegenerate}
        >
          <IconRepeat />
        </Button>
      )}
    </div>
  )
}
