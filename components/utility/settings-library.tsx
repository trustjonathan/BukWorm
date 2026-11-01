"use client"

import { ChatbotUIContext } from "@/context/context"
import { ContentType, DataListType } from "@/types"
import { FC, useContext, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { SidebarCreateButtons } from "../sidebar/sidebar-create-buttons"
import { SidebarDataList } from "../sidebar/sidebar-data-list"
import { SidebarSearch } from "../sidebar/sidebar-search"

type LibraryType = Exclude<ContentType, "chats">

const LIBRARY_TYPES: { type: LibraryType; label: string }[] = [
  { type: "prompts", label: "Prompts" },
  { type: "presets", label: "Presets" },
  { type: "files", label: "Files" },
  { type: "collections", label: "Collections" },
  { type: "assistants", label: "Assistants" },
  { type: "tools", label: "Tools" },
  { type: "models", label: "Models" }
]

interface SettingsLibraryProps {
  tab: LibraryType
  onTabChange: (tab: LibraryType) => void
}

export const SettingsLibrary: FC<SettingsLibraryProps> = ({
  tab,
  onTabChange
}) => {
  const {
    presets,
    prompts,
    files,
    collections,
    assistants,
    tools,
    models,
    folders
  } = useContext(ChatbotUIContext)

  const [searchTerm, setSearchTerm] = useState("")

  const dataByType: Record<LibraryType, DataListType> = {
    presets,
    prompts,
    files,
    collections,
    assistants,
    tools,
    models
  }

  const getFilteredData = (type: LibraryType): DataListType => {
    const term = searchTerm.toLowerCase()
    switch (type) {
      case "prompts":
        return prompts.filter(item => item.name.toLowerCase().includes(term))
      case "presets":
        return presets.filter(item => item.name.toLowerCase().includes(term))
      case "files":
        return files.filter(item => item.name.toLowerCase().includes(term))
      case "collections":
        return collections.filter(item =>
          item.name.toLowerCase().includes(term)
        )
      case "assistants":
        return assistants.filter(item => item.name.toLowerCase().includes(term))
      case "tools":
        return tools.filter(item => item.name.toLowerCase().includes(term))
      case "models":
        return models.filter(item => item.name.toLowerCase().includes(term))
    }
  }

  return (
    <Tabs
      value={tab}
      onValueChange={value => {
        const selected = LIBRARY_TYPES.find(item => item.type === value)
        if (selected) {
          setSearchTerm("")
          onTabChange(selected.type)
        }
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList
        aria-label="Library resource types"
        className="h-auto w-full justify-start gap-1 overflow-x-auto"
      >
        {LIBRARY_TYPES.map(resource => (
          <TabsTrigger
            key={resource.type}
            value={resource.type}
            className="min-h-9 shrink-0"
          >
            {resource.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {LIBRARY_TYPES.map(resource => {
        const data = dataByType[resource.type]
        const filteredData = getFilteredData(resource.type)
        const resourceFolders = folders.filter(
          folder => folder.type === resource.type
        )

        return (
          <TabsContent
            key={resource.type}
            value={resource.type}
            className="mt-4 flex min-h-0 flex-1 flex-col"
          >
            <SidebarCreateButtons contentType={resource.type} />
            <div className="mt-3">
              <SidebarSearch
                contentType={resource.type}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SidebarDataList
                contentType={resource.type}
                data={filteredData}
                allData={data}
                folders={resourceFolders}
                searchTerm={searchTerm}
              />
            </div>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
