import { act, renderHook } from "@testing-library/react"
import {
  getStreamingParts,
  getStreamingRevealUnits
} from "@/components/messages/markdown-stream-boundaries"
import { normalizeDisplayMathInLists } from "@/components/messages/normalize-display-math"
import { normalizeMath } from "@/components/messages/normalize-math"
import {
  BACKLOG_SOFT_LIMIT_SECONDS,
  BASE_CPS,
  FINISH_MAX_SECONDS,
  MAX_MULTIPLIER,
  STREAMING_SPEED_CPS,
  useSmoothedText
} from "@/components/messages/use-smoothed-text"

const frames = new Map<number, FrameRequestCallback>()
let nextFrameId = 1

const flushFrame = (timestamp: number) => {
  const nextFrame = frames.entries().next().value as
    | [number, FrameRequestCallback]
    | undefined

  if (!nextFrame) return false

  frames.delete(nextFrame[0])
  act(() => nextFrame[1](timestamp))
  return true
}

describe("streaming presentation", () => {
  beforeEach(() => {
    frames.clear()
    nextFrameId = 1

    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: jest.fn((callback: FrameRequestCallback) => {
        const id = nextFrameId++
        frames.set(id, callback)
        return id
      })
    })
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: jest.fn((id: number) => frames.delete(id))
    })
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: jest.fn(() => ({ matches: false }))
    })
    jest.spyOn(performance, "now").mockReturnValue(0)
  })

  afterEach(() => {
    frames.clear()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("reveals buffered words incrementally on animation frames", () => {
    const { result, rerender } = renderHook(
      ({ text }) => useSmoothedText(text, true, "message-1"),
      { initialProps: { text: "" } }
    )

    flushFrame(32)
    rerender({ text: "A buffered response arrives in one burst. " })

    expect(result.current.text.length).toBeLessThan(
      "A buffered response arrives in one burst. ".length
    )

    let timestamp = 64
    while (flushFrame(timestamp)) timestamp += 32

    expect(result.current.text).toBe(
      "A buffered response arrives in one burst. "
    )
  })

  it("uses the requested pacing constants and catches up for a large backlog", () => {
    expect(BASE_CPS).toBe(120)
    expect(MAX_MULTIPLIER).toBe(3)
    expect(BACKLOG_SOFT_LIMIT_SECONDS).toBe(6)
    expect(FINISH_MAX_SECONDS).toBe(4)
    expect(STREAMING_SPEED_CPS).toEqual({
      instant: 0,
      natural: 120,
      relaxed: 70
    })

    const { result, rerender } = renderHook(
      ({ text }) => useSmoothedText(text, true, "message-1"),
      { initialProps: { text: "" } }
    )

    flushFrame(32)
    rerender({ text: "x ".repeat(500) })

    let timestamp = 64
    while (timestamp <= 224) {
      flushFrame(timestamp)
      timestamp += 32
    }

    expect(result.current.text.length).toBeGreaterThan(0)
    expect(result.current.text.length).toBeLessThanOrEqual(32)
  })

  it("reveals immediately when Instant speed is selected", () => {
    const response = "Instantly visible math: $$x^2 = 4$$"
    const { result } = renderHook(() =>
      useSmoothedText(response, true, "message-1", false, "instant")
    )

    expect(result.current.text).toBe(response)
    expect(frames.size).toBe(0)
  })

  it("reveals everything immediately when the user clicks the mark", () => {
    const { result } = renderHook(() =>
      useSmoothedText("The complete raw response", true, "message-1")
    )

    act(() => result.current.skipReveal())

    expect(result.current.text).toBe("The complete raw response")
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })

  it("reveals everything immediately when Escape is pressed", () => {
    const { result } = renderHook(() =>
      useSmoothedText("The complete raw response", true, "message-1")
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })

    expect(result.current.text).toBe("The complete raw response")
  })

  it("flushes immediately when generation is stopped", () => {
    const { result, rerender } = renderHook(
      ({ skipped }) =>
        useSmoothedText(
          "The complete raw response",
          true,
          "message-1",
          skipped
        ),
      { initialProps: { skipped: false } }
    )

    rerender({ skipped: true })

    expect(result.current.text).toBe("The complete raw response")
  })

  it("finishes a completed stream within the four-second deadline", () => {
    jest.useFakeTimers()
    const response = "The complete response arrives in a burst."
    const { result, rerender } = renderHook(
      ({ text, streaming }) => useSmoothedText(text, streaming, "message-1"),
      { initialProps: { text: "", streaming: true } }
    )

    rerender({ text: response, streaming: false })
    act(() => jest.advanceTimersByTime(FINISH_MAX_SECONDS * 1000))

    expect(result.current.text).toBe(response)
  })

  it("preserves every newline when a completed math-heavy reply is flushed", () => {
    jest.useFakeTimers()
    const response = Array.from(
      { length: 60 },
      (_, index) =>
        `Step ${index + 1}:\r\n\r\n$$\\frac{x_${index}^{2}}{(x+1)^{2}} = ${index + 1}$$\r\n\r\n`
    ).join("")
    const { result, rerender } = renderHook(
      ({ text, streaming }) => useSmoothedText(text, streaming, "math-reply"),
      { initialProps: { text: "", streaming: true } }
    )

    rerender({ text: response, streaming: false })
    act(() => jest.advanceTimersByTime(FINISH_MAX_SECONDS * 1000))

    expect(result.current.text).toBe(response)
  })

  it("cancels the old frame and clears prior text when the chat message changes", () => {
    const { result, rerender } = renderHook(
      ({ text, id }) => useSmoothedText(text, true, id),
      { initialProps: { text: "private prior reply", id: "message-1" } }
    )

    rerender({ text: "new chat response ", id: "message-2" })

    expect(result.current.text).toBe("")
    expect(window.cancelAnimationFrame).toHaveBeenCalled()

    let timestamp = 32
    while (flushFrame(timestamp)) timestamp += 32

    expect(result.current.text).toBe("new chat response ")
    expect(result.current.text).not.toContain("private prior reply")
  })

  it("does not delay visible text when reduced motion is enabled", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: jest.fn(() => ({ matches: true }))
    })

    const { result, rerender } = renderHook(
      ({ streaming }) =>
        useSmoothedText("No delayed text", streaming, "message-1"),
      { initialProps: { streaming: false } }
    )
    rerender({ streaming: true })

    expect(window.matchMedia).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)"
    )
    expect(result.current.text).toBe("No delayed text")
  })

  it("keeps incomplete markdown delimiters out of parsed content", () => {
    const partialCode = "Answer:\n```ts\nconst value = 42"
    expect(getStreamingParts(partialCode)).toEqual({
      markdown: "Answer:\n",
      pending: "```ts\nconst value = 42"
    })

    const completeCode = `${partialCode}\n\`\`\``
    expect(getStreamingParts(completeCode)).toEqual({
      markdown: completeCode,
      pending: ""
    })

    expect(getStreamingParts("Equation: $$x = \\frac{1}{2}")).toEqual({
      markdown: "Equation: ",
      pending: "$$x = \\frac{1}{2}"
    })
    expect(getStreamingParts("Inline: $x^2")).toEqual({
      markdown: "Inline: ",
      pending: "$x^2"
    })
    expect(getStreamingParts("Bold: **unfinished")).toEqual({
      markdown: "Bold: ",
      pending: "**unfinished"
    })
    expect(getStreamingParts("Inline code: `**not bold`")).toEqual({
      markdown: "Inline code: `**not bold`",
      pending: ""
    })
    expect(getStreamingParts("Bold: **finished**")).toEqual({
      markdown: "Bold: **finished**",
      pending: ""
    })
  })

  it("reveals math, fenced code, and tables as complete units", () => {
    const math = "$$\\frac{1}{(x+1)^{2}}$$"
    const code = "```ts\nconst answer = 42\n```\n"
    const table = "| A | B |\n| --- | --- |\n| 1 | 2 |"
    const content = `Before ${math}\n${code}\n${table}\n\nAfter`
    const units = getStreamingRevealUnits(content)

    expect(
      units.some(
        unit =>
          unit.kind === "block" &&
          content.slice(unit.end - math.length, unit.end) === math
      )
    ).toBe(true)
    expect(
      units.some(
        unit =>
          unit.kind === "block" &&
          content.slice(unit.end - code.length, unit.end) === code
      )
    ).toBe(true)
    expect(
      units.some(
        unit =>
          unit.kind === "block" &&
          content.slice(unit.end - table.length, unit.end) === table
      )
    ).toBe(true)
  })

  it("waits for the atomic-block fade delay before revealing math", () => {
    const { result, rerender } = renderHook(
      ({ text }) => useSmoothedText(text, true, "message-1"),
      { initialProps: { text: "" } }
    )

    flushFrame(32)
    rerender({ text: "$$x^2$$ " })

    let timestamp = 64
    while (timestamp <= 192) {
      flushFrame(timestamp)
      timestamp += 32
    }
    expect(result.current.text).toBe("")

    flushFrame(224)
    expect(result.current.text).toBe("$$x^2$$")
    expect(result.current.newTextKind).toBe("block")
  })

  it("preserves complete multi-step math responses", () => {
    const steps = Array.from(
      { length: 60 },
      (_, index) => `x_${index} = \\frac{${index + 1}}{${index + 2}}`
    )
    const response = `Derivation:\n$$\n${steps.join(" \\\\\n")}\n$$\nResult: $x_{60}=\\frac{61}{62}$.`

    const parts = getStreamingParts(response)

    expect(parts.markdown).toBe(response)
    expect(parts.pending).toBe("")
    expect(parts.markdown).toContain(steps[59])
  })

  it("normalizes double-dollar equations inside list items into display blocks", () => {
    expect(
      normalizeDisplayMathInLists(
        "- First step: $$x^2 = 4$$ then simplify.\n- Second step: $$x = 2$$"
      )
    ).toBe(
      "- First step:\n\n  $$\n  x^2 = 4\n  $$\n\n  then simplify.\n- Second step:\n\n  $$\n  x = 2\n  $$"
    )
  })

  it("leaves display delimiters in code fences and inline code untouched", () => {
    const markdown = [
      "- Example: `$$not math$$`",
      "```text",
      "- $$also not math$$",
      "```"
    ].join("\n")

    expect(normalizeDisplayMathInLists(markdown)).toBe(markdown)
  })

  it("normalizes aligned display math and keeps following prose in its own block", () => {
    const markdown =
      "Before.\n\n$$\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}$$\n\nAfter."

    expect(normalizeMath(markdown)).toBe(
      "Before.\n\n$$\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n$$\n\nAfter."
    )
  })

  it("converts bracket math delimiters and escapes an unmatched display delimiter", () => {
    expect(normalizeMath("Display: \\[x^2\\]\nInline: \\(y+1\\)")).toBe(
      "Display: \n\n$$\nx^2\n$$\n\nInline: $y+1$"
    )
    expect(normalizeMath("Unfinished $$ math")).toBe("Unfinished \\$\\$ math")
  })

  it("does not normalize math-looking source inside code", () => {
    const markdown = [
      "Inline `$$not math$$`",
      "",
      "```text",
      "$$also not math$$",
      "```"
    ].join("\n")

    expect(normalizeMath(markdown)).toBe(markdown)
  })
})
