import {
  getMentionedNexusAgents,
  stripNexusAgentMentions
} from "@/lib/chat-agents"

describe("Matrix group-chat mentions", () => {
  it("recognizes @Matrix without treating member mentions as agent calls", () => {
    expect(
      getMentionedNexusAgents("@Matrix summarize this for @jordan")
    ).toEqual(["gemini"])
    expect(getMentionedNexusAgents("@jordan can you review this?")).toEqual([])
  })

  it("removes the Matrix trigger before sending the prompt to the agent", () => {
    expect(stripNexusAgentMentions("@Matrix summarize this")).toBe(
      "summarize this"
    )
  })

  it("does not accept the legacy Gemini alias as a Matrix invocation", () => {
    expect(getMentionedNexusAgents("@Gemini summarize this")).toEqual([])
  })
})
