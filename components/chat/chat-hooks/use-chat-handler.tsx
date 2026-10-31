import { ChatbotUIContext } from "@/context/context"
import { DEFAULT_GOOGLE_MODEL_ID } from "@/lib/models/llm/google-llm-list"
import {
  getMentionedNexusAgents,
  getNexusAgentModel,
  NexusAgentId,
  NEXUS_AGENTS,
  stripNexusAgentMentions
} from "@/lib/chat-agents"
import { getAssistantCollectionsByAssistantId } from "@/db/assistant-collections"
import { getAssistantFilesByAssistantId } from "@/db/assistant-files"
import { getAssistantToolsByAssistantId } from "@/db/assistant-tools"
import { updateChat } from "@/db/chats"
import { getCollectionFilesByCollectionId } from "@/db/collection-files"
import { deleteMessagesIncludingAndAfter } from "@/db/messages"
import { buildFinalMessages } from "@/lib/build-prompt"
import { Tables } from "@/supabase/types"
import { ChatMessage, ChatPayload, LLM, LLMID, ModelProvider } from "@/types"
import { useRouter } from "next/navigation"
import { useContext, useEffect, useRef } from "react"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import { LLM_LIST } from "../../../lib/models/llm/llm-list"
import {
  createTempMessages,
  handleCreateChat,
  handleCreateMessages,
  handleHostedChat,
  handleLocalChat,
  handleRetrieval,
  processResponse,
  validateChatSettings
} from "../chat-helpers"

