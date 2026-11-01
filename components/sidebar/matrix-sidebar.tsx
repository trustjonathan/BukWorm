"use client"

import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ProfileSettings } from "@/components/utility/profile-settings"
import { WorkspaceSwitcher } from "@/components/utility/workspace-switcher"
import { WorkspaceSettings } from "@/components/workspace/workspace-settings"
import { ChatbotUIContext } from "@/context/context"
import { cn } from "@/lib/utils"
import { ContentType } from "@/types"
import {
  IconAdjustmentsHorizontal,
  IconBolt,
  IconBooks,
  IconChevronRight,
  IconCube,
  IconFile,
  IconLayoutSidebar,
  IconMessage,
  IconPencil,
  IconPlus,
  IconRobot,
  IconUser
} from "@tabler/icons-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { FC, useContext, useState } from "react"
import { Button } from "../ui/button"
import { SidebarCreateButtons } from "./sidebar-create-buttons"
import { SidebarDataList } from "./sidebar-data-list"
import { SidebarSearch } from "./sidebar-search"

// ─── Section definitions ────────────────────────────────────────────────────

interface SectionDef {
  type: ContentType
  label: string
  icon: typeof IconMessage
}

const SECTIONS: SectionDef[] = [
  { type: "chats", label: "Chats", icon: IconMessage },
  { type: "prompts", label: "Prompts", icon: IconPencil },
  { type: "presets", label: "Presets", icon: IconAdjustmentsHorizontal },
  { type: "files", label: "Files", icon: IconFile },
  { type: "collections", label: "Collections", icon: IconBooks },
  { type: "assistants", label: "Assistants", icon: IconRobot },
  { type: "tools", label: "Tools", icon: IconBolt },
  { type: "models", label: "Models", icon: IconCube }
]

// ─── Component ──────────────────────────────────────────────────────────────

interface MatrixSidebarProps {
  onClose?: () => void
}

