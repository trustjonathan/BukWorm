import {
  appendMatrixDefaultInstructions,
  MATRIX_DEFAULT_INSTRUCTIONS
} from "@/lib/matrix-default-instructions"

describe("Matrix default instructions", () => {
  it("appends the default guidance after configured prompt text", () => {
    const prompt = appendMatrixDefaultInstructions("Workspace prompt.")

    expect(prompt.indexOf("Workspace prompt.")).toBeLessThan(
      prompt.indexOf("Matrix Default Instructions:")
    )
    expect(prompt).toContain(MATRIX_DEFAULT_INSTRUCTIONS)
    expect(prompt).toContain(
      "You are Matrix, an AI assistant. Be direct, precise and useful."
    )
  })

  it("includes the requested continuity, accuracy, and formatting rules", () => {
    expect(MATRIX_DEFAULT_INSTRUCTIONS).toContain("CONTEXT AND CONTINUITY")
    expect(MATRIX_DEFAULT_INSTRUCTIONS).toContain("ACCURACY AND HONESTY")
    expect(MATRIX_DEFAULT_INSTRUCTIONS).toContain("MATH AND CODE FORMATTING")
    expect(MATRIX_DEFAULT_INSTRUCTIONS).toContain(
      "Never restate the question."
    )
    expect(MATRIX_DEFAULT_INSTRUCTIONS).toContain(
      "Start fresh only when the user clearly changes topic."
    )
  })
})
