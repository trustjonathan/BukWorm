"use client"

import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import {
  getChatPreferencesByUserId,
  getWorkspacePreferencesByUserId
} from "@/db/workspace-collaboration"
import { ProfileSettings } from "@/components/utility/profile-settings"
import { WorkspaceSwitcher } from "@/components/utility/workspace-switcher"
import { ChatbotUIContext } from "@/context/context"
import { IconLayoutSidebar, IconMessage, IconPlus } from "@tabler/icons-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
import { Button } from "../ui/button"
import { SidebarDataList } from "./sidebar-data-list"
import { SidebarSearch } from "./sidebar-search"
import { toast } from "sonner"

interface MatrixSidebarProps {
  onClose?: () => void
}

const RECENT_CHAT_LIMIT = 10

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
  const [showAllChats, setShowAllChats] = useState(false)
  const [showArchivedChats, setShowArchivedChats] = useState(false)

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

  const updateSidebarVisibility = (visible: boolean) => {
    if (onClose && !visible) {
      onClose()
      return
    }

    setShowSidebar(visible)
    localStorage.setItem("showSidebar", String(visible))
  }

  return (
    <aside className="border-border bg-background text-foreground relative flex h-full w-[280px] shrink-0 flex-col border-r transition-colors">
      <div className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4">
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

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Collapse sidebar"
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring size-9"
          onClick={() => updateSidebarVisibility(false)}
        >
          <IconLayoutSidebar size={18} />
        </Button>
      </div>

      <div className="shrink-0 space-y-2 p-3">
        <Button
          type="button"
          onClick={handleCreateNewChat}
          className="h-9 w-full gap-2"
        >
          <IconPlus size={16} />
          New Chat
        </Button>
        <SidebarSearch
          contentType="chats"
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      </div>

      <div className="border-border flex shrink-0 items-center gap-1.5 border-y px-3 py-2">
        <div className="min-w-0 flex-1">
          <WorkspaceSwitcher onNavigate={closeOnMobileNavigation} />
        </div>
      </div>

      <section
        aria-label="Recent chats"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3">
          <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <IconMessage size={15} />
            {showArchivedChats ? "Archived" : "Recents"}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-8 px-1 text-xs"
              onClick={() => {
                setShowArchivedChats(value => !value)
                setShowAllChats(false)
              }}
            >
              {showArchivedChats ? "Active" : "Archived"}
            </Button>
            {!normalizedSearch && visibleChats.length > RECENT_CHAT_LIMIT && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-8 px-1 text-xs"
                onClick={() => setShowAllChats(value => !value)}
              >
                {showAllChats ? "Show recent" : "View all"}
              </Button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <SidebarDataList
            contentType="chats"
            data={displayedChats}
            allData={chats}
            folders={chatFolders}
            onNavigate={closeOnMobileNavigation}
            searchTerm={normalizedSearch}
          />
        </div>
      </section>

      <div className="border-border mt-auto shrink-0 border-t p-2">
        <ProfileSettings />
      </div>
    </aside>
  )
}