export const MatrixSidebar: FC<MatrixSidebarProps> = ({ onClose }) => {
  const router = useRouter()

  const {
    chats,
    presets,
    prompts,
    files,
    collections,
    assistants,
    tools,
    models,
    folders,
    profile,
    selectedWorkspace,
    setShowSidebar
  } = useContext(ChatbotUIContext)

  const { handleNewChat } = useChatHandler()

  // Which accordion section is open (null = all collapsed)
  const [openSection, setOpenSection] = useState<ContentType | null>("chats")

  // Per-section search terms (preserved while sidebar is mounted)
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({})

  // ── Data & folder lookup maps ─────────────────────────────────────────────
  const dataMap: Record<ContentType, any[]> = {
    chats,
    presets,
    prompts,
    files,
    collections,
    assistants,
    tools,
    models
  }

  const folderMap: Record<ContentType, any[]> = {
    chats: folders.filter(f => f.type === "chats"),
    presets: folders.filter(f => f.type === "presets"),
    prompts: folders.filter(f => f.type === "prompts"),
    files: folders.filter(f => f.type === "files"),
    collections: folders.filter(f => f.type === "collections"),
    assistants: folders.filter(f => f.type === "assistants"),
    tools: folders.filter(f => f.type === "tools"),
    models: folders.filter(f => f.type === "models")
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleSection = (type: ContentType) => {
    setOpenSection(prev => (prev === type ? null : type))
  }

  const handleCreateNewChat = () => {
    handleNewChat()
    if (window.innerWidth < 1024) setShowSidebar(false)
  }

  const updateSearchTerm = (type: ContentType, term: string) => {
    setSearchTerms(prev => ({ ...prev, [type]: term }))
  }

  const getFilteredData = (type: ContentType) => {
    const term = (searchTerms[type] || "").toLowerCase()
    const data = dataMap[type]
    if (!term) return data
    return data.filter((item: any) => item.name.toLowerCase().includes(term))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <aside className="border-border bg-background text-foreground relative flex h-full w-[280px] shrink-0 flex-col border-r transition-colors">
      {/* ── Top Header: Brand + Collapse ─────────────────────────────────── */}
      <div className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4">
        <button
          type="button"
          aria-label="Go to workspace home"
          className="focus-visible:ring-ring flex items-center gap-2.5 rounded-md text-left transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2"
          onClick={() => {
            if (selectedWorkspace) router.push(`/${selectedWorkspace.id}/chat`)
          }}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <Image
              src="/matrix-black.png"
              alt="Matrix AI"
              width={24}
              height={24}
              className="block object-contain dark:hidden"
              priority
            />
            <Image
              src="/matrix-white.png"
              alt="Matrix AI"
              width={24}
              height={24}
              className="hidden object-contain dark:block"
              priority
            />
          </div>
          <span className="text-foreground text-base font-semibold tracking-tight">
            Matrix AI
          </span>
        </button>

        <button
          onClick={() => {
            setShowSidebar(false)
            localStorage.setItem("showSidebar", "false")
            if (onClose) onClose()
          }}
          aria-label="Collapse sidebar"
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex size-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          <IconLayoutSidebar size={18} />
        </button>
      </div>

      {/* ── Workspace Switcher + Settings ────────────────────────────────── */}
      <div className="border-border flex shrink-0 items-center gap-1.5 border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          <WorkspaceSwitcher />
        </div>
        <WorkspaceSettings />
      </div>

      {/* ── New Chat (primary action) ────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-2">
        <Button onClick={handleCreateNewChat} className="h-9 w-full gap-2">
          <IconPlus />
          <span>New Chat</span>
        </Button>
      </div>

      {/* ── Scrollable Accordion Sections ────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {SECTIONS.map(section => {
          const isOpen = openSection === section.type
          const SectionIcon = section.icon
          const data = dataMap[section.type]
          const sectionFolders = folderMap[section.type]
          const count = data.length

          return (
            <div
              key={section.type}
              className={cn(
                "border-border/70 border-b",
                isOpen && "flex min-h-0 flex-1 flex-col"
              )}
            >
              {/* Section Header (toggle) */}
              <button
                onClick={() => toggleSection(section.type)}
                className={cn(
                  "focus-visible:ring-ring flex min-h-9 w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                  isOpen
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <IconChevronRight
                  size={14}
                  className={cn(
                    "shrink-0 transition-transform duration-200",
                    isOpen && "rotate-90"
                  )}
                />
                <SectionIcon size={16} className="shrink-0" />
                <span className="flex-1">{section.label}</span>
                {count > 0 && (
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums">
                    {count}
                  </span>
                )}
              </button>

              {/* Section Body (expanded) */}
              {isOpen && (
                <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
                  {/* Create Buttons: "New [Type]" + "New Folder" */}
                  <div className="mt-1 flex items-center">
                    <SidebarCreateButtons
                      contentType={section.type}
                      hasData={count > 0}
                    />
                  </div>

                  {/* Search */}
                  <div className="mt-2">
                    <SidebarSearch
                      contentType={section.type}
                      searchTerm={searchTerms[section.type] || ""}
                      setSearchTerm={(term: string) =>
                        updateSearchTerm(section.type, term)
                      }
                    />
                  </div>

                  {/* Data List (folders, items, drag-drop, date grouping) */}
                  <SidebarDataList
                    contentType={section.type}
                    data={getFilteredData(section.type)}
                    folders={sectionFolders}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Footer: User Profile Pill + Settings ─────────────────────────── */}
      <div className="border-border mt-auto shrink-0 border-t p-3">
        <div className="border-border bg-card flex items-center justify-between rounded-md border p-2 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {profile?.image_url ? (
                <Image
                  src={profile.image_url}
                  alt={profile.display_name || "User"}
                  width={34}
                  height={34}
                  className="rounded-full object-cover"
                />
              ) : (
                <IconUser className="text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-foreground truncate text-xs font-semibold">
                {profile?.display_name || profile?.username || "User"}
              </div>
              <div className="text-muted-foreground truncate text-xs">
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
