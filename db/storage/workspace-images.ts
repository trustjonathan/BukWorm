import { supabase } from "@/lib/supabase/browser-client"
import { Tables } from "@/supabase/types"

export const uploadWorkspaceImage = async (
  workspace: Tables<"workspaces">,
  image: File
) => {
  const bucket = "workspace_images"

  const imageSizeLimit = 6000000 // 6MB

  if (image.size > imageSizeLimit) {
    throw new Error(`Image must be less than ${imageSizeLimit / 1000000}MB`)
  }

  const filePath = `${workspace.user_id}/${workspace.id}/${Date.now()}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, image, {
      upsert: true
    })

  if (error) {
    throw new Error("Error uploading image")
  }

  return filePath
}

export const deleteWorkspaceImage = async (filePath: string) => {
  const { error } = await supabase.storage
    .from("workspace_images")
    .remove([filePath])

  if (error) {
    throw new Error("Error deleting old workspace image")
  }
}

export const getWorkspaceImageFromStorage = async (filePath: string) => {
  try {
    const { data, error } = await supabase.storage
      .from("workspace_images")
      .createSignedUrl(filePath, 60 * 60 * 24) // 24hrs

    if (error) {
      throw new Error("Error downloading workspace image")
    }

    return data.signedUrl
  } catch (error) {
    console.error(error)
  }
}
