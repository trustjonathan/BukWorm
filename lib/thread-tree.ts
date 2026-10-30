import { ChatMessage } from "@/types"
import { MessageNode } from "@/types/threaded-chat"

/**
 * Builds a MessageNode tree from a flat array of ChatMessages.
 *
 * Strategy:
 * 1. Build a lookup map of all nodes.
 * 2. If a message has an explicit `parent_id`, link it directly to that parent.
 * 3. If a message has no `parent_id`:
 *    - User messages start a new root branch on the timeline spine (like WhatsApp top-level messages).
 *    - Legacy assistant messages immediately following a user message are attached to that user message.
 */
export function buildMessageTree(chatMessages: ChatMessage[]): MessageNode[] {
  if (chatMessages.length === 0) return []

  const sorted = [...chatMessages].sort(
    (a, b) => a.message.sequence_number - b.message.sequence_number
  )

  const nodeMap = new Map<string, MessageNode>()
  const roots: MessageNode[] = []
  let lastUserNode: MessageNode | null = null

  // First pass: create all wrapper nodes
  for (const cm of sorted) {
    nodeMap.set(cm.message.id, { chatMessage: cm, children: [] })
  }

  // Second pass: wire parent-child hierarchy
  for (const cm of sorted) {
    const parentId = (cm.message as any).parent_id as string | null | undefined
    const node = nodeMap.get(cm.message.id)!

    if (parentId && nodeMap.has(parentId)) {
      // Explicit thread parent
      nodeMap.get(parentId)!.children.push(node)
      if (cm.message.role === "user") {
        lastUserNode = node
      }
    } else if (parentId === null || parentId === undefined) {
      // Top-level / new session message
      if (cm.message.role === "user") {
        roots.push(node)
        lastUserNode = node
      } else if (cm.message.role === "assistant" && lastUserNode) {
        // Auto-pair legacy assistant reply to the preceding user node
        lastUserNode.children.push(node)
      } else {
        roots.push(node)
        lastUserNode = null
      }
    } else {
      roots.push(node)
    }
  }

  return roots
}

/**
 * Collects the linear ancestor chain from the root down to a given message id.
 * Used to give Gemini the exact conversational context when replying in a branch.
 * Returns messages in chronological order (root → target).
 */
export function getAncestorChain(
  roots: MessageNode[],
  targetId: string
): ChatMessage[] {
  function findPath(
    nodes: MessageNode[],
    id: string,
    path: ChatMessage[]
  ): ChatMessage[] | null {
    for (const node of nodes) {
      const current = [...path, node.chatMessage]
      if (node.chatMessage.message.id === id) return current
      const found = findPath(node.children, id, current)
      if (found) return found
    }
    return null
  }

  return findPath(roots, targetId, []) ?? []
}
