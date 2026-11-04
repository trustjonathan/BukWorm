import { ChatbotUIContext } from "@/context/context"
import { getAssistantCollectionsByAssistantId } from "@/db/assistant-collections"
import { getAssistantFilesByAssistantId } from "@/db/assistant-files"
import { getAssistantToolsByAssistantId } from "@/db/assistant-tools"
import { getCollectionFilesByCollectionId } from "@/db/collection-files"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { getDefaultModelId } from "@/lib/models/llm/llm-list"
import { Tables } from "@/supabase/types"
import { IconChevronDown, IconRobotFace } from "@tabler/icons-react"
import Image from "next/image"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ModelIcon } from "../models/model-icon"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../ui/dropdown-menu"
import { Input } from "../ui/input"
import { QuickSettingOption } from "./quick-setting-option"

interface QuickSettingsProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const QuickSettings: FC<QuickSettingsProps> = ({
  open,
  onOpenChange
}) => {
  const { t } = useTranslation()

  const {
    presets,
    assistants,
    selectedAssistant,
    selectedPreset,
    chatSettings,
    streamingSpeed,
    setStreamingSpeed,
    setSelectedPreset,
    setSelectedAssistant,
    setChatSettings,
    assistantImages,
    setChatFiles,
    setSelectedTools,
    setShowFilesDisplay,
    selectedWorkspace,
    profile
  } = useContext(ChatbotUIContext)

  const inputRef = useRef<HTMLInputElement>(null)

  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const changeOpen = (nextOpen: boolean) => {
    setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100) // FIX: hacky
    }
  }, [isOpen])

  const handleSelectQuickSetting = async (
    item: Tables<"presets"> | Tables<"assistants"> | null,
    contentType: "presets" | "assistants" | "remove"
  ) => {
    console.log({ item, contentType })
    if (contentType === "assistants" && item) {
      setSelectedAssistant(item as Tables<"assistants">)
      setLoading(true)
      let allFiles = []
      const assistantFiles = (await getAssistantFilesByAssistantId(item.id))
        .files
      allFiles = [...assistantFiles]
      const assistantCollections = (
        await getAssistantCollectionsByAssistantId(item.id)
      ).collections
      for (const collection of assistantCollections) {
        const collectionFiles = (
          await getCollectionFilesByCollectionId(collection.id)
        ).files
        allFiles = [...allFiles, ...collectionFiles]
      }
      const assistantTools = (await getAssistantToolsByAssistantId(item.id))
        .tools
      setSelectedTools(assistantTools)
      setChatFiles(
        allFiles.map(file => ({
          id: file.id,
          name: file.name,
          type: file.type,
          file: null
        }))
      )
      if (allFiles.length > 0) setShowFilesDisplay(true)
      setLoading(false)
      setSelectedPreset(null)
    } else if (contentType === "presets" && item) {
      setSelectedPreset(item as Tables<"presets">)
      setSelectedAssistant(null)
      setChatFiles([])
      setSelectedTools([])
    } else {
      setSelectedPreset(null)
      setSelectedAssistant(null)
      setChatFiles([])
      setSelectedTools([])
      if (selectedWorkspace) {
        setChatSettings({
          model: getDefaultModelId(
            profile?.default_model || selectedWorkspace.default_model
          ),
          prompt: selectedWorkspace.default_prompt,
          temperature: selectedWorkspace.default_temperature,
          contextLength: Math.min(
            selectedWorkspace.default_context_length,
            32768
          ),
          includeProfileContext: selectedWorkspace.include_profile_context,
          includeWorkspaceInstructions:
            selectedWorkspace.include_workspace_instructions,
          embeddingsProvider:
            (selectedWorkspace?.embeddings_provider as
              | "google"
              | "openai"
              | "local") || "google"
        })
      }
      return
    }

    setChatSettings({
      model: getDefaultModelId(
        profile?.default_model || selectedWorkspace?.default_model
      ),
      prompt: item.prompt,
      temperature: item.temperature,
      contextLength: Math.min(item.context_length, 32768),
      includeProfileContext: item.include_profile_context,
      includeWorkspaceInstructions: item.include_workspace_instructions,
      embeddingsProvider:
        (item.embeddings_provider as "google" | "openai" | "local") ||
        (selectedWorkspace?.embeddings_provider as
          | "google"
          | "openai"
          | "local") ||
        "google"
    })
  }

  const checkIfModified = () => {
    if (!chatSettings) return false

    if (selectedPreset) {
      return (
        selectedPreset.include_profile_context !==
          chatSettings?.includeProfileContext ||
        selectedPreset.include_workspace_instructions !==
          chatSettings.includeWorkspaceInstructions ||
        selectedPreset.context_length !== chatSettings.contextLength ||
        selectedPreset.model !== chatSettings.model ||
        selectedPreset.prompt !== chatSettings.prompt ||
        selectedPreset.temperature !== chatSettings.temperature
      )
    } else if (selectedAssistant) {
      return (
        selectedAssistant.include_profile_context !==
          chatSettings.includeProfileContext ||
        selectedAssistant.include_workspace_instructions !==
          chatSettings.includeWorkspaceInstructions ||
        selectedAssistant.context_length !== chatSettings.contextLength ||
        selectedAssistant.model !== chatSettings.model ||
        selectedAssistant.prompt !== chatSettings.prompt ||
        selectedAssistant.temperature !== chatSettings.temperature
      )
    }

    return false
  }

  const isModified = checkIfModified()

  const items = [
    ...presets.map(preset => ({ ...preset, contentType: "presets" })),
    ...assistants.map(assistant => ({
      ...assistant,
      contentType: "assistants"
    }))
  ]

  const selectedAssistantImage = selectedPreset
    ? ""
    : assistantImages.find(
        image => image.path === selectedAssistant?.image_path
      )?.base64 || ""

  const defaultModelId = getDefaultModelId(
    profile?.default_model || selectedWorkspace?.default_model
  )
  const modelDetails = LLM_LIST.find(model => model.modelId === defaultModelId)

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={isOpen => {
        changeOpen(isOpen)
        setSearch("")
      }}
    >
      <DropdownMenuTrigger asChild className="max-w-[400px]" disabled={loading}>
        <Button
          variant="ghost"
          size="sm"
          className="flex max-w-[44px] gap-1 text-sm sm:max-w-[320px] sm:gap-2"
          aria-label={
            selectedPreset?.name ||
            selectedAssistant?.name ||
            t("Quick Settings")
          }
        >
          {selectedPreset && (
            <ModelIcon
              provider={modelDetails?.provider || "custom"}
              width={32}
              height={32}
            />
          )}

          {selectedAssistant &&
            (selectedAssistantImage ? (
              <Image
                className="rounded"
                src={selectedAssistantImage}
                alt="Assistant"
                width={28}
                height={28}
              />
            ) : (
              <IconRobotFace
                className="bg-primary text-secondary border-primary rounded border-DEFAULT p-1"
                size={28}
              />
            ))}

          {loading ? (
            <div className="animate-pulse">Loading assistant...</div>
          ) : (
            <>
              <div className="hidden overflow-hidden text-ellipsis sm:block">
                {isModified &&
                  (selectedPreset || selectedAssistant) &&
                  "Modified "}

                {selectedPreset?.name ||
                  selectedAssistant?.name ||
                  t("Quick Settings")}
              </div>

              <IconChevronDown className="ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="max-h-[min(80vh,36rem)] min-w-[300px] max-w-[500px] overflow-y-auto"
        align="start"
      >
        {presets.length === 0 && assistants.length === 0 ? (
          <div className="text-muted-foreground p-4 text-center text-sm">
            No presets or assistants found.
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              ref={inputRef}
              className="min-h-9 w-full"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
            />

            {!!(selectedPreset || selectedAssistant) && (
              <QuickSettingOption
                contentType={selectedPreset ? "presets" : "assistants"}
                isSelected={true}
                item={
                  selectedPreset ||
                  (selectedAssistant as
                    | Tables<"presets">
                    | Tables<"assistants">)
                }
                onSelect={() => {
                  handleSelectQuickSetting(null, "remove")
                }}
                image={selectedPreset ? "" : selectedAssistantImage}
              />
            )}

            {items
              .filter(
                item =>
                  item.name.toLowerCase().includes(search.toLowerCase()) &&
                  item.id !== selectedPreset?.id &&
                  item.id !== selectedAssistant?.id
              )
              .map(({ contentType, ...item }) => (
                <QuickSettingOption
                  key={item.id}
                  contentType={contentType as "presets" | "assistants"}
                  isSelected={false}
                  item={item}
                  onSelect={() =>
                    handleSelectQuickSetting(
                      item,
                      contentType as "presets" | "assistants"
                    )
                  }
                  image={
                    contentType === "assistants"
                      ? assistantImages.find(
                          image =>
                            image.path ===
                            (item as Tables<"assistants">).image_path
                        )?.base64 || ""
                      : ""
                  }
                />
              ))}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Streaming speed</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={streamingSpeed}
          onValueChange={value => {
            if (
              value === "instant" ||
              value === "natural" ||
              value === "relaxed"
            ) {
              setStreamingSpeed(value)
            }
          }}
        >
          <DropdownMenuRadioItem value="instant" className="min-h-9">
            Instant
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="natural" className="min-h-9">
            Natural · 120 chars/s
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="relaxed" className="min-h-9">
            Relaxed · 70 chars/s
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
