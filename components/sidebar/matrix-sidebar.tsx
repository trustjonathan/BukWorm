"use client"

import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import {
  getChatPreferencesByUserId,
  getWorkspacePreferencesByUserId
} from "@/db/workspace-collaboration"
import { ProfileSettings } from "@/components/utility/profile-settings"
import { WorkspaceSwitcher } from "@/components/utility/workspace-switcher"
import { ChatbotUIContext } from "@/context/context"
import {
  IconChevronDown,
  IconPlus,
  IconSearch,
  IconX
} from "@tabler/icons-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { Button } from "../ui/button"
import { SidebarDataList } from "./sidebar-data-list"
import { toast } from "sonner"
import { Input } from "../ui/input"

interface MatrixSidebarProps {
  onClose?: () => void
}

const RECENT_CHAT_LIMIT = 8

export const MatrixSidebar: FC<MatrixSidebarProps> = ({ onClose }) => {
  const router = useRouter()
  const {
    chats,
    folders,
    profile,
    chatPreferences,
    setChatPreferences,
    setWorkspacePreferences,
    selectedWorkspace,
    setShowSidebar
  } = useContext(ChatbotUIContext)

  const { handleNewChat } = useChatHandler()
  const [searchTerm, setSearchTerm] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [showAllChats, setShowAllChats] = useState(false)
  const [showArchivedChats, setShowArchivedChats] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus()
  }, [isSearchOpen])

  useEffect(() => {
    if (!profile) return
    let active = true

    Promise.all([
      getChatPreferencesByUserId(profile.user_id),
      getWorkspacePreferencesByUserId(profile.user_id)
    ])
      .then(([chatPrefs, workspacePrefs]) => {
        if (!active) return
        setChatPreferences(chatPrefs)
        setWorkspacePreferences(workspacePrefs)
      })
      .catch(error => {
        if (!active) return
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load workspace preferences."
        )
      })

    return () => {
      active = false
    }
  }, [profile?.user_id])

  const chatFolders = folders.filter(folder => folder.type === "chats")
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const visibleChats = chats.filter(chat => {
    const archived = Boolean(
      chatPreferences.find(preference => preference.chat_id === chat.id)
        ?.archived_at
    )
    return archived === showArchivedChats
  })
  const matchingChats = visibleChats.filter(chat =>
    chat.name.toLowerCase().includes(normalizedSearch)
  )
  const sortedChats = [...matchingChats].sort((first, second) => {
    const firstStarred = chatPreferences.some(
      preference => preference.chat_id === first.id && preference.is_starred
    )
    const secondStarred = chatPreferences.some(
      preference => preference.chat_id === second.id && preference.is_starred
    )

    return (
      Number(secondStarred) - Number(firstStarred) ||
      new Date(second.updated_at || second.created_at).getTime() -
        new Date(first.updated_at || first.created_at).getTime()
    )
  })
  const displayedChats =
    showAllChats || normalizedSearch
      ? sortedChats
      : sortedChats.slice(0, RECENT_CHAT_LIMIT)

  const closeOnMobileNavigation = () => {
    if (window.innerWidth >= 1024) return

    if (onClose) {
      onClose()
    } else {
      setShowSidebar(false)
      localStorage.setItem("showSidebar", "false")
    }
  }

  const handleCreateNewChat = () => {
    handleNewChat()
    closeOnMobileNavigation()
  }

  const handleNavigateHome = () => {
    if (!selectedWorkspace) return
    router.push(`/${selectedWorkspace.id}/chat`)
    closeOnMobileNavigation()
  }

  return (
    <aside className="border-border bg-background text-foreground relative flex size-full shrink-0 flex-col border-r transition-colors">
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <button
          type="button"
          aria-label="Go to workspace home"
          className="focus-visible:ring-ring flex items-center gap-2.5 rounded-md text-left transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2"
          onClick={handleNavigateHome}
        >
          <div className="flex size-8 shrink-0 items-center justify-center">
            <Image
              src="/matrix-logo-light.png"
              alt="Matrix AI"
              width={32}
              height={32}
              className="block object-contain dark:hidden"
              priority
            />
            <Image
              src="/matrix-logo-dark.png"
              alt="Matrix AI"
              width={32}
              height={32}
              className="hidden object-contain dark:block"
              priority
            />
          </div>
          <span className="text-foreground text-base font-semibold tracking-tight">
            Matrix AI
          </span>
        </button>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isSearchOpen ? "Close chat search" : "Search chats"}
            title={isSearchOpen ? "Close search" : "Search chats"}
            className="text-muted-foreground size-9 rounded-full"
            onClick={() => {
              if (isSearchOpen) {
                setSearchTerm("")
                setIsSearchOpen(false)
              } else {
                setIsSearchOpen(true)
              }
            }}
          >
            {isSearchOpen ? <IconX size={18} /> : <IconSearch size={18} />}
          </Button>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close sidebar"
              title="Close sidebar"
              className="text-muted-foreground size-9 rounded-full lg:hidden"
              onClick={onClose}
            >
              <IconX size={18} />
            </Button>
          )}
        </div>
      </div>

      {isSearchOpen && (
        <div className="shrink-0 px-3 pb-2">
          <Input
            ref={searchInputRef}
            aria-label="Search chat titles"
            placeholder="Search chats"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Escape") {
                event.preventDefault()
                setSearchTerm("")
                setIsSearchOpen(false)
              }
            }}
            className="h-10 rounded-lg text-[15px]"
          />
        </div>
      )}

      <nav
        aria-label="Workspace navigation"
        className="shrink-0 space-y-0.5 px-3 py-2"
      >
        <Button
          type="button"
          variant="ghost"
          onClick={handleCreateNewChat}
          className="h-11 w-full justify-start gap-3 rounded-lg px-3 text-[15px] font-medium"
        >
          <IconPlus size={19} />
          New chat
        </Button>
        <div className="[&_[data-sidebar-workspace-trigger]]:h-11">
          <WorkspaceSwitcher onNavigate={closeOnMobileNavigation} />
        </div>
      </nav>

      <section
        aria-label="Recent chats"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <SidebarDataList
            contentType="chats"
            data={displayedChats}
            allData={chats}
            folders={chatFolders}
            onNavigate={closeOnMobileNavigation}
            searchTerm={normalizedSearch}
          />
          {!normalizedSearch && visibleChats.length > RECENT_CHAT_LIMIT && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground mt-1 h-10 w-full justify-start rounded-lg px-3 text-sm"
              onClick={() => setShowAllChats(value => !value)}
            >
              {showAllChats ? "Show fewer" : "See all..."}
              <IconChevronDown
                size={16}
                className={`ml-auto transition-transform ${
                  showAllChats ? "rotate-180" : ""
                }`}
              />
            </Button>
          )}
        </div>
      </section>

      <div className="border-border mt-auto shrink-0 border-t p-2">
        <ProfileSettings
          onShowArchived={() => {
            setShowArchivedChats(value => !value)
            setShowAllChats(true)
          }}
          isShowingArchived={showArchivedChats}
        />
      </div>
    </aside>
  )
}
