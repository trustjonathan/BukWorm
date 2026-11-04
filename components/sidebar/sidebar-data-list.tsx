import { ChatbotUIContext } from "@/context/context"
import { updateAssistant } from "@/db/assistants"
import { updateChat } from "@/db/chats"
import { updateCollection } from "@/db/collections"
import { updateFile } from "@/db/files"
import { updateModel } from "@/db/models"
import { updatePreset } from "@/db/presets"
import { updatePrompt } from "@/db/prompts"
import { updateTool } from "@/db/tools"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import { ContentType, DataItemType, DataListType } from "@/types"
import { IconFolder, IconFolderOff } from "@tabler/icons-react"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "../ui/dropdown-menu"
import { AssistantItem } from "./items/assistants/assistant-item"
import { ChatItem } from "./items/chat/chat-item"
import { CollectionItem } from "./items/collections/collection-item"
import { FileItem } from "./items/files/file-item"
import { Folder } from "./items/folders/folder-item"
import { ModelItem } from "./items/models/model-item"
import { PresetItem } from "./items/presets/preset-item"
import { PromptItem } from "./items/prompts/prompt-item"
import { ToolItem } from "./items/tools/tool-item"

interface SidebarDataListProps {
  contentType: ContentType
  data: DataListType
  allData?: DataListType
  folders: Tables<"folders">[]
  onNavigate?: () => void
  searchTerm?: string
  isSearching?: boolean
}

