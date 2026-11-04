"use client"

import { Dashboard } from "@/components/ui/dashboard"
import { ChatbotUIContext } from "@/context/context"
import { getAssistantWorkspacesByWorkspaceId } from "@/db/assistants"
import { getChatsByWorkspaceId } from "@/db/chats"
import { getCollectionWorkspacesByWorkspaceId } from "@/db/collections"
import { getFileWorkspacesByWorkspaceId } from "@/db/files"
import { getFoldersByWorkspaceId } from "@/db/folders"
import { getModelWorkspacesByWorkspaceId } from "@/db/models"
import { getPresetWorkspacesByWorkspaceId } from "@/db/presets"
import { getPromptWorkspacesByWorkspaceId } from "@/db/prompts"
import { getAssistantImageFromStorage } from "@/db/storage/assistant-images"
import { getToolWorkspacesByWorkspaceId } from "@/db/tools"
import { getWorkspaceMemberProfiles } from "@/db/workspace-collaboration"
import {
  getHomeWorkspaceByUserId,
  getWorkspaceById,
  WorkspaceNotFoundError
} from "@/db/workspaces"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import { getDefaultModelId } from "@/lib/models/llm/llm-list"
import { supabase } from "@/lib/supabase/browser-client"
import { useParams, useRouter } from "next/navigation"
import {
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react"
import { toast } from "sonner"

interface WorkspaceLayoutProps {
  children: ReactNode
}

const setAppLoadingState = (loading: boolean) => {
  if (loading) {
    document.documentElement.dataset.matrixAppLoading = "true"
    window.dispatchEvent(new Event("matrix:app-loading"))
  } else {
    delete document.documentElement.dataset.matrixAppLoading
    window.dispatchEvent(new Event("matrix:app-ready"))
  }
}

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const router = useRouter()

  const params = useParams()
  const workspaceId = params.workspaceid as string

  const {
    setChatSettings,
    setAssistants,
    setAssistantImages,
    setChats,
    setCollections,
    setFolders,
    setFiles,
    setPresets,
    setPrompts,
    setTools,
    setModels,
    selectedWorkspace,
    setSelectedWorkspace,
    setSelectedChat,
    setChatMessages,
    setUserInput,
    setIsGenerating,
    setFirstTokenReceived,
    setChatFiles,
    setChatImages,
    setNewMessageFiles,
    setNewMessageImages,
    setShowFilesDisplay,
    setWorkspaceMembers,
    profile
  } = useContext(ChatbotUIContext)

  const accountDefaultModel = useRef(profile?.default_model)

  useEffect(() => {
    accountDefaultModel.current = profile?.default_model
  }, [profile?.default_model])

  const [loading, setLoading] = useState(true)

  const fetchWorkspaceData = useCallback(
    async (workspaceId: string, isCurrent: () => boolean) => {
      setLoading(true)

      try {
        const workspace = await getWorkspaceById(workspaceId)
        const [
          assistantData,
          chats,
          collectionData,
          folders,
          fileData,
          presetData,
          promptData,
          toolData,
          modelData,
          workspaceMembers
        ] = await Promise.all([
          getAssistantWorkspacesByWorkspaceId(workspaceId),
          getChatsByWorkspaceId(workspaceId),
          getCollectionWorkspacesByWorkspaceId(workspaceId),
          getFoldersByWorkspaceId(workspaceId),
          getFileWorkspacesByWorkspaceId(workspaceId),
          getPresetWorkspacesByWorkspaceId(workspaceId),
          getPromptWorkspacesByWorkspaceId(workspaceId),
          getToolWorkspacesByWorkspaceId(workspaceId),
          getModelWorkspacesByWorkspaceId(workspaceId),
          workspace.sharing === "shared"
            ? getWorkspaceMemberProfiles(workspaceId)
            : Promise.resolve([])
        ])

        const assistantImages = await Promise.all(
          assistantData.assistants.map(async assistant => {
            let url = ""

            if (assistant.image_path) {
              url =
                (await getAssistantImageFromStorage(assistant.image_path)) || ""
            }

            if (!url) {
              return {
                assistantId: assistant.id,
                path: assistant.image_path,
                base64: "",
                url
              }
            }

            const response = await fetch(url)
            if (!response.ok) {
              throw new Error(`Failed to load image for ${assistant.name}.`)
            }
            const base64 = await convertBlobToBase64(await response.blob())

            return {
              assistantId: assistant.id,
              path: assistant.image_path,
              base64,
              url
            }
          })
        )

        if (!isCurrent()) return

        setSelectedWorkspace(workspace)
        setAssistants(assistantData.assistants)
        setAssistantImages(assistantImages)
        setChats(chats)
        setCollections(collectionData.collections)
        setFolders(folders)
        setFiles(fileData.files)
        setPresets(presetData.presets)
        setPrompts(promptData.prompts)
        setTools(toolData.tools)
        setModels(modelData.models)
        setWorkspaceMembers(workspaceMembers)
        setChatSettings({
          model: getDefaultModelId(
            accountDefaultModel.current || workspace.default_model
          ),
          prompt:
            workspace.default_prompt ??
            "You are a friendly, helpful AI assistant.",
          temperature: workspace.default_temperature ?? 0.5,
          contextLength: Math.min(
            workspace.default_context_length ?? 4096,
            32768
          ),
          includeProfileContext: workspace.include_profile_context ?? true,
          includeWorkspaceInstructions:
            workspace.include_workspace_instructions ?? true,
          embeddingsProvider:
            workspace.embeddings_provider === "openai"
              ? "openai"
              : workspace.embeddings_provider === "google"
                ? "google"
                : "local"
        })
      } catch (error) {
        if (isCurrent()) {
          if (error instanceof WorkspaceNotFoundError) {
            const session = (await supabase.auth.getSession()).data.session
            if (session) {
              const homeWorkspaceId = await getHomeWorkspaceByUserId(
                session.user.id
              )
              if (homeWorkspaceId !== workspaceId) {
                router.replace(`/${homeWorkspaceId}/chat`)
                return
              }
            }
          }

          toast.error(
            error instanceof Error ? error.message : "Failed to load workspace."
          )
        }
      } finally {
        if (isCurrent()) {
          setLoading(false)
          setAppLoadingState(false)
        }
      }
    },
    [
      setAssistantImages,
      setAssistants,
      setChatSettings,
      setChats,
      setCollections,
      setFiles,
      setFolders,
      setModels,
      setPresets,
      setPrompts,
      router,
      setSelectedWorkspace,
      setTools,
      setWorkspaceMembers
    ]
  )

  useEffect(() => {
    let isCurrent = true

    setUserInput("")
    setChatMessages([])
    setSelectedChat(null)
    setIsGenerating(false)
    setFirstTokenReceived(false)
    setChatFiles([])
    setChatImages([])
    setNewMessageFiles([])
    setNewMessageImages([])
    setShowFilesDisplay(false)
    setWorkspaceMembers([])

    const loadWorkspace = async () => {
      setAppLoadingState(true)

      try {
        const session = (await supabase.auth.getSession()).data.session

        if (!isCurrent) return
        if (!session) {
          setAppLoadingState(false)
          router.push("/login")
          return
        }

        await fetchWorkspaceData(workspaceId, () => isCurrent)
      } catch (error) {
        if (isCurrent) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load session."
          )
          setLoading(false)
          setAppLoadingState(false)
        }
      }
    }

    void loadWorkspace()

    return () => {
      isCurrent = false
      setAppLoadingState(false)
    }
  }, [
    fetchWorkspaceData,
    router,
    setChatFiles,
    setChatImages,
    setChatMessages,
    setFirstTokenReceived,
    setIsGenerating,
    setNewMessageFiles,
    setNewMessageImages,
    setSelectedChat,
    setShowFilesDisplay,
    setWorkspaceMembers,
    setUserInput,
    workspaceId
  ])

  return loading ? null : <Dashboard>{children}</Dashboard>
}
