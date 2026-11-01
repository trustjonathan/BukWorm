import { DEFAULT_GOOGLE_MODEL_ID } from "@/lib/models/llm/google-llm-list"
import { LLM, LLMID } from "@/types"

export type NexusAgentId = "gemini"

export interface NexusAgent {
  id: NexusAgentId
  name: string
  provider: "google"
  role: string
  aliases: string[]
  preferredModel: LLMID
  instructions: string
  color: string
}

export const NEXUS_AGENTS: NexusAgent[] = [
  {
    id: "gemini",
    name: "Matrix",
    provider: "google",
    role: "Research & synthesis",
    aliases: ["matrix"],
    preferredModel: DEFAULT_GOOGLE_MODEL_ID,
    instructions:
      "Use the complete conversation history, answer the latest request, and build on earlier messages when relevant. Do not claim to have searched the web unless a search tool was actually used.",
    color: "blue"
  }
]

export const getMentionedNexusAgents = (message: string): NexusAgentId[] => {
  const mentioned = new Set<NexusAgentId>()
  const mentionPattern = /(?:^|[^\w])@(matrix)\b/gi
  let match: RegExpExecArray | null

  while ((match = mentionPattern.exec(message)) !== null) {
    const alias = match[1].toLowerCase()
    const agent = NEXUS_AGENTS.find(candidate =>
      candidate.aliases.includes(alias)
    )
    if (agent) mentioned.add(agent.id)
  }

  return Array.from(mentioned)
}

export const getNexusAgentModel = (agent: NexusAgent, availableModels: LLM[]) =>
  availableModels.find(
    model =>
      model.provider === agent.provider &&
      model.modelId === agent.preferredModel
  ) || availableModels.find(model => model.provider === agent.provider)

export const stripNexusAgentMentions = (message: string) =>
  message
    .replace(/(^|[^\w])@matrix\b/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
