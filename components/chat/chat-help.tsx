import useHotkey from "@/lib/hooks/use-hotkey"
import {
  IconBrandGithub,
  IconBrandX,
  IconHelpCircle,
  IconQuestionMark
} from "@tabler/icons-react"
import Link from "next/link"
import { FC, useState } from "react"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../ui/dropdown-menu"
import { Announcements } from "../utility/announcements"

interface ChatHelpProps {}

export const ChatHelp: FC<ChatHelpProps> = ({}) => {
  useHotkey("/", () => setIsOpen(prevState => !prevState))

  const [isOpen, setIsOpen] = useState(false)

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="Help and keyboard shortcuts"
        >
          <IconQuestionMark />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <div className="flex space-x-2">
            <Link
              className="cursor-pointer hover:opacity-50"
              aria-label="Follow Matrix AI on X"
              href="https://twitter.com/ChatbotUI"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBrandX />
            </Link>

            <Link
              className="cursor-pointer hover:opacity-50"
              aria-label="Matrix AI GitHub repository"
              href="https://github.com/mckaywrigley/chatbot-ui"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBrandGithub />
            </Link>
          </div>

          <div className="flex space-x-2">
            <Announcements />

            <Link
              className="cursor-pointer hover:opacity-50"
              aria-label="Help"
              href="/help"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconHelpCircle size={24} />
            </Link>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="flex justify-between">
          <div>Show Help</div>
          <div className="flex opacity-60">
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              ⌘
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              Shift
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              /
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem className="flex justify-between">
          <div>Show Workspaces</div>
          <div className="flex opacity-60">
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              ⌘
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              Shift
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              ;
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem className="flex w-[300px] justify-between">
          <div>New Chat</div>
          <div className="flex opacity-60">
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              ⌘
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              Shift
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              O
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem className="flex justify-between">
          <div>Focus Chat</div>
          <div className="flex opacity-60">
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              ⌘
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              Shift
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              L
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem className="flex justify-between">
          <div>Toggle Files</div>
          <div className="flex opacity-60">
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              ⌘
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              Shift
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              F
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem className="flex justify-between">
          <div>Toggle Retrieval</div>
          <div className="flex opacity-60">
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              ⌘
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              Shift
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              E
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem className="flex justify-between">
          <div>Open Settings</div>
          <div className="flex opacity-60">
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              ⌘
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              Shift
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              I
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem className="flex justify-between">
          <div>Open Quick Settings</div>
          <div className="flex opacity-60">
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              ⌘
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              Shift
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              P
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem className="flex justify-between">
          <div>Toggle Sidebar</div>
          <div className="flex opacity-60">
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              ⌘
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              Shift
            </div>
            <div className="min-w-[30px] rounded border-DEFAULT p-1 text-center">
              S
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
