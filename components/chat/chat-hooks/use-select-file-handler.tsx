import { ChatbotUIContext } from "@/context/context"
import { createDocXFile, createFile } from "@/db/files"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { Tables } from "@/supabase/types"
import { ChatFile } from "@/types"
import mammoth from "mammoth"
import { useContext, useEffect, useState } from "react"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"

export const ACCEPTED_FILE_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/json",
  "text/markdown",
  "application/pdf",
  "text/plain"
].join(",")

export const useSelectFileHandler = () => {
  const {
    selectedWorkspace,
    profile,
    chatSettings,
    setNewMessageImages,
    setNewMessageFiles,
    setShowFilesDisplay,
    setFiles,
    setUseRetrieval
  } = useContext(ChatbotUIContext)

  const [filesToAccept, setFilesToAccept] = useState(ACCEPTED_FILE_TYPES)

  useEffect(() => {
    const model = LLM_LIST.find(llm => llm.modelId === chatSettings?.model)

    if (model) {
      setFilesToAccept(
        model.imageInput
          ? `${ACCEPTED_FILE_TYPES},image/*`
          : ACCEPTED_FILE_TYPES
      )
    }
  }, [chatSettings?.model])

  const processFile = async (file: File, pendingId: string) => {
    if (!profile || !selectedWorkspace || !chatSettings) {
      toast.error("Choose a workspace before attaching files.")
      return
    }

    const model = LLM_LIST.find(llm => llm.modelId === chatSettings.model)
    const acceptedTypes = new Set(ACCEPTED_FILE_TYPES.split(","))
    const isImage = file.type.startsWith("image/")
    const extension = file.name.split(".").pop()?.toLowerCase()
    const typeByExtension: Record<string, string> = {
      csv: "csv",
      docx: "docx",
      json: "json",
      md: "markdown",
      markdown: "markdown",
      pdf: "pdf",
      txt: "txt"
    }
    const simplifiedFileType =
      typeByExtension[extension || ""] ||
      (file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ? "docx"
        : file.type.split("/")[1] || "file")
    const updatePendingFile = (
      update: Partial<Pick<ChatFile, "uploadState" | "uploadError">>
    ) => {
      setNewMessageFiles(prev =>
        prev.map(item =>
          item.id === pendingId ? { ...item, ...update } : item
        )
      )
    }

    const imageAllowed = Boolean(model?.imageInput)
    const isSupportedDocument =
      acceptedTypes.has(file.type) ||
      (!file.type && Boolean(typeByExtension[extension || ""]))

    if (isImage && !imageAllowed) {
      updatePendingFile({
        uploadState: "failed",
        uploadError: "Images are not supported by this model."
      })
      return
    }

    if (!isImage && !isSupportedDocument) {
      updatePendingFile({
        uploadState: "failed",
        uploadError: "Unsupported file type."
      })
      return
    }

    updatePendingFile({ uploadState: "uploading", uploadError: undefined })

    if (isImage) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result)
            } else {
              reject(new Error("Could not read the image file."))
            }
          }
          reader.onerror = () =>
            reject(reader.error || new Error("Could not read the image file."))
          reader.readAsDataURL(file)
        })

        setNewMessageImages(prev => [
          ...prev,
          {
            messageId: `temp:${uuidv4()}`,
            path: "",
            base64,
            url: URL.createObjectURL(file),
            file
          }
        ])
        setNewMessageFiles(prev => prev.filter(item => item.id !== pendingId))
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to read image."
        updatePendingFile({ uploadState: "failed", uploadError: message })
        toast.error(`${file.name}: ${message}`, { duration: 10000 })
      }
      return
    }

    try {
      const fileRecord = {
        user_id: profile.user_id,
        description: "",
        file_path: "",
        name: file.name,
        size: file.size,
        tokens: 0,
        type: simplifiedFileType
      }

      let createdFile: Tables<"files">
      if (simplifiedFileType === "docx") {
        const result = await mammoth.extractRawText({
          arrayBuffer: await file.arrayBuffer()
        })
        createdFile = await createDocXFile(
          result.value,
          file,
          fileRecord,
          selectedWorkspace.id,
          chatSettings.embeddingsProvider
        )
      } else {
        createdFile = await createFile(
          file,
          fileRecord,
          selectedWorkspace.id,
          chatSettings.embeddingsProvider
        )
      }

      setFiles(prev => [...prev, createdFile])
      setNewMessageFiles(prev =>
        prev.map(item =>
          item.id === pendingId
            ? {
                id: createdFile.id,
                name: createdFile.name,
                type: createdFile.type,
                file
              }
            : item
        )
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload."
      updatePendingFile({ uploadState: "failed", uploadError: message })
      toast.error(`${file.name}: ${message}`, { duration: 10000 })
    }
  }

  const handleSelectDeviceFiles = async (input: File[] | FileList) => {
    const selectedFiles = Array.from(input)
    if (selectedFiles.length === 0) return

    if (!profile || !selectedWorkspace || !chatSettings) {
      toast.error("Choose a workspace before attaching files.")
      return
    }

    setShowFilesDisplay(true)
    setUseRetrieval(true)

    const pendingFiles = selectedFiles.map(file => ({
      id: `pending:${uuidv4()}`,
      name: file.name,
      type: file.type || file.name.split(".").pop()?.toLowerCase() || "file",
      file,
      uploadState: "uploading" as const
    }))

    setNewMessageFiles(prev => [...prev, ...pendingFiles])

    await Promise.all(
      selectedFiles.map((file, index) =>
        processFile(file, pendingFiles[index].id)
      )
    )
  }

  const retryFileUpload = async (pendingFile: ChatFile) => {
    if (!pendingFile.file) {
      toast.error(
        `${pendingFile.name}: The original file is no longer available.`
      )
      return
    }

    if (pendingFile.id.startsWith("pending:")) {
      await processFile(pendingFile.file, pendingFile.id)
      return
    }

    toast.error("This file is already attached.")
  }

  return {
    handleSelectDeviceFiles,
    retryFileUpload,
    filesToAccept
  }
}
