import { supabase } from "@/lib/supabase/browser-client"
import { Tables } from "@/supabase/types"

export const getMessageLikes = async (messageIds: string[]) => {
  if (messageIds.length === 0) return []

  const { data, error } = await supabase
    .from("message_likes")
    .select("*")
    .in("message_id", messageIds)

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export const createMessageLike = async (
  messageId: string,
  userId: string,
  emoji: string
): Promise<Tables<"message_likes">> => {
  const { data, error } = await supabase
    .from("message_likes")
    .upsert(
      { message_id: messageId, user_id: userId, emoji },
      { onConflict: "message_id,user_id,emoji" }
    )
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export const deleteMessageLike = async (
  messageId: string,
  userId: string,
  emoji: string
) => {
  const { error } = await supabase
    .from("message_likes")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)

  if (error) {
    throw new Error(error.message)
  }
}
