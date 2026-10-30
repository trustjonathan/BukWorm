import { Tables } from "@/supabase/types"
import { ChatMessage } from "."

/**
 * A tree node wrapping a real ChatMessage with nested replies.
 * parent_id is pulled from message.parent_id (available after migration).
 * For legacy messages without parent_id, the tree builder auto-pairs them.
 */
export interface MessageNode {
  chatMessage: ChatMessage
  children: MessageNode[]
}