export const SidebarDataList: FC<SidebarDataListProps> = ({
  contentType,
  data,
  allData,
  folders,
  onNavigate,
  searchTerm = "",
  isSearching = false
}) => {
  const {
    setChats,
    setPresets,
    setPrompts,
    setFiles,
    setCollections,
    setAssistants,
    setTools,
    setModels,
    chatPreferences
  } = useContext(ChatbotUIContext)

  const divRef = useRef<HTMLDivElement>(null)
  const allItems = allData || data

  const [isOverflowing, setIsOverflowing] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const getDataListComponent = (
    contentType: ContentType,
    item: DataItemType
  ) => {
    switch (contentType) {
      case "chats":
        return (
          <ChatItem
            key={item.id}
            chat={item as Tables<"chats">}
            folders={folders}
            onNavigate={onNavigate}
          />
        )

      case "presets":
        return <PresetItem key={item.id} preset={item as Tables<"presets">} />

      case "prompts":
        return <PromptItem key={item.id} prompt={item as Tables<"prompts">} />

      case "files":
        return <FileItem key={item.id} file={item as Tables<"files">} />

      case "collections":
        return (
          <CollectionItem
            key={item.id}
            collection={item as Tables<"collections">}
          />
        )

      case "assistants":
        return (
          <AssistantItem
            key={item.id}
            assistant={item as Tables<"assistants">}
          />
        )

      case "tools":
        return <ToolItem key={item.id} tool={item as Tables<"tools">} />

      case "models":
        return <ModelItem key={item.id} model={item as Tables<"models">} />

      default:
        return null
    }
  }

  const getSortedData = (
    data: any,
    dateCategory: "Today" | "Yesterday" | "Previous 7 days" | "Older"
  ) => {
    const now = new Date()
    const todayStart = new Date(now.setHours(0, 0, 0, 0))
    const yesterdayStart = new Date(
      new Date().setDate(todayStart.getDate() - 1)
    )
    const previousSevenDaysStart = new Date(
      new Date().setDate(todayStart.getDate() - 8)
    )

    return data
      .filter((item: any) => {
        const itemDate = new Date(item.updated_at || item.created_at)
        switch (dateCategory) {
          case "Today":
            return itemDate >= todayStart
          case "Yesterday":
            return itemDate >= yesterdayStart && itemDate < todayStart
          case "Previous 7 days":
            return (
              itemDate >= previousSevenDaysStart && itemDate < yesterdayStart
            )
          case "Older":
            return itemDate < previousSevenDaysStart
          default:
            return true
        }
      })
      .sort(
        (
          a: { id: string; updated_at: string; created_at: string },
          b: { id: string; updated_at: string; created_at: string }
        ) => {
          const aStarred = chatPreferences.some(
            preference => preference.chat_id === a.id && preference.is_starred
          )
          const bStarred = chatPreferences.some(
            preference => preference.chat_id === b.id && preference.is_starred
          )

          return (
            Number(bStarred) - Number(aStarred) ||
            new Date(b.updated_at || b.created_at).getTime() -
              new Date(a.updated_at || a.created_at).getTime()
          )
        }
      )
  }

  const updateFunctions = {
    chats: updateChat,
    presets: updatePreset,
    prompts: updatePrompt,
    files: updateFile,
    collections: updateCollection,
    assistants: updateAssistant,
    tools: updateTool,
    models: updateModel
  }

  const stateUpdateFunctions = {
    chats: setChats,
    presets: setPresets,
    prompts: setPrompts,
    files: setFiles,
    collections: setCollections,
    assistants: setAssistants,
    tools: setTools,
    models: setModels
  }

  const updateFolder = async (itemId: string, folderId: string | null) => {
    const item: any = allItems.find(item => item.id === itemId)

    if (!item) return null

    const updateFunction = updateFunctions[contentType]
    const setStateFunction = stateUpdateFunctions[contentType]

    if (!updateFunction || !setStateFunction) return

    try {
      const updatedItem = await updateFunction(item.id, {
        folder_id: folderId
      })

      setStateFunction((items: any) =>
        items.map((currentItem: any) =>
          currentItem.id === updatedItem.id ? updatedItem : currentItem
        )
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to move item."
      )
    }
  }

  const renderDataItem = (item: DataItemType) => (
    <div key={item.id} className="group/item flex min-w-0 items-center">
      <div
        className="min-w-0 flex-1"
        draggable
        onDragStart={e => handleDragStart(e, item.id)}
      >
        {getDataListComponent(contentType, item)}
      </div>
      {contentType !== "chats" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100"
              aria-label={`Move ${item.name}`}
            >
              <IconFolder size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to folder</DropdownMenuLabel>
            {item.folder_id && (
              <DropdownMenuItem
                onSelect={() => void updateFolder(item.id, null)}
              >
                <IconFolderOff className="mr-2" size={16} />
                Unfile
              </DropdownMenuItem>
            )}
            {folders
              .filter(folder => folder.id !== item.folder_id)
              .map(folder => (
                <DropdownMenuItem
                  key={folder.id}
                  onSelect={() => void updateFolder(item.id, folder.id)}
                >
                  <IconFolder className="mr-2" size={16} />
                  {folder.name}
                </DropdownMenuItem>
              ))}
            {folders.length === 0 && !item.folder_id && (
              <DropdownMenuItem disabled>No folders available</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData("text/plain", id)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    const target = e.target as Element

    if (!target.closest("#folder")) {
      const itemId = e.dataTransfer.getData("text/plain")
      updateFolder(itemId, null)
    }

    setIsDragOver(false)
  }

  useEffect(() => {
    if (divRef.current) {
      setIsOverflowing(
        divRef.current.scrollHeight > divRef.current.clientHeight
      )
    }
  }, [data])

  const dataWithFolders = data.filter(item => item.folder_id)
  const dataWithoutFolders = data.filter(item => item.folder_id === null)

  return (
    <>
      <div
        ref={divRef}
        className="mt-2 flex flex-col overflow-auto"
        onDrop={handleDrop}
      >
        {data.length === 0 && (
          <div className="flex grow flex-col items-center justify-center">
            <div className="text-muted-foreground p-8 text-center text-sm">
              {searchTerm
                ? isSearching
                  ? "Searching messages…"
                  : `No matches for ${searchTerm}`
                : `No ${contentType}.`}
            </div>
          </div>
        )}

        {(dataWithFolders.length > 0 || dataWithoutFolders.length > 0) && (
          <div
            className={`h-full ${
              isOverflowing ? "w-[calc(100%-8px)]" : "w-full"
            } space-y-3 pt-1 ${isOverflowing ? "mr-2" : ""}`}
          >
            {folders.map(folder => (
              <Folder
                key={folder.id}
                folder={folder}
                onUpdateFolder={updateFolder}
                contentType={contentType}
              >
                {dataWithFolders
                  .filter(item => item.folder_id === folder.id)
                  .map(item => renderDataItem(item as DataItemType))}
              </Folder>
            ))}

            {contentType === "chats" ? (
              <>
                {["Today", "Yesterday", "Previous 7 days", "Older"].map(
                  dateCategory => {
                    const sortedData = getSortedData(
                      dataWithoutFolders,
                      dateCategory as
                        | "Today"
                        | "Yesterday"
                        | "Previous 7 days"
                        | "Older"
                    )

                    return (
                      sortedData.length > 0 && (
                        <div key={dateCategory} className="pb-2">
                          <div className="text-muted-foreground mb-1 px-3 text-xs font-normal">
                            {dateCategory}
                          </div>

                          <div
                            className={cn(
                              "flex grow flex-col",
                              isDragOver && "bg-accent"
                            )}
                            onDrop={handleDrop}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                          >
                            {sortedData.map((item: DataItemType) =>
                              renderDataItem(item)
                            )}
                          </div>
                        </div>
                      )
                    )
                  }
                )}
              </>
            ) : (
              <div
                className={cn("flex grow flex-col", isDragOver && "bg-accent")}
                onDrop={handleDrop}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
              >
                {dataWithoutFolders.map(item =>
                  renderDataItem(item as DataItemType)
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className={cn("flex grow", isDragOver && "bg-accent")}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
      />
    </>
  )
}
