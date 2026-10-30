import { Tables } from "@/supabase/types"

export interface ChatMessage {
  /**
   * The underlying Supabase message row.
   * After the parent_id migration, `message.parent_id` will be available
   * as a runtime field even if it is not yet reflected in the generated
   * supabase/types.ts (until you re-run `npm run db-types`).
   */
  message: Tables<"messages"> & { parent_id?: string | null }
  fileItems: string[]
}
