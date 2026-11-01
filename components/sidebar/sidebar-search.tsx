import { ContentType } from "@/types"
import { FC } from "react"
import { Input } from "../ui/input"

interface SidebarSearchProps {
  contentType: ContentType
  searchTerm: string
  setSearchTerm: Function
}

export const SidebarSearch: FC<SidebarSearchProps> = ({
  contentType,
  searchTerm,
  setSearchTerm
}) => {
  return (
    <Input
      placeholder={
        contentType === "chats"
          ? "Search chats and messages..."
          : `Search ${contentType}...`
      }
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
    />
  )
}
