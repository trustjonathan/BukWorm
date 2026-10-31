"use client"

import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ProfileSettings } from "@/components/utility/profile-settings"
import { ChatbotUIContext } from "@/context/context"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import {
  IconAdjustments,
  IconAdjustmentsHorizontal,
  IconCalendar,
  IconCheck,
  IconDotsVertical,
  IconEdit,
  IconFileText,
  IconFilter,
  IconGridDots,
  IconLayoutSidebar,
  IconLayoutSidebarLeftCollapse,
  IconMenu2,
  IconMessagePlus,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconRobot,
  IconSchool,
  IconSearch,
  IconSettings,
  IconTrash,
  IconUser,
  IconX
} from "@tabler/icons-react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { deleteChat, updateChat } from "@/db/chats"
import { toast } from "sonner"

interface MatrixSidebarProps {
  onClose?: () => void
}

export const MatrixSidebar: FC<MatrixSidebarProps> = ({ onClose }) => {
  const router = useRouter()
  const params = useParams()

  const {
    chats,
    setChats,
    selectedChat,
    setSelectedChat,
    selectedWorkspace,
    profile,
    showSidebar,
    setShowSidebar
  } = useContext(ChatbotUIContext)

  const { handleNewChat } = useChatHandler()

  const [searchTerm, setSearchTerm] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingChatName, setEditingChatName] = useState("")
  const [menuOpenChatId, setMenuOpenChatId] = useState<string | null>(null)

  const currentChatId = (params.chatid as string) || selectedChat?.id

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectChat = (chat: Tables<"chats">) => {
    if (!selectedWorkspace) return
    setSelectedChat(chat)
    router.push(`/${selectedWorkspace.id}/chat/${chat.id}`)
    // Close sidebar on mobile after selection
    if (window.innerWidth < 1024) {
      setShowSidebar(false)
    }
  }

  const handleCreateNewChat = () => {
    handleNewChat()
    if (window.innerWidth < 1024) {
      setShowSidebar(false)
    }
  }

  const handleStartRename = (chat: Tables<"chats">, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingChatId(chat.id)
    setEditingChatName(chat.name)
    setMenuOpenChatId(null)
  }

  const handleSaveRename = async (chatId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!editingChatName.trim()) {
      setEditingChatId(null)
      return
    }

    try {
      const updated = await updateChat(chatId, { name: editingChatName.trim() })
      setChats(prev => prev.map(c => (c.id === chatId ? updated : c)))
      if (selectedChat?.id === chatId) {
        setSelectedChat(updated)
      }
      setEditingChatId(null)
      toast.success("Chat renamed")
    } catch (err: any) {
      toast.error(err.message || "Failed to rename chat")
    }
  }

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenChatId(null)
    if (!confirm("Are you sure you want to delete this chat?")) return

    try {
      await deleteChat(chatId)
      setChats(prev => prev.filter(c => c.id !== chatId))
      if (selectedChat?.id === chatId) {
        setSelectedChat(null)
        if (selectedWorkspace) {
          router.push(`/${selectedWorkspace.id}/chat`)
        }
      }
      toast.success("Chat deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete chat")
    }
  }

  return (
    <aside className="relative flex h-full w-[280px] shrink-0 flex-col border-r border-slate-200 bg-[#f8fafc] text-slate-800 transition-colors dark:border-slate-800 dark:bg-[#090d16] dark:text-slate-200">
      {/* ── Top Header: Brand + Icons ───────────────────────────────────── */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800/80">
        <div
          className="flex cursor-pointer items-center gap-2.5 transition-opacity hover:opacity-85"
          onClick={() => {
            if (selectedWorkspace) router.push(`/${selectedWorkspace.id}/chat`)
          }}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <Image
              src="/matrix.png"
              alt="Matrix AI"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Matrix AI
          </span>
        </div>

        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <button
            onClick={() => setShowSearch(prev => !prev)}
            aria-label="Search chats"
            className="rounded-lg p-1.5 transition-colors hover:bg-slate-200/80 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <IconSearch size={18} />
          </button>

          <button
            onClick={() => {
              setShowSidebar(false)
              localStorage.setItem("showSidebar", "false")
              if (onClose) onClose()
            }}
            aria-label="Collapse sidebar"
            className="rounded-lg p-1.5 transition-colors hover:bg-slate-200/80 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <IconLayoutSidebar size={18} />
          </button>
        </div>
      </div>

      {/* ── Optional Search Bar ────────────────────────────────────────── */}
      {showSearch && (
        <div className="border-b border-slate-200/80 px-3 py-2 dark:border-slate-800/80">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <IconSearch size={14} className="text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent placeholder:text-slate-400 focus:outline-none"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IconX size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Scrollable Body: Nav Items + Chat History ─────────────────── */}
      <div className="flex flex-1 flex-col overflow-y-auto p-3">
        {/* Primary Shortcuts */}
        <div className="space-y-0.5 pb-3">
          <button
            onClick={handleCreateNewChat}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-slate-800/60"
          >
            <IconPlus size={18} className="text-cyan-600 dark:text-cyan-400" />
            <span>New chat</span>
          </button>

          <button
            onClick={() => {
              if (selectedWorkspace)
                router.push(`/${selectedWorkspace.id}/chat?tab=prompts`)
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            <IconGridDots
              size={18}
              className="text-slate-500 dark:text-slate-400"
            />
            <span>Library</span>
          </button>

          <button
            onClick={() => {
              if (selectedWorkspace)
                router.push(`/${selectedWorkspace.id}/chat?tab=files`)
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            <IconPhoto
              size={18}
              className="text-slate-500 dark:text-slate-400"
            />
            <span>Images & Files</span>
          </button>

          <button
            onClick={() => {
              if (selectedWorkspace)
                router.push(`/${selectedWorkspace.id}/chat?tab=assistants`)
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            <IconSchool
              size={18}
              className="text-slate-500 dark:text-slate-400"
            />
            <span>Assistants</span>
          </button>

          <button
            onClick={() => {
              if (selectedWorkspace)
                router.push(`/${selectedWorkspace.id}/chat?tab=tools`)
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            <IconAdjustments
              size={18}
              className="text-slate-500 dark:text-slate-400"
            />
            <span>Customize</span>
          </button>
        </div>

        {/* Section Divider: Chats */}
        <div className="mt-2 flex items-center justify-between px-3 pb-2 pt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="uppercase tracking-wider">Chats</span>
          <IconFilter size={14} className="text-slate-400" />
        </div>

        {/* Chat List (Vertical Scrollable) */}
        <div className="flex-1 space-y-1">
          {filteredChats.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
              {searchTerm ? "No matching chats" : "No conversations yet"}
            </div>
          ) : (
            filteredChats.map(chat => {
              const isActive = chat.id === currentChatId
              const isEditing = editingChatId === chat.id
              const isMenuOpen = menuOpenChatId === chat.id

              return (
                <div key={chat.id} className="group relative">
                  {isEditing ? (
                    <form
                      onSubmit={e => handleSaveRename(chat.id, e)}
                      className="flex items-center gap-1 rounded-xl bg-slate-200/80 px-2.5 py-1.5 dark:bg-slate-800"
                    >
                      <input
                        type="text"
                        value={editingChatName}
                        onChange={e => setEditingChatName(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-slate-900 focus:outline-none dark:text-slate-100"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="rounded p-1 text-emerald-600 hover:bg-slate-300 dark:text-emerald-400 dark:hover:bg-slate-700"
                      >
                        <IconCheck size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingChatId(null)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-300 dark:text-slate-400 dark:hover:bg-slate-700"
                      >
                        <IconX size={14} />
                      </button>
                    </form>
                  ) : (
                    <div
                      onClick={() => handleSelectChat(chat)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between rounded-full px-3.5 py-2 text-sm transition-all duration-150",
                        isActive
                          ? "bg-slate-200/90 font-medium text-slate-900 shadow-sm dark:bg-slate-800/90 dark:text-slate-100"
                          : "text-slate-700 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/40 dark:hover:text-slate-100"
                      )}
                    >
                      <span className="truncate pr-2">{chat.name}</span>

                      {/* Hover action menu button */}
                      <div className="relative shrink-0">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setMenuOpenChatId(isMenuOpen ? null : chat.id)
                          }}
                          className={cn(
                            "rounded-full p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-300 hover:text-slate-700 group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-200",
                            isMenuOpen && "opacity-100"
                          )}
                          aria-label="Chat options"
                        >
                          <IconDotsVertical size={14} />
                        </button>

                        {/* Dropdown menu */}
                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-6 z-30 w-28 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={e => handleStartRename(chat, e)}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <IconPencil size={13} />
                              <span>Rename</span>
                            </button>
                            <button
                              onClick={e => handleDeleteChat(chat.id, e)}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                            >
                              <IconTrash size={13} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Bottom Footer: User Profile Pill + Settings ─────────────────── */}
      <div className="mt-auto border-t border-slate-200/80 p-3 dark:border-slate-800/80">
        <div className="flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm dark:border dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
              {profile?.image_url ? (
                <Image
                  src={profile.image_url}
                  alt={profile.display_name || "User"}
                  width={34}
                  height={34}
                  className="rounded-full object-cover"
                />
              ) : (
                <IconUser
                  size={18}
                  className="text-slate-600 dark:text-slate-400"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                {profile?.display_name ||
                  profile?.username ||
                  "Mwesigwa Jonathan"}
              </div>
              <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                Matrix AI Workspace
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <ProfileSettings />
          </div>
        </div>
      </div>
    </aside>
  )
}