export const useChatHandler = () => {
  const router = useRouter()

  const {
    userInput,
    chatFiles,
    setUserInput,
    setNewMessageImages,
    profile,
    setIsGenerating,
    setChatMessages,
    setFirstTokenReceived,
    selectedChat,
    selectedWorkspace,
    setSelectedChat,
    setChats,
    setSelectedTools,
    availableLocalModels,
    availableOpenRouterModels,
    abortController,
    setAbortController,
    chatSettings,
    availableHostedModels,
    newMessageImages,
    selectedAssistant,
    chatMessages,
    chatImages,
    setChatImages,
    setChatFiles,
    setNewMessageFiles,
    setShowFilesDisplay,
    newMessageFiles,
    chatFileItems,
    setChatFileItems,
    setToolInUse,
    useRetrieval,
    sourceCount,
    setIsPromptPickerOpen,
    setIsFilePickerOpen,
    selectedTools,
    selectedPreset,
    setChatSettings,
    setSelectedNexusAgents,
    models,
    isPromptPickerOpen,
    isFilePickerOpen,
    isToolPickerOpen
  } = useContext(ChatbotUIContext)

  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isPromptPickerOpen || !isFilePickerOpen || !isToolPickerOpen) {
      chatInputRef.current?.focus()
    }
  }, [isPromptPickerOpen, isFilePickerOpen, isToolPickerOpen])

  const handleNewChat = async () => {
    if (!selectedWorkspace) return

    setUserInput("")
    setChatMessages([])
    setSelectedChat(null)
    setChatFileItems([])

    setIsGenerating(false)
    setFirstTokenReceived(false)

    setChatFiles([])
    setChatImages([])
    setNewMessageFiles([])
    setNewMessageImages([])
    setShowFilesDisplay(false)
    setIsPromptPickerOpen(false)
    setIsFilePickerOpen(false)

    setSelectedTools([])
    setToolInUse("none")

    if (selectedAssistant) {
      setChatSettings({
        model: DEFAULT_GOOGLE_MODEL_ID,
        prompt: selectedAssistant.prompt,
        temperature: selectedAssistant.temperature,
        contextLength: Math.min(selectedAssistant.context_length, 32768),
        includeProfileContext: selectedAssistant.include_profile_context,
        includeWorkspaceInstructions:
          selectedAssistant.include_workspace_instructions,
        embeddingsProvider: "local"
      })

      let allFiles = []

      const assistantFiles = (
        await getAssistantFilesByAssistantId(selectedAssistant.id)
      ).files
      allFiles = [...assistantFiles]
      const assistantCollections = (
        await getAssistantCollectionsByAssistantId(selectedAssistant.id)
      ).collections
      for (const collection of assistantCollections) {
        const collectionFiles = (
          await getCollectionFilesByCollectionId(collection.id)
        ).files
        allFiles = [...allFiles, ...collectionFiles]
      }
      const assistantTools = (
        await getAssistantToolsByAssistantId(selectedAssistant.id)
      ).tools

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
    } else if (selectedPreset) {
      setChatSettings({
        model: DEFAULT_GOOGLE_MODEL_ID,
        prompt: selectedPreset.prompt,
        temperature: selectedPreset.temperature,
        contextLength: Math.min(selectedPreset.context_length, 32768),
        includeProfileContext: selectedPreset.include_profile_context,
        includeWorkspaceInstructions:
          selectedPreset.include_workspace_instructions,
        embeddingsProvider: "local"
      })
    } else if (selectedWorkspace) {
      // setChatSettings({
      //   model: (selectedWorkspace.default_model ||
      //     "gpt-4-1106-preview") as LLMID,
      //   prompt:
      //     selectedWorkspace.default_prompt ||
      //     "You are a friendly, helpful AI assistant.",
      //   temperature: selectedWorkspace.default_temperature || 0.5,
      //   contextLength: selectedWorkspace.default_context_length || 4096,
      //   includeProfileContext:
      //     selectedWorkspace.include_profile_context || true,
      //   includeWorkspaceInstructions:
      //     selectedWorkspace.include_workspace_instructions || true,
      //   embeddingsProvider:
      //     (selectedWorkspace.embeddings_provider as "openai" | "local") ||
      //     "openai"
      // })
    }

    return router.push(`/${selectedWorkspace.id}/chat`)
  }

  const handleFocusChatInput = () => {
    chatInputRef.current?.focus()
  }

  const handleStopMessage = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  const handleSendToNexusAgents = async (
    messageContent: string,
    history: ChatMessage[],
    requestedAgentIds: NexusAgentId[]
  ) => {
    const calledAgentIds = Array.from(
      new Set([
        ...requestedAgentIds,
        ...getMentionedNexusAgents(messageContent)
      ])
    )
    const requestText = stripNexusAgentMentions(messageContent)

    if (calledAgentIds.length === 0) {
      toast.error("Choose an AI agent or mention one with @ to send a message.")
      return
    }

    if (!requestText) {
      toast.error("Add a message for the selected AI agent.")
      return
    }

    const agentRequests = calledAgentIds.map(agentId => {
      const agent = NEXUS_AGENTS.find(candidate => candidate.id === agentId)
      return agent
        ? { agent, modelData: getNexusAgentModel(agent, availableHostedModels) }
        : undefined
    })

    const unavailableAgent = agentRequests.find(
      request => !request || !request.modelData
    )
    if (unavailableAgent) {
      const unavailableName =
        unavailableAgent?.agent?.name || "Selected AI agent"
      toast.error(
        `${unavailableName} is unavailable. Configure its provider key in Profile > Advanced.`
      )
      return
    }

    const validAgentRequests = agentRequests.filter(
      (
        request
      ): request is {
        agent: (typeof NEXUS_AGENTS)[number]
        modelData: LLM
      } => Boolean(request?.modelData)
    )

    if (selectedTools.length > 0) {
      toast.error(
        "Remove selected tools before calling multiple agents. Multi-agent tool execution is not supported yet."
      )
      return
    }

    if (
      newMessageImages.length > 0 &&
      validAgentRequests.some(request => !request.modelData.imageInput)
    ) {
      toast.error(
        "One or more selected agents do not support images. Remove the image or select image-capable agents."
      )
      return
    }

    if (!chatSettings || !profile || !selectedWorkspace) {
      toast.error("Chat setup is not ready. Refresh and try again.")
      return
    }

    setUserInput("")
    setIsGenerating(true)
    setIsPromptPickerOpen(false)
    setIsFilePickerOpen(false)
    setNewMessageImages([])

    const controller = new AbortController()
    setAbortController(controller)

    let retrievedFileItems: Tables<"file_items">[] = []
    try {
      if (
        (newMessageFiles.length > 0 || chatFiles.length > 0) &&
        useRetrieval
      ) {
        setToolInUse("retrieval")
        retrievedFileItems = await handleRetrieval(
          requestText,
          newMessageFiles,
          chatFiles,
          chatSettings.embeddingsProvider,
          sourceCount
        )
      }

      const userMessage: ChatMessage = {
        message: {
          chat_id: selectedChat?.id || "",
          assistant_id: null,
          content: messageContent,
          created_at: new Date().toISOString(),
          id: uuidv4(),
          image_paths: newMessageImages.map(image => image.base64),
          model: chatSettings.model,
          role: "user",
          sequence_number: history.length,
          updated_at: new Date().toISOString(),
          user_id: profile.user_id
        },
        fileItems: []
      }

      const pendingAgentMessages: ChatMessage[] = validAgentRequests.map(
        ({ modelData }, index) => ({
          message: {
            chat_id: selectedChat?.id || "",
            assistant_id: null,
            content: "",
            created_at: new Date().toISOString(),
            id: uuidv4(),
            image_paths: [],
            model: modelData.modelId,
            role: "assistant",
            sequence_number: history.length + index + 1,
            updated_at: new Date().toISOString(),
            user_id: profile.user_id
          },
          fileItems: []
        })
      )

      setChatMessages([...history, userMessage, ...pendingAgentMessages])
      setToolInUse("Matrix")

      const responses = await Promise.allSettled(
        validAgentRequests.map(async ({ agent, modelData }, index) => {
          if (controller.signal.aborted) {
            throw new DOMException("The request was cancelled.", "AbortError")
          }

          const assistantMessage = pendingAgentMessages[index]
          const agentSettings = {
            ...chatSettings,
            model: modelData.modelId,
            prompt: `${chatSettings.prompt}\n\n${agent.instructions}`
          }
          const payload: ChatPayload = {
            chatSettings: agentSettings,
            workspaceInstructions: selectedWorkspace.instructions || "",
            chatMessages: [...history, userMessage],
            assistant: selectedChat?.assistant_id ? selectedAssistant : null,
            messageFileItems: retrievedFileItems,
            chatFileItems
          }
          const generatedText = await handleHostedChat(
            payload,
            profile,
            modelData,
            assistantMessage,
            false,
            controller,
            newMessageImages,
            chatImages,
            setIsGenerating,
            setFirstTokenReceived,
            setChatMessages,
            setToolInUse
          )

          return {
            assistantMessage,
            generatedText,
            modelData
          }
        })
      )

      const completedResponses: {
        assistantMessage: ChatMessage
        generatedText: string
        modelData: LLM
      }[] = []

      responses.forEach((result, index) => {
        if (result.status === "fulfilled") {
          completedResponses.push(result.value)
          return
        }

        const agent = validAgentRequests[index].agent
        const pendingMessage = pendingAgentMessages[index]
        setChatMessages(messages =>
          messages.filter(
            message => message.message.id !== pendingMessage.message.id
          )
        )

        if (result.reason?.name !== "AbortError") {
          toast.error(
            `${agent.name}: ${
              result.reason instanceof Error
                ? result.reason.message
                : "The request failed."
            }`
          )
        }
      })

      if (completedResponses.length === 0) {
        setChatMessages(history)
        setUserInput(messageContent)
        return
      }

      let currentChat = selectedChat ? { ...selectedChat } : null
      if (!currentChat) {
        currentChat = await handleCreateChat(
          chatSettings,
          profile,
          selectedWorkspace,
          messageContent,
          selectedAssistant,
          newMessageFiles,
          setSelectedChat,
          setChats,
          setChatFiles
        )
      } else {
        const updatedChat = await updateChat(currentChat.id, {
          updated_at: new Date().toISOString()
        })
        setChats(chats =>
          chats.map(chat => (chat.id === updatedChat.id ? updatedChat : chat))
        )
      }

      await handleCreateMessages(
        history,
        currentChat,
        profile,
        completedResponses[0].modelData,
        messageContent,
        completedResponses[0].generatedText,
        newMessageImages,
        false,
        retrievedFileItems,
        setChatMessages,
        setChatFileItems,
        setChatImages,
        selectedAssistant,
        completedResponses.map(({ modelData, generatedText }) => ({
          modelData,
          generatedText
        })),
        chatSettings.model
      )
      setSelectedNexusAgents([])
    } catch (error) {
      setChatMessages(history)
      setUserInput(messageContent)
      toast.error(
        error instanceof Error ? error.message : "Unable to send this message."
      )
    } finally {
      setIsGenerating(false)
      setFirstTokenReceived(false)
      setToolInUse("none")
    }
  }

  const handleSendMessage = async (
    messageContent: string,
    chatMessages: ChatMessage[],
    isRegeneration: boolean,
    agentIds?: NexusAgentId[],
    /** parent_id for threaded branch replies */
    parentId?: string | null
  ) => {
    if (agentIds !== undefined) {
      return handleSendToNexusAgents(messageContent, chatMessages, agentIds)
    }

    const startingInput = messageContent

    try {
      setUserInput("")
      setIsGenerating(true)
      setIsPromptPickerOpen(false)
      setIsFilePickerOpen(false)
      setNewMessageImages([])

      const newAbortController = new AbortController()
      setAbortController(newAbortController)

      const modelData = [
        ...models.map(model => ({
          modelId: model.model_id as LLMID,
          modelName: model.name,
          provider: "custom" as ModelProvider,
          hostedId: model.id,
          platformLink: "",
          imageInput: false
        })),
        ...LLM_LIST,
        ...availableLocalModels,
        ...availableOpenRouterModels
      ].find(llm => llm.modelId === chatSettings?.model)

      validateChatSettings(
        chatSettings,
        modelData,
        profile,
        selectedWorkspace,
        messageContent
      )

      let currentChat = selectedChat ? { ...selectedChat } : null

      const b64Images = newMessageImages.map(image => image.base64)

      let retrievedFileItems: Tables<"file_items">[] = []

      if (
        (newMessageFiles.length > 0 || chatFiles.length > 0) &&
        useRetrieval
      ) {
        setToolInUse("retrieval")

        retrievedFileItems = await handleRetrieval(
          userInput,
          newMessageFiles,
          chatFiles,
          chatSettings!.embeddingsProvider,
          sourceCount
        )
      }

      const { tempUserChatMessage, tempAssistantChatMessage } =
        createTempMessages(
          messageContent,
          chatMessages,
          chatSettings!,
          b64Images,
          isRegeneration,
          setChatMessages,
          selectedAssistant,
          parentId
        )

      let payload: ChatPayload = {
        chatSettings: chatSettings!,
        workspaceInstructions: selectedWorkspace!.instructions || "",
        chatMessages: isRegeneration
          ? [...chatMessages]
          : [...chatMessages, tempUserChatMessage],
        assistant: selectedChat?.assistant_id ? selectedAssistant : null,
        messageFileItems: retrievedFileItems,
        chatFileItems: chatFileItems
      }

      let generatedText = ""

      if (selectedTools.length > 0) {
        setToolInUse("Tools")

        const formattedMessages = await buildFinalMessages(
          payload,
          profile!,
          chatImages
        )

        const response = await fetch("/api/chat/tools", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chatSettings: payload.chatSettings,
            messages: formattedMessages,
            selectedTools
          })
        })

        setToolInUse("none")

        generatedText = await processResponse(
          response,
          isRegeneration
            ? payload.chatMessages[payload.chatMessages.length - 1]
            : tempAssistantChatMessage,
          true,
          newAbortController,
          setFirstTokenReceived,
          setChatMessages,
          setToolInUse
        )
      } else {
        if (modelData!.provider === "ollama") {
          generatedText = await handleLocalChat(
            payload,
            profile!,
            chatSettings!,
            tempAssistantChatMessage,
            isRegeneration,
            newAbortController,
            setIsGenerating,
            setFirstTokenReceived,
            setChatMessages,
            setToolInUse
          )
        } else {
          generatedText = await handleHostedChat(
            payload,
            profile!,
            modelData!,
            tempAssistantChatMessage,
            isRegeneration,
            newAbortController,
            newMessageImages,
            chatImages,
            setIsGenerating,
            setFirstTokenReceived,
            setChatMessages,
            setToolInUse
          )
        }
      }

      if (!currentChat) {
        currentChat = await handleCreateChat(
          chatSettings!,
          profile!,
          selectedWorkspace!,
          messageContent,
          selectedAssistant!,
          newMessageFiles,
          setSelectedChat,
          setChats,
          setChatFiles
        )
      } else {
        const updatedChat = await updateChat(currentChat.id, {
          updated_at: new Date().toISOString()
        })

        setChats(prevChats => {
          const updatedChats = prevChats.map(prevChat =>
            prevChat.id === updatedChat.id ? updatedChat : prevChat
          )

          return updatedChats
        })
      }

      await handleCreateMessages(
        chatMessages,
        currentChat,
        profile!,
        modelData!,
        messageContent,
        generatedText,
        newMessageImages,
        isRegeneration,
        retrievedFileItems,
        setChatMessages,
        setChatFileItems,
        setChatImages,
        selectedAssistant,
        undefined, // assistantResponses
        undefined, // userModelId
        parentId ?? null
      )

      setIsGenerating(false)
      setFirstTokenReceived(false)
    } catch (error) {
      setIsGenerating(false)
      setFirstTokenReceived(false)
      setUserInput(startingInput)
      setChatMessages(chatMessages)
      toast.error(
        error instanceof Error ? error.message : "Unable to send this message."
      )
    }
  }

  const handleSendEdit = async (
    editedContent: string,
    sequenceNumber: number
  ) => {
    if (!selectedChat) return

    await deleteMessagesIncludingAndAfter(
      selectedChat.user_id,
      selectedChat.id,
      sequenceNumber
    )

    const filteredMessages = chatMessages.filter(
      chatMessage => chatMessage.message.sequence_number < sequenceNumber
    )

    setChatMessages(filteredMessages)

    handleSendMessage(editedContent, filteredMessages, false)
  }

  return {
    chatInputRef,
    prompt,
    handleNewChat,
    handleSendMessage,
    handleFocusChatInput,
    handleStopMessage,
    handleSendEdit
  }
}
