import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import { ContentType } from "@/types"
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react"
import { FC, useState } from "react"
import { DeleteFolder } from "./delete-folder"
import { UpdateFolder } from "./update-folder"

interface FolderProps {
  folder: Tables<"folders">
  contentType: ContentType
  children: React.ReactNode
  onUpdateFolder: (itemId: string, folderId: string | null) => void
}

export const Folder: FC<FolderProps> = ({
  folder,
  contentType,
  children,
  onUpdateFolder
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    setIsDragOver(false)
    const itemId = e.dataTransfer.getData("text/plain")
    onUpdateFolder(itemId, folder.id)
  }

  const handleClick = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div
      id="folder"
      className={cn("rounded", isDragOver && "bg-accent")}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocus={() => setIsHovering(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsHovering(false)
        }
      }}
    >
      <div className="hover:bg-accent focus-within:bg-accent flex min-h-9 items-center rounded-md">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name} folder`}
          className="text-foreground focus-visible:ring-ring flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
          onClick={handleClick}
        >
          <span className="flex shrink-0" aria-hidden="true">
            {isExpanded ? <IconChevronDown /> : <IconChevronRight />}
          </span>
          <span className="truncate">{folder.name}</span>
        </button>

        {isHovering && (
          <div className="ml-1 flex shrink-0 items-center gap-1 pr-1">
            <UpdateFolder folder={folder} />
            <DeleteFolder folder={folder} contentType={contentType} />
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="ml-5 mt-2 space-y-2 border-l-2 pl-4">{children}</div>
      )}
    </div>
  )
}
