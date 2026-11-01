import { ChatbotUIContext } from "@/context/context"
import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import useHotkey from "@/lib/hooks/use-hotkey"
import { IconChevronDown } from "@tabler/icons-react"
import { FC, useContext, useEffect, useRef } from "react"
import { Button } from "../ui/button"
import { ChatSettingsForm } from "../ui/chat-settings-form"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

interface ChatSettingsProps {}

export const ChatSettings: FC<ChatSettingsProps> = ({}) => {
  useHotkey("i", () => handleClick())

  const { chatSettings, setChatSettings, availableHostedModels } =
    useContext(ChatbotUIContext)

  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleClick = () => {
    if (buttonRef.current) {
      buttonRef.current.click()
    }
  }

  useEffect(() => {
    if (!chatSettings) return

    setChatSettings({
      ...chatSettings,
      temperature: Math.min(
        chatSettings.temperature,
        CHAT_SETTING_LIMITS[chatSettings.model]?.MAX_TEMPERATURE || 1
      ),
      contextLength: Math.min(
        chatSettings.contextLength,
        CHAT_SETTING_LIMITS[chatSettings.model]?.MAX_CONTEXT_LENGTH || 4096
      )
    })
  }, [chatSettings?.model])

  if (!chatSettings) return null

  const allModels = availableHostedModels

  const fullModel = allModels.find(llm => llm.modelId === chatSettings.model)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          className="text-muted-foreground hover:text-foreground max-w-[240px] gap-1 px-2 text-sm sm:max-w-[320px]"
          variant="ghost"
          size="sm"
          aria-label={`Choose model and settings: ${fullModel?.modelName || chatSettings.model}`}
        >
          <div className="max-w-[88px] truncate text-sm sm:max-w-[300px] lg:max-w-[500px]">
            {fullModel?.modelName || chatSettings.model}
          </div>

          <IconChevronDown className="shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="bg-background border-input relative flex max-h-[calc(100vh-60px)] w-[300px] flex-col space-y-4 overflow-auto rounded-lg border-2 p-6 sm:w-[350px] md:w-[400px] lg:w-[500px] dark:border-none"
        align="end"
      >
        <ChatSettingsForm
          chatSettings={chatSettings}
          onChangeChatSettings={setChatSettings}
        />
      </PopoverContent>
    </Popover>
  )
}
