// TODO: Separate into multiple contexts, keeping simple for now

"use client"

import { ChatbotUIContext } from "@/context/context"
import { getProfileByUserId } from "@/db/profile"
import { getWorkspaceImageFromStorage } from "@/db/storage/workspace-images"
import { getWorkspacesByUserId } from "@/db/workspaces"
import {
  getWorkspaceRoles,
  WorkspaceMemberProfile
} from "@/db/workspace-collaboration"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import { DEFAULT_GOOGLE_MODEL_ID } from "@/lib/models/llm/google-llm-list"
import { NexusAgentId } from "@/lib/chat-agents"
import { fetchHostedModels } from "@/lib/models/fetch-models"
import { supabase } from "@/lib/supabase/browser-client"
import { Tables } from "@/supabase/types"
import {
  ChatFile,
  ChatMessage,
  ChatSettings,
  LLM,
  MessageImage,
  OpenRouterLLM,
  WorkspaceImage
} from "@/types"
import { AssistantImage } from "@/types/images/assistant-image"
import { VALID_ENV_KEYS } from "@/types/valid-keys"
import { usePathname, useRouter } from "next/navigation"
import { FC, useCallback, useEffect, useRef, useState } from "react"

interface GlobalStateProps {
  children: React.ReactNode
}

export const GlobalState: FC<GlobalStateProps> = ({ children }) => {
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  // PROFILE STORE
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null)

  // ITEMS STORE
  const [assistants, setAssistants] = useState<Tables<"assistants">[]>([])
  const [collections, setCollections] = useState<Tables<"collections">[]>([])
  const [chats, setChats] = useState<Tables<"chats">[]>([])
  const [chatPreferences, setChatPreferences] = useState<
    Tables<"chat_user_preferences">[]
  >([])
  const [files, setFiles] = useState<Tables<"files">[]>([])
  const [folders, setFolders] = useState<Tables<"folders">[]>([])
  const [models, setModels] = useState<Tables<"models">[]>([])
  const [presets, setPresets] = useState<Tables<"presets">[]>([])
  const [prompts, setPrompts] = useState<Tables<"prompts">[]>([])
  const [tools, setTools] = useState<Tables<"tools">[]>([])
  const [workspaces, setWorkspaces] = useState<Tables<"workspaces">[]>([])
  const [workspacePreferences, setWorkspacePreferences] = useState<
    Tables<"workspace_user_preferences">[]
  >([])
  const [workspaceRoles, setWorkspaceRoles] = useState<
    Record<string, "owner" | "admin" | "editor" | "viewer">
  >({})
  const [workspaceMembers, setWorkspaceMembers] = useState<
    WorkspaceMemberProfile[]
  >([])

  // MODELS STORE
  const [envKeyMap, setEnvKeyMap] = useState<Record<string, VALID_ENV_KEYS>>({})
  const [availableHostedModels, setAvailableHostedModels] = useState<LLM[]>([])
  const [availableLocalModels, setAvailableLocalModels] = useState<LLM[]>([])
  const [availableOpenRouterModels, setAvailableOpenRouterModels] = useState<
    OpenRouterLLM[]
  >([])

  // WORKSPACE STORE
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<Tables<"workspaces"> | null>(null)
  const [workspaceImages, setWorkspaceImages] = useState<WorkspaceImage[]>([])

  // PRESET STORE
  const [selectedPreset, setSelectedPreset] =
    useState<Tables<"presets"> | null>(null)

  // ASSISTANT STORE
  const [selectedAssistant, setSelectedAssistant] =
    useState<Tables<"assistants"> | null>(null)
  const [assistantImages, setAssistantImages] = useState<AssistantImage[]>([])
  const [openaiAssistants, setOpenaiAssistants] = useState<any[]>([])

  // PASSIVE CHAT STORE
  const [userInput, setUserInput] = useState<string>("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    model: DEFAULT_GOOGLE_MODEL_ID,
    prompt: "You are a helpful AI assistant.",
    temperature: 0.5,
    contextLength: 4000,
    includeProfileContext: true,
    includeWorkspaceInstructions: true,
    embeddingsProvider: "google"
  })
  const [selectedNexusAgents, setSelectedNexusAgents] = useState<
    NexusAgentId[]
  >([])
  const [selectedChat, setSelectedChat] = useState<Tables<"chats"> | null>(null)
  const [chatFileItems, setChatFileItems] = useState<Tables<"file_items">[]>([])
  const [streamingSpeed, setStreamingSpeed] = useState<
    "instant" | "natural" | "relaxed"
  >("natural")
  const [isTemporaryChat, setIsTemporaryChat] = useState(false)

  // ACTIVE CHAT STORE
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [firstTokenReceived, setFirstTokenReceived] = useState<boolean>(false)
  const [streamRevealSkipped, setStreamRevealSkipped] = useState(false)
  const [abortController, setAbortController] =
    useState<AbortController | null>(null)

  // CHAT INPUT COMMAND STORE
  const [isPromptPickerOpen, setIsPromptPickerOpen] = useState(false)
  const [slashCommand, setSlashCommand] = useState("")
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false)
  const [hashtagCommand, setHashtagCommand] = useState("")
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false)
  const [toolCommand, setToolCommand] = useState("")
  const [focusPrompt, setFocusPrompt] = useState(false)
  const [focusFile, setFocusFile] = useState(false)
  const [focusTool, setFocusTool] = useState(false)
  const [focusAssistant, setFocusAssistant] = useState(false)
  const [atCommand, setAtCommand] = useState("")
  const [isAssistantPickerOpen, setIsAssistantPickerOpen] = useState(false)

  // ATTACHMENTS STORE
  const [chatFiles, setChatFiles] = useState<ChatFile[]>([])
  const [chatImages, setChatImages] = useState<MessageImage[]>([])
  const [newMessageFiles, setNewMessageFiles] = useState<ChatFile[]>([])
  const [newMessageImages, setNewMessageImages] = useState<MessageImage[]>([])
  const [showFilesDisplay, setShowFilesDisplay] = useState<boolean>(false)

  // RETIEVAL STORE
  const [useRetrieval, setUseRetrieval] = useState<boolean>(true)
  const [sourceCount, setSourceCount] = useState<number>(4)

  // TOOL STORE
  const [selectedTools, setSelectedTools] = useState<Tables<"tools">[]>([])
  const [toolInUse, setToolInUse] = useState<string>("none")

  // THREADED CHAT STORE
  const [replyingToParentId, setReplyingToParentId] = useState<string | null>(
    null
  )

  // SIDEBAR STORE
  const [showSidebar, setShowSidebar] = useState<boolean>(true)

  useEffect(() => {
    const savedSpeed = localStorage.getItem("matrixStreamingSpeed")
    if (
      savedSpeed === "instant" ||
      savedSpeed === "natural" ||
      savedSpeed === "relaxed"
    ) {
      setStreamingSpeed(savedSpeed)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("matrixStreamingSpeed", streamingSpeed)
  }, [streamingSpeed])

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("showSidebar") : null
    if (saved !== null) {
      setShowSidebar(saved === "true")
    } else if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowSidebar(false)
    }
  }, [])

  const fetchStartingData = useCallback(async () => {
    const session = (await supabase.auth.getSession()).data.session

    if (session) {
      const user = session.user

      const profile = await getProfileByUserId(user.id)
      setProfile(profile)

      if (!profile.has_onboarded || !profile.default_model) {
        const currentPathname = pathnameRef.current
        if (!currentPathname.endsWith("/setup")) {
          const requestedNext = new URLSearchParams(window.location.search).get(
            "next"
          )
          const nextPath =
            requestedNext?.startsWith("/") &&
            !requestedNext.startsWith("//") &&
            !requestedNext.includes("\\")
              ? requestedNext
              : currentPathname.endsWith("/login")
                ? null
                : `${currentPathname}${window.location.search}`
          const nextQuery = nextPath
            ? `?next=${encodeURIComponent(nextPath)}`
            : ""
          router.push(`/setup${nextQuery}`)
        }

        return profile
      }

      const workspaces = await getWorkspacesByUserId(user.id)
      setWorkspaces(workspaces)
      setWorkspaceRoles(await getWorkspaceRoles(workspaces, user.id))

      for (const workspace of workspaces) {
        let workspaceImageUrl = ""

        if (workspace.image_path) {
          workspaceImageUrl =
            (await getWorkspaceImageFromStorage(workspace.image_path)) || ""
        }

        if (workspaceImageUrl) {
          const response = await fetch(workspaceImageUrl)
          const blob = await response.blob()
          const base64 = await convertBlobToBase64(blob)

          setWorkspaceImages(prev => [
            ...prev,
            {
              workspaceId: workspace.id,
              path: workspace.image_path,
              base64: base64,
              url: workspaceImageUrl
            }
          ])
        }
      }

      return profile
    }
  }, [router, setProfile, setWorkspaceImages, setWorkspaceRoles, setWorkspaces])

  useEffect(() => {
    ;(async () => {
      const profile = await fetchStartingData()

      if (profile) {
        const hostedModelRes = await fetchHostedModels(profile)
        if (!hostedModelRes) return

        setEnvKeyMap(hostedModelRes.envKeyMap)
        setAvailableHostedModels(hostedModelRes.hostedModels)
      }
    })()
  }, [fetchStartingData, setAvailableHostedModels, setEnvKeyMap])

  return (
    <ChatbotUIContext.Provider
      value={{
        streamingSpeed,
        setStreamingSpeed,
        isTemporaryChat,
        setIsTemporaryChat,

        // PROFILE STORE
        profile,
        setProfile,

        // ITEMS STORE
        assistants,
        setAssistants,
        collections,
        setCollections,
        chats,
        setChats,
        chatPreferences,
        setChatPreferences,
        files,
        setFiles,
        folders,
        setFolders,
        models,
        setModels,
        presets,
        setPresets,
        prompts,
        setPrompts,
        tools,
        setTools,
        workspaces,
        setWorkspaces,
        workspacePreferences,
        setWorkspacePreferences,
        workspaceRoles,
        setWorkspaceRoles,
        workspaceMembers,
        setWorkspaceMembers,

        // MODELS STORE
        envKeyMap,
        setEnvKeyMap,
        availableHostedModels,
        setAvailableHostedModels,
        availableLocalModels,
        setAvailableLocalModels,
        availableOpenRouterModels,
        setAvailableOpenRouterModels,

        // WORKSPACE STORE
        selectedWorkspace,
        setSelectedWorkspace,
        workspaceImages,
        setWorkspaceImages,

        // PRESET STORE
        selectedPreset,
        setSelectedPreset,

        // ASSISTANT STORE
        selectedAssistant,
        setSelectedAssistant,
        assistantImages,
        setAssistantImages,
        openaiAssistants,
        setOpenaiAssistants,

        // PASSIVE CHAT STORE
        userInput,
        setUserInput,
        chatMessages,
        setChatMessages,
        chatSettings,
        setChatSettings,
        selectedNexusAgents,
        setSelectedNexusAgents,
        selectedChat,
        setSelectedChat,
        chatFileItems,
        setChatFileItems,

        // ACTIVE CHAT STORE
        isGenerating,
        setIsGenerating,
        firstTokenReceived,
        setFirstTokenReceived,
        streamRevealSkipped,
        setStreamRevealSkipped,
        abortController,
        setAbortController,

        // CHAT INPUT COMMAND STORE
        isPromptPickerOpen,
        setIsPromptPickerOpen,
        slashCommand,
        setSlashCommand,
        isFilePickerOpen,
        setIsFilePickerOpen,
        hashtagCommand,
        setHashtagCommand,
        isToolPickerOpen,
        setIsToolPickerOpen,
        toolCommand,
        setToolCommand,
        focusPrompt,
        setFocusPrompt,
        focusFile,
        setFocusFile,
        focusTool,
        setFocusTool,
        focusAssistant,
        setFocusAssistant,
        atCommand,
        setAtCommand,
        isAssistantPickerOpen,
        setIsAssistantPickerOpen,

        // ATTACHMENT STORE
        chatFiles,
        setChatFiles,
        chatImages,
        setChatImages,
        newMessageFiles,
        setNewMessageFiles,
        newMessageImages,
        setNewMessageImages,
        showFilesDisplay,
        setShowFilesDisplay,

        // RETRIEVAL STORE
        useRetrieval,
        setUseRetrieval,
        sourceCount,
        setSourceCount,

        // TOOL STORE
        selectedTools,
        setSelectedTools,
        toolInUse,
        setToolInUse,

        // THREADED CHAT STORE
        replyingToParentId,
        setReplyingToParentId,

        // SIDEBAR STORE
        showSidebar,
        setShowSidebar
      }}
    >
      {children}
    </ChatbotUIContext.Provider>
  )
}
