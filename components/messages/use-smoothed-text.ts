import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react"
import { getStreamingRevealUnits } from "./markdown-stream-boundaries"

export const BASE_CPS = 120
export const MAX_MULTIPLIER = 3
export const BACKLOG_SOFT_LIMIT_SECONDS = 6
export const FINISH_MAX_SECONDS = 4
const BLOCK_REVEAL_DELAY_MS = 150
export type StreamingSpeed = "instant" | "natural" | "relaxed"
export const STREAMING_SPEED_CPS: Record<StreamingSpeed, number> = {
  instant: 0,
  natural: BASE_CPS,
  relaxed: 70
}

const getBaseSpeed = (speed: StreamingSpeed) =>
  STREAMING_SPEED_CPS[speed] || BASE_CPS

interface SmoothedTextState {
  text: string
  newTextStart: number
  newTextKind: "word" | "block"
}

interface SmoothedText extends SmoothedTextState {
  skipReveal: () => void
}

export const useSmoothedText = (
  rawText: string,
  isStreaming: boolean,
  messageId: string,
  forceReveal = false,
  speed: StreamingSpeed = "natural"
): SmoothedText => {
  const [displayed, setDisplayed] = useState<SmoothedTextState>(() => ({
    text: isStreaming ? "" : rawText,
    newTextStart: isStreaming ? 0 : rawText.length,
    newTextKind: "word"
  }))
  const targetRef = useRef(rawText)
  const cursorRef = useRef(isStreaming ? 0 : rawText.length)
  const frameRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)
  const pacingCreditRef = useRef(0)
  const blockRevealAtRef = useRef<number | null>(null)
  const finishDeadlineRef = useRef<number | null>(null)
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const forceRevealRef = useRef(forceReveal)
  const isStreamingRef = useRef(isStreaming)
  const forceRevealPropRef = useRef(forceReveal)
  const speedRef = useRef(speed)
  const [reduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )

  targetRef.current = rawText
  isStreamingRef.current = isStreaming
  forceRevealPropRef.current = forceReveal
  speedRef.current = speed

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const clearFinishTimer = useCallback(() => {
    if (finishTimerRef.current !== null) {
      clearTimeout(finishTimerRef.current)
      finishTimerRef.current = null
    }
  }, [])

  const revealFullText = useCallback(() => {
    const text = targetRef.current
    cursorRef.current = text.length
    blockRevealAtRef.current = null
    pacingCreditRef.current = 0
    setDisplayed({
      text,
      newTextStart: text.length,
      newTextKind: "word"
    })
  }, [])

  const revealAll = useCallback(() => {
    forceRevealRef.current = true
    cancelFrame()
    clearFinishTimer()
    revealFullText()
  }, [cancelFrame, clearFinishTimer, revealFullText])

  useLayoutEffect(() => {
    cancelFrame()
    clearFinishTimer()
    forceRevealRef.current = forceRevealPropRef.current
    cursorRef.current =
      isStreamingRef.current && !forceRevealPropRef.current
        ? 0
        : targetRef.current.length
    lastFrameRef.current = 0
    pacingCreditRef.current = 0
    blockRevealAtRef.current = null
    finishDeadlineRef.current = null
    const shouldReveal = forceRevealPropRef.current || !isStreamingRef.current
    setDisplayed({
      text: shouldReveal ? targetRef.current : "",
      newTextStart: shouldReveal ? targetRef.current.length : 0,
      newTextKind: "word"
    })
  }, [cancelFrame, clearFinishTimer, messageId])

  useEffect(() => cancelFrame, [cancelFrame, messageId])

  useEffect(() => {
    if (
      isStreaming ||
      forceReveal ||
      reduceMotion ||
      cursorRef.current >= targetRef.current.length
    ) {
      clearFinishTimer()
      return
    }

    finishTimerRef.current = setTimeout(revealAll, FINISH_MAX_SECONDS * 1000)
    return clearFinishTimer
  }, [
    clearFinishTimer,
    forceReveal,
    isStreaming,
    messageId,
    reduceMotion,
    revealAll
  ])

  useEffect(() => {
    if (!isStreaming) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") revealAll()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isStreaming, revealAll])

  useEffect(() => {
    if (
      forceReveal ||
      forceRevealRef.current ||
      reduceMotion ||
      speed === "instant"
    ) {
      revealAll()
      return
    }

    if (isStreaming) {
      finishDeadlineRef.current = null
    } else if (finishDeadlineRef.current === null) {
      finishDeadlineRef.current = performance.now() + FINISH_MAX_SECONDS * 1000
    }

    if (frameRef.current !== null) return

    const reveal = (timestamp: number) => {
      frameRef.current = null
      const target = targetRef.current
      const deadline = finishDeadlineRef.current

      if (!isStreaming && deadline !== null && timestamp >= deadline) {
        clearFinishTimer()
        revealFullText()
        return
      }

      const units = getStreamingRevealUnits(target, !isStreaming)
      const nextUnit = units.find(unit => unit.end > cursorRef.current)

      if (!nextUnit) {
        lastFrameRef.current = timestamp
        if (!isStreaming && cursorRef.current < target.length) {
          frameRef.current = requestAnimationFrame(reveal)
        }
        return
      }

      if (nextUnit.kind === "block") {
        if (blockRevealAtRef.current === null) {
          blockRevealAtRef.current = timestamp + BLOCK_REVEAL_DELAY_MS
        }
        if (timestamp < blockRevealAtRef.current) {
          frameRef.current = requestAnimationFrame(reveal)
          return
        }
        blockRevealAtRef.current = null
        pacingCreditRef.current = 0
      } else {
        const elapsed = Math.max(0, timestamp - lastFrameRef.current)
        const baseSpeed = getBaseSpeed(speedRef.current)
        const backlogCharacters = Math.max(0, target.length - cursorRef.current)
        const backlogSeconds = backlogCharacters / baseSpeed
        const excessBacklog =
          Math.max(0, backlogSeconds - BACKLOG_SOFT_LIMIT_SECONDS) /
          BACKLOG_SOFT_LIMIT_SECONDS
        const multiplier = Math.min(
          MAX_MULTIPLIER,
          1 + (MAX_MULTIPLIER - 1) * (excessBacklog / (1 + excessBacklog))
        )
        let revealSpeed = baseSpeed * multiplier

        if (deadline !== null) {
          const secondsRemaining = Math.max(0.1, (deadline - timestamp) / 1000)
          revealSpeed = Math.min(
            baseSpeed * MAX_MULTIPLIER,
            Math.max(revealSpeed, backlogCharacters / secondsRemaining)
          )
        }

        pacingCreditRef.current += (revealSpeed * elapsed) / 1000
        if (pacingCreditRef.current < nextUnit.end - cursorRef.current) {
          lastFrameRef.current = timestamp
          frameRef.current = requestAnimationFrame(reveal)
          return
        }
        pacingCreditRef.current -= nextUnit.end - cursorRef.current
      }

      const start = cursorRef.current
      cursorRef.current = nextUnit.end
      lastFrameRef.current = timestamp
      setDisplayed({
        text: target.slice(0, cursorRef.current),
        newTextStart: start,
        newTextKind: nextUnit.kind
      })

      if (cursorRef.current >= target.length) clearFinishTimer()

      if (
        cursorRef.current < target.length &&
        (units.some(unit => unit.end > cursorRef.current) || !isStreaming)
      ) {
        frameRef.current = requestAnimationFrame(reveal)
      }
    }

    frameRef.current = requestAnimationFrame(reveal)
  }, [
    clearFinishTimer,
    forceReveal,
    isStreaming,
    rawText,
    reduceMotion,
    revealAll,
    revealFullText,
    speed
  ])

  return {
    ...displayed,
    skipReveal: revealAll
  }
}
