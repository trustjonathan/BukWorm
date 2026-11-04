import { ChatbotUIContext } from "@/context/context"
import { saveChatPreference } from "@/db/workspace-collaboration"
import { updateChat } from "@/db/chats"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import {
  IconArchive,
  IconArrowRight,
  IconDotsVertical,
  IconFolder,
  IconFolderOff,
  IconShare,
  IconStar
} from "@tabler/icons-react"
import { useParams, useRouter } from "next/navigation"
import { FC, useContext, useState } from "react"
import { toast } from "sonner"
import { Button } from "../../../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../../../ui/dropdown-menu"
import { DeleteChat } from "./delete-chat"
import { UpdateChat } from "./update-chat"

interface ChatItemProps {
  chat: Tables<"chats">
  folders: Tables<"folders">[]
  onNavigate?: () => void
}

export const ChatItem: FC<ChatItemProps> = ({ chat, folders, onNavigate }) => {
  const {
    selectedWorkspace,
    selectedChat,
    profile,
    workspaces,
    workspaceRoles,
    workspacePreferences,
    chatPreferences,
    setChatPreferences,
    setChats,
    setSelectedWorkspace,
    setIsTemporaryChat
  } = useContext(ChatbotUIContext)

  const router = useRouter()
  const params = useParams()
  const isActive = params.chatid === chat.id || selectedChat?.id === chat.id
  const preference = chatPreferences.find(item => item.chat_id === chat.id)
  const [isMoving, setIsMoving] = useState(false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const role = workspaceRoles[chat.workspace_id]
  const canEditWorkspace =
    role === "owner" || role === "admin" || role === "editor"
  const canManageWorkspace = role === "owner" || role === "admin"
  const canEditChat =
    canManageWorkspace ||
    (chat.user_id === profile?.user_id && canEditWorkspace)
  const canDeleteChat =
    canManageWorkspace ||
    (chat.user_id === profile?.user_id && canEditWorkspace)

  const handleClick = () => {
    if (!selectedWorkspace) return
    setIsTemporaryChat(false)
    router.push(`/${selectedWorkspace.id}/chat/${chat.id}`)
    onNavigate?.()
  }

  const updatePreference = async (
    changes: Partial<
      Pick<Tables<"chat_user_preferences">, "is_starred" | "archived_at">
    >
  ) => {
    if (!profile) return

    try {
      const updated = await saveChatPreference({
        chat_id: chat.id,
        user_id: profile.user_id,
        is_starred: changes.is_starred ?? preference?.is_starred ?? false,
        archived_at:
          changes.archived_at !== undefined
            ? changes.archived_at
            : preference?.archived_at ?? null,
        updated_at: new Date().toISOString()
      })
      setChatPreferences(current => [
        updated,
        ...current.filter(item => item.chat_id !== chat.id)
      ])
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update chat preferences."
      )
    }
  }

  const handleMoveChat = async (workspaceId: string) => {
    const targetWorkspace = workspaces.find(
      workspace => workspace.id === workspaceId
    )
    if (!targetWorkspace || !selectedWorkspace) return

    if (
      !window.confirm(
        `Move "${chat.name}" to ${targetWorkspace.name}? Messages and attachments will stay with the chat.`
      )
    ) {
      return
    }

    setIsMoving(true)
    try {
      await updateChat(chat.id, {
        workspace_id: targetWorkspace.id,
        folder_id: null
      })
      setChats(current => current.filter(item => item.id !== chat.id))
      setSelectedWorkspace(targetWorkspace)
      router.push(`/${targetWorkspace.id}/chat/${chat.id}`)
      onNavigate?.()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not move this chat."
      )
    } finally {
      setIsMoving(false)
    }
  }

  const handleMoveToFolder = async (folderId: string | null) => {
    try {
      const updatedChat = await updateChat(chat.id, { folder_id: folderId })
      setChats(current =>
        current.map(item => (item.id === updatedChat.id ? updatedChat : item))
      )
      toast.success(
        folderId ? "Chat moved to folder." : "Chat removed from folder."
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not move this chat."
      )
    }
  }

  const handleShareChat = async () => {
    try {
      const chatUrl = new URL(
        `/${chat.workspace_id}/chat/${chat.id}`,
        window.location.origin
      ).toString()
      await navigator.clipboard.writeText(chatUrl)
      toast.success(
        selectedWorkspace?.sharing === "shared"
          ? "Chat link copied. Workspace access is still required."
          : "Chat link copied. Only people with workspace access can open it."
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not copy the chat link."
      )
    }
  }

  return (
    <div
      className="chat-row group/chat-row flex min-w-0 items-center"
      data-active={isActive ? "true" : "false"}
    >
      <Button
        type="button"
        variant="ghost"
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "hover:bg-muted h-11 min-w-0 flex-1 justify-start rounded-lg px-3 text-left text-[15px] font-normal focus-visible:ring-2",
          isActive && "bg-muted"
        )}
        onClick={handleClick}
        title={chat.name}
      >
        <span className="min-w-0 flex-1 truncate">{chat.name}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="chat-row-actions size-9 shrink-0 opacity-0 focus-visible:opacity-100 focus-visible:ring-2 group-focus-within/chat-row:opacity-100 group-hover/chat-row:opacity-100"
            aria-label={`More actions for ${chat.name}`}
            title="More actions"
          >
            <IconDotsVertical size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => void handleShareChat()}>
            <IconShare className="mr-2" size={16} />
            Share chat link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              void updatePreference({
                is_starred: !preference?.is_starred
              })
            }
          >
            <IconStar
              className="mr-2"
              size={16}
              fill={preference?.is_starred ? "currentColor" : "none"}
            />
            {preference?.is_starred ? "Unpin chat" : "Pin chat"}
          </DropdownMenuItem>
          {canEditChat && (
            <DropdownMenuItem onSelect={() => setIsRenameOpen(true)}>
              Rename
            </DropdownMenuItem>
          )}
          {canEditChat && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconFolder className="mr-2" size={16} />
                Move to folder
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {chat.folder_id && (
                  <DropdownMenuItem
                    onSelect={() => void handleMoveToFolder(null)}
                  >
                    <IconFolderOff className="mr-2" size={16} />
                    Remove from folder
                  </DropdownMenuItem>
                )}
                {folders
                  .filter(folder => folder.id !== chat.folder_id)
                  .map(folder => (
                    <DropdownMenuItem
                      key={folder.id}
                      onSelect={() => void handleMoveToFolder(folder.id)}
                    >
                      <IconFolder className="mr-2" size={16} />
                      {folder.name}
                    </DropdownMenuItem>
                  ))}
                {folders.length === 0 && !chat.folder_id && (
                  <DropdownMenuItem disabled>
                    No folders available
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {chat.user_id === profile?.user_id &&
            canEditWorkspace &&
            workspaces.length > 1 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <IconArrowRight className="mr-2" size={16} />
                  Move to workspace
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {workspaces
                    .filter(
                      workspace =>
                        workspace.id !== chat.workspace_id &&
                        (workspaceRoles[workspace.id] === "owner" ||
                          workspaceRoles[workspace.id] === "admin" ||
                          workspaceRoles[workspace.id] === "editor") &&
                        !workspacePreferences.find(
                          item =>
                            item.workspace_id === workspace.id &&
                            item.archived_at
                        )
                    )
                    .map(workspace => (
                      <DropdownMenuItem
                        key={workspace.id}
                        disabled={isMoving}
                        onSelect={() => void handleMoveChat(workspace.id)}
                      >
                        {workspace.name}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
          <DropdownMenuItem
            onSelect={() =>
              void updatePreference({
                archived_at: preference?.archived_at
                  ? null
                  : new Date().toISOString()
              })
            }
          >
            <IconArchive className="mr-2" size={16} />
            {preference?.archived_at ? "Restore from archive" : "Archive"}
          </DropdownMenuItem>
          {canDeleteChat && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setIsDeleteOpen(true)}
            >
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canEditChat && (
        <UpdateChat
          chat={chat}
          open={isRenameOpen}
          onOpenChange={setIsRenameOpen}
          showTrigger={false}
        />
      )}
      {canDeleteChat && (
        <DeleteChat
          chat={chat}
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          showTrigger={false}
        />
      )}
    </div>
  )
}
