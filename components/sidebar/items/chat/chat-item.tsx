import { ModelIcon } from "@/components/models/model-icon"
import { ChatbotUIContext } from "@/context/context"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import { LLM } from "@/types"
import { IconRobotFace } from "@tabler/icons-react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { FC, useContext } from "react"
import { Button } from "../../../ui/button"
import { DeleteChat } from "./delete-chat"
import { UpdateChat } from "./update-chat"

interface ChatItemProps {
  chat: Tables<"chats">
  onNavigate?: () => void
}

export const ChatItem: FC<ChatItemProps> = ({ chat, onNavigate }) => {
  const {
    selectedWorkspace,
    selectedChat,
    availableLocalModels,
    assistantImages,
    availableOpenRouterModels
  } = useContext(ChatbotUIContext)

  const router = useRouter()
  const params = useParams()
  const isActive = params.chatid === chat.id || selectedChat?.id === chat.id

  const handleClick = () => {
    if (!selectedWorkspace) return
    router.push(`/${selectedWorkspace.id}/chat/${chat.id}`)
    onNavigate?.()
  }

  const MODEL_DATA = [
    ...LLM_LIST,
    ...availableLocalModels,
    ...availableOpenRouterModels
  ].find(llm => llm.modelId === chat.model) as LLM

  const assistantImage = assistantImages.find(
    image => image.assistantId === chat.assistant_id
  )?.base64

  return (
    <div className="group flex min-w-0 items-center">
      <Button
        type="button"
        variant="ghost"
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "hover:bg-accent h-auto min-h-9 min-w-0 flex-1 justify-start gap-3 rounded-md px-2 py-1.5 text-left hover:opacity-100 focus-visible:ring-2",
          isActive && "bg-accent"
        )}
        onClick={handleClick}
        title={chat.name}
      >
        {chat.assistant_id ? (
          assistantImage ? (
            <Image
              className="size-7 shrink-0 rounded object-cover"
              src={assistantImage}
              alt=""
              width={28}
              height={28}
            />
          ) : (
            <IconRobotFace className="bg-primary text-secondary border-primary size-7 shrink-0 rounded border p-1" />
          )
        ) : (
          <span title={MODEL_DATA?.modelName}>
            <ModelIcon provider={MODEL_DATA?.provider} height={28} width={28} />
          </span>
        )}

        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {chat.name}
        </span>
      </Button>

      <div className="ml-1 flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <UpdateChat chat={chat} />

        <DeleteChat chat={chat} />
      </div>
    </div>
  )
}
