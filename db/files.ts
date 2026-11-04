import { supabase } from "@/lib/supabase/browser-client"
import { TablesInsert, TablesUpdate } from "@/supabase/types"
import mammoth from "mammoth"
import { deleteFileFromStorage, uploadFile } from "./storage/files"

export const getFileById = async (fileId: string) => {
  const { data: file, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", fileId)
    .single()

  if (!file) {
    throw new Error(error.message)
  }

  return file
}

export const getFileWorkspacesByWorkspaceId = async (workspaceId: string) => {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `
      id,
      name,
      files (*),
      collections (
        files (*)
      )
    `
    )
    .eq("id", workspaceId)
    .single()

  if (!workspace) {
    throw new Error(error.message)
  }

  const filesById = new Map(
    workspace.files.map(file => [file.id, file] as const)
  )

  for (const collection of workspace.collections) {
    for (const file of collection.files) {
      filesById.set(file.id, file)
    }
  }

  return {
    ...workspace,
    files: Array.from(filesById.values())
  }
}

export const getFileWorkspacesByFileId = async (fileId: string) => {
  const { data: file, error } = await supabase
    .from("files")
    .select(
      `
      id, 
      name, 
      workspaces (*)
    `
    )
    .eq("id", fileId)
    .single()

  if (!file) {
    throw new Error(error.message)
  }

  return file
}

export const createFileBasedOnExtension = async (
  file: File,
  fileRecord: TablesInsert<"files">,
  workspace_id: string,
  embeddingsProvider: "google" | "openai" | "local"
) => {
  const fileExtension = file.name.split(".").pop()

  if (fileExtension === "docx") {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({
      arrayBuffer
    })

    return createDocXFile(
      result.value,
      file,
      fileRecord,
      workspace_id,
      embeddingsProvider
    )
  } else {
    return createFile(file, fileRecord, workspace_id, embeddingsProvider)
  }
}

// For non-docx files
export const createFile = async (
  file: File,
  fileRecord: TablesInsert<"files">,
  workspace_id: string,
  embeddingsProvider: "google" | "openai" | "local"
) => {
  let validFilename = fileRecord.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
  const extension = file.name.split(".").pop()
  const extensionIndex = validFilename.lastIndexOf(".")
  const baseName = validFilename.substring(
    0,
    extensionIndex < 0 ? undefined : extensionIndex
  )
  const maxBaseNameLength = 100 - (extension?.length || 0) - 1
  if (baseName.length > maxBaseNameLength) {
    fileRecord.name = baseName.substring(0, maxBaseNameLength) + "." + extension
  } else {
    fileRecord.name = baseName + "." + extension
  }
  const { data: createdFile, error } = await supabase
    .from("files")
    .insert([fileRecord])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  let filePath: string | null = null
  let filePathSaved = false

  try {
    await createFileWorkspace({
      user_id: createdFile.user_id,
      file_id: createdFile.id,
      workspace_id
    })

    filePath = await uploadFile(file, {
      name: createdFile.name,
      user_id: createdFile.user_id,
      file_id: createdFile.id
    })

    await updateFile(createdFile.id, {
      file_path: filePath
    })
    filePathSaved = true

    const formData = new FormData()
    formData.append("file_id", createdFile.id)
    formData.append("embeddingsProvider", embeddingsProvider)

    const response = await fetch("/api/retrieval/process", {
      method: "POST",
      body: formData
    })

    await assertFileProcessingSucceeded(response, createdFile.id)

    return await getFileById(createdFile.id)
  } catch (error) {
    await cleanupFailedFileCreation(createdFile.id, filePath, filePathSaved)
    throw error
  }
}

// // Handle docx files
export const createDocXFile = async (
  text: string,
  file: File,
  fileRecord: TablesInsert<"files">,
  workspace_id: string,
  embeddingsProvider: "google" | "openai" | "local"
) => {
  const { data: createdFile, error } = await supabase
    .from("files")
    .insert([fileRecord])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  let filePath: string | null = null
  let filePathSaved = false

  try {
    await createFileWorkspace({
      user_id: createdFile.user_id,
      file_id: createdFile.id,
      workspace_id
    })

    filePath = await uploadFile(file, {
      name: createdFile.name,
      user_id: createdFile.user_id,
      file_id: createdFile.id
    })

    await updateFile(createdFile.id, {
      file_path: filePath
    })
    filePathSaved = true

    const response = await fetch("/api/retrieval/process/docx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        fileId: createdFile.id,
        embeddingsProvider,
        fileExtension: "docx"
      })
    })

    await assertFileProcessingSucceeded(response, createdFile.id)

    return await getFileById(createdFile.id)
  } catch (error) {
    await cleanupFailedFileCreation(createdFile.id, filePath, filePathSaved)
    throw error
  }
}

const assertFileProcessingSucceeded = async (
  response: Response,
  fileId: string
) => {
  if (response.ok) return

  const responseText = await response.text()
  let message = responseText

  try {
    const body = JSON.parse(responseText)
    if (typeof body.message === "string") message = body.message
  } catch {
    if (!responseText) message = "The file processing request failed."
  }

  console.error(
    `Error processing file:${fileId}, status:${response.status}, response:${message}`
  )
  throw new Error(`Failed to process file. ${message}`)
}

const cleanupFailedFileCreation = async (
  fileId: string,
  filePath: string | null,
  filePathSaved: boolean
) => {
  if (filePath && !filePathSaved) {
    try {
      await deleteFileFromStorage(filePath)
    } catch (error) {
      console.error(`Failed to remove incomplete file upload ${fileId}.`, error)
    }
  }

  try {
    await deleteFile(fileId)
  } catch (error) {
    console.error(`Failed to remove incomplete file record ${fileId}.`, error)

    if (filePath && filePathSaved) {
      try {
        await deleteFileFromStorage(filePath)
      } catch (storageError) {
        console.error(
          `Failed to remove incomplete file upload ${fileId}.`,
          storageError
        )
      }
    }
  }
}

export const createFiles = async (
  files: TablesInsert<"files">[],
  workspace_id: string
) => {
  const { data: createdFiles, error } = await supabase
    .from("files")
    .insert(files)
    .select("*")

  if (error) {
    throw new Error(error.message)
  }

  await createFileWorkspaces(
    createdFiles.map(file => ({
      user_id: file.user_id,
      file_id: file.id,
      workspace_id
    }))
  )

  return createdFiles
}

export const createFileWorkspace = async (item: {
  user_id: string
  file_id: string
  workspace_id: string
}) => {
  const { data: createdFileWorkspace, error } = await supabase
    .from("file_workspaces")
    .insert([item])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return createdFileWorkspace
}

export const createFileWorkspaces = async (
  items: { user_id: string; file_id: string; workspace_id: string }[]
) => {
  const { data: createdFileWorkspaces, error } = await supabase
    .from("file_workspaces")
    .insert(items)
    .select("*")

  if (error) throw new Error(error.message)

  return createdFileWorkspaces
}

export const updateFile = async (
  fileId: string,
  file: TablesUpdate<"files">
) => {
  const { data: updatedFile, error } = await supabase
    .from("files")
    .update(file)
    .eq("id", fileId)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updatedFile
}

export const deleteFile = async (fileId: string) => {
  const { error } = await supabase.from("files").delete().eq("id", fileId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}

export const deleteFileWorkspace = async (
  fileId: string,
  workspaceId: string
) => {
  const { error } = await supabase
    .from("file_workspaces")
    .delete()
    .eq("file_id", fileId)
    .eq("workspace_id", workspaceId)

  if (error) throw new Error(error.message)

  return true
}
