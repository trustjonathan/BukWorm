import { ChatMessage } from "@/types"
import { MessageNode } from "@/types/threaded-chat"

/**
 * Builds a MessageNode tree from a flat array of ChatMessages.
 *
 * Strategy:
 * 1. If messages have parent_id set (post-migration), use that to build the tree.
 * 2. For legacy messages (no parent_id), auto-pair consecutive user/assistant pairs
 *    so that each assistant reply becomes a child of the preceding user message.
 */
export function buildMessageTree(chatMessages: ChatMessage[]): MessageNode[] {
  if (chatMessages.length === 0) return []

  const sorted = [...chatMessages].sort(
    (a, b) => a.message.sequence_number - b.message.sequence_number
  )

  // Check if any message has a parent_id (post-migration data)
  const hasParentIds = sorted.some(cm => (cm.message as any).parent_id != null)

  if (hasParentIds) {
    return buildTreeFromParentIds(sorted)
  }

  return buildTreeFromLegacyPairs(sorted)
}

/**
 * Tree builder for messages that have parent_id set in the DB.
 */
function buildTreeFromParentIds(sorted: ChatMessage[]): MessageNode[] {
  const nodeMap = new Map<string, MessageNode>()
  const roots: MessageNode[] = []

  // First pass: create all nodes
  for (const cm of sorted) {
    nodeMap.set(cm.message.id, { chatMessage: cm, children: [] })
  }

  // Second pass: attach children to parents
  for (const cm of sorted) {
    const parentId = (cm.message as any).parent_id as string | null
    const node = nodeMap.get(cm.message.id)!

    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

/**
 * Legacy auto-pair: user message → assistant reply becomes its child.
 * Each user message starts a new root node. Each immediately following
 * assistant message becomes a child of the last user message.
 */
function buildTreeFromLegacyPairs(sorted: ChatMessage[]): MessageNode[] {
  const roots: MessageNode[] = []
  let lastUserNode: MessageNode | null = null

  for (const cm of sorted) {
    const node: MessageNode = { chatMessage: cm, children: [] }

    if (cm.message.role === "user") {
      roots.push(node)
      lastUserNode = node
    } else if (cm.message.role === "assistant" && lastUserNode) {
      lastUserNode.children.push(node)
      // Don't reset lastUserNode — multiple assistant replies
      // can stack under the same user node
    } else {
      // system or orphaned assistant: treat as root
      roots.push(node)
      lastUserNode = null
    }
  }

  return roots
}

/**
 * Collects the linear ancestor chain from the root down to a given message id.
 * Used to give Gemini the correct thread context when replying in a branch.
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
