import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { IconMoodSmile, IconRobotFace } from "@tabler/icons-react"
import Image from "next/image"
import { FC, useContext, useEffect, useRef } from "react"
import { usePromptAndCommand } from "./chat-hooks/use-prompt-and-command"

interface AssistantPickerProps {}

export const AssistantPicker: FC<AssistantPickerProps> = ({}) => {
  const {
    assistants,
    assistantImages,
    focusAssistant,
    atCommand,
    isAssistantPickerOpen,
    setIsAssistantPickerOpen,
    selectedWorkspace,
    workspaceMembers,
    setUserInput
  } = useContext(ChatbotUIContext)

  const { handleSelectAssistant } = usePromptAndCommand()

  const itemsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (focusAssistant && itemsRef.current[0]) {
      itemsRef.current[0].focus()
    }
  }, [focusAssistant])

  const filteredAssistants = assistants.filter(assistant =>
    assistant.name.toLowerCase().includes(atCommand.toLowerCase())
  )

  const isGroupWorkspace = selectedWorkspace?.sharing === "shared"
  const mentionOptions = [
    {
      type: "matrix" as const,
      id: "matrix",
      label: "Matrix AI",
      token: "Matrix"
    },
    ...workspaceMembers.map(member => ({
      type: "member" as const,
      id: member.member_user_id,
      label: member.display_name || member.username || "Workspace member",
      token:
        member.username ||
        member.display_name.toLowerCase().replace(/[^a-z0-9_]/g, "") ||
        member.member_user_id.slice(0, 8),
      imageUrl: member.image_url
    }))
  ].filter(
    option =>
      option.label.toLowerCase().includes(atCommand.toLowerCase()) ||
      option.token.toLowerCase().includes(atCommand.toLowerCase())
  )

  const handleOpenChange = (isOpen: boolean) => {
    setIsAssistantPickerOpen(isOpen)
  }

  const selectMention = (token: string) => {
    setUserInput(current => current.replace(/@\S*$/, () => `@${token} `))
    handleOpenChange(false)
  }

  const callSelectAssistant = (assistant: Tables<"assistants">) => {
    handleSelectAssistant(assistant)
    handleOpenChange(false)
  }

  const getKeyDownHandler =
    (index: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault()
        handleOpenChange(false)
      } else if (e.key === "Enter") {
        e.preventDefault()
        callSelectAssistant(filteredAssistants[index])
      } else if (
        (e.key === "Tab" || e.key === "ArrowDown") &&
        !e.shiftKey &&
        index === filteredAssistants.length - 1
      ) {
        e.preventDefault()
        itemsRef.current[0]?.focus()
      } else if (e.key === "ArrowUp" && !e.shiftKey && index === 0) {
        // go to last element if arrow up is pressed on first element
        e.preventDefault()
        itemsRef.current[itemsRef.current.length - 1]?.focus()
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        const prevIndex =
          index - 1 >= 0 ? index - 1 : itemsRef.current.length - 1
        itemsRef.current[prevIndex]?.focus()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        const nextIndex = index + 1 < itemsRef.current.length ? index + 1 : 0
        itemsRef.current[nextIndex]?.focus()
      }
    }

  if (isGroupWorkspace) {
    return (
      <>
        {isAssistantPickerOpen && (
          <div className="bg-background flex flex-col space-y-1 rounded-xl border-2 p-2 text-sm">
            {mentionOptions.length === 0 ? (
              <div className="flex h-14 items-center justify-center text-base italic opacity-70">
                No matching members or Matrix.
              </div>
            ) : (
              mentionOptions.map((option, index) => (
                <div
                  key={option.id}
                  ref={ref => {
                    itemsRef.current[index] = ref
                  }}
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  className="hover:bg-accent focus:bg-accent flex cursor-pointer items-center rounded p-2 focus:outline-none"
                  onClick={() => selectMention(option.token)}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      selectMention(option.token)
                    } else if (
                      event.key === "Escape" ||
                      event.key === "Backspace"
                    ) {
                      handleOpenChange(false)
                    }
                  }}
                >
                  {option.type === "matrix" ? (
                    <Image
                      src="/matrix-logo-light.png"
                      alt=""
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : option.imageUrl ? (
                    <Image
                      src={option.imageUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 rounded-full object-cover"
                    />
                  ) : (
                    <IconMoodSmile size={32} />
                  )}
                  <div className="ml-3 flex min-w-0 flex-col">
                    <div className="truncate font-bold">{option.label}</div>
                    <div className="truncate text-sm opacity-80">
                      @{option.token}
                      {option.type === "matrix" ? " · AI agent" : ""}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {isAssistantPickerOpen && (
        <div className="bg-background flex flex-col space-y-1 rounded-xl border-2 p-2 text-sm">
          {filteredAssistants.length === 0 ? (
            <div className="flex h-14 cursor-pointer items-center justify-center text-base italic hover:opacity-50">
              No matching assistants.
            </div>
          ) : (
            <>
              {filteredAssistants.map((item, index) => (
                <div
                  key={item.id}
                  ref={ref => {
                    itemsRef.current[index] = ref
                  }}
                  tabIndex={0}
                  className="hover:bg-accent focus:bg-accent flex cursor-pointer items-center rounded p-2 focus:outline-none"
                  onClick={() =>
                    callSelectAssistant(item as Tables<"assistants">)
                  }
                  onKeyDown={getKeyDownHandler(index)}
                >
                  {item.image_path ? (
                    <Image
                      src={
                        assistantImages.find(
                          image => image.path === item.image_path
                        )?.url || ""
                      }
                      alt={item.name}
                      width={32}
                      height={32}
                      className="rounded"
                    />
                  ) : (
                    <IconRobotFace size={32} />
                  )}

                  <div className="ml-3 flex flex-col">
                    <div className="font-bold">{item.name}</div>

                    <div className="truncate text-sm opacity-80">
                      {item.description || "No description."}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </>
  )
}
