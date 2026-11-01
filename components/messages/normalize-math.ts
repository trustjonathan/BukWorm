const isEscaped = (text: string, index: number) => {
  let backslashes = 0
  for (
    let position = index - 1;
    position >= 0 && text[position] === "\\";
    position--
  ) {
    backslashes += 1
  }
  return backslashes % 2 === 1
}

const getProtectedRanges = (text: string) => {
  const ranges: { start: number; end: number }[] = []
  let fenceCharacter = ""
  let fenceLength = 0
  let offset = 0

  for (const line of text.split(/(?<=\n)/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker) {
      if (!fenceCharacter) {
        fenceCharacter = marker[0]
        fenceLength = marker.length
      } else if (marker[0] === fenceCharacter && marker.length >= fenceLength) {
        fenceCharacter = ""
        fenceLength = 0
      }
      ranges.push({ start: offset, end: offset + line.length })
    } else if (fenceCharacter) {
      ranges.push({ start: offset, end: offset + line.length })
    }
    offset += line.length
  }

  let rangeIndex = 0
  for (let index = 0; index < text.length; index++) {
    while (rangeIndex < ranges.length && index >= ranges[rangeIndex].end) {
      rangeIndex += 1
    }
    if (rangeIndex < ranges.length && index >= ranges[rangeIndex].start) {
      index = ranges[rangeIndex].end - 1
      continue
    }
    if (text[index] !== "`") continue

    let runLength = 1
    while (text[index + runLength] === "`") runLength += 1
    const delimiter = "`".repeat(runLength)
    const close = text.indexOf(delimiter, index + runLength)
    if (close < 0) continue

    ranges.push({ start: index, end: close + runLength })
    ranges.sort((left, right) => left.start - right.start)
    while (rangeIndex < ranges.length && index >= ranges[rangeIndex].end) {
      rangeIndex += 1
    }
    index = close + runLength - 1
  }

  return ranges
}

interface MathDelimiter {
  start: number
  end: number
  value: "$$" | "\\[" | "\\]" | "\\(" | "\\)"
}

const getMathDelimiters = (text: string) => {
  const protectedRanges = getProtectedRanges(text)
  const delimiters: MathDelimiter[] = []
  let rangeIndex = 0

  for (let index = 0; index < text.length; index++) {
    while (
      rangeIndex < protectedRanges.length &&
      index >= protectedRanges[rangeIndex].end
    ) {
      rangeIndex += 1
    }
    if (
      rangeIndex < protectedRanges.length &&
      index >= protectedRanges[rangeIndex].start
    ) {
      index = protectedRanges[rangeIndex].end - 1
      continue
    }
    if (isEscaped(text, index)) continue

    if (text.startsWith("$$", index)) {
      delimiters.push({ start: index, end: index + 2, value: "$$" })
      index += 1
    } else if (
      text.startsWith("\\[", index) ||
      text.startsWith("\\]", index) ||
      text.startsWith("\\(", index) ||
      text.startsWith("\\)", index)
    ) {
      delimiters.push({
        start: index,
        end: index + 2,
        value: text.slice(index, index + 2) as MathDelimiter["value"]
      })
      index += 1
    }
  }

  return delimiters
}

const getPairs = (delimiters: MathDelimiter[]) => {
  const pairs: {
    open: MathDelimiter
    close: MathDelimiter
    display: boolean
  }[] = []
  const unmatched: MathDelimiter[] = []
  let openDollar: MathDelimiter | null = null
  let openBracket: MathDelimiter | null = null
  let openParenthesis: MathDelimiter | null = null

  for (const delimiter of delimiters) {
    if (delimiter.value === "$$") {
      if (!openDollar) openDollar = delimiter
      else {
        pairs.push({ open: openDollar, close: delimiter, display: true })
        openDollar = null
      }
      continue
    }

    if (delimiter.value === "\\[") {
      if (openBracket) unmatched.push(openBracket)
      openBracket = delimiter
    } else if (delimiter.value === "\\]") {
      if (openBracket) {
        pairs.push({ open: openBracket, close: delimiter, display: true })
        openBracket = null
      } else {
        unmatched.push(delimiter)
      }
    } else if (delimiter.value === "\\(") {
      if (openParenthesis) unmatched.push(openParenthesis)
      openParenthesis = delimiter
    } else if (delimiter.value === "\\)") {
      if (openParenthesis) {
        pairs.push({ open: openParenthesis, close: delimiter, display: false })
        openParenthesis = null
      } else {
        unmatched.push(delimiter)
      }
    }
  }

  if (openDollar) unmatched.push(openDollar)
  if (openBracket) unmatched.push(openBracket)
  if (openParenthesis) unmatched.push(openParenthesis)

  return {
    pairs: pairs.sort((left, right) => left.open.start - right.open.start),
    unmatched
  }
}

const addBlankLineBefore = (text: string, newline: string) => {
  const trailingNewlines = /(?:\r\n|\n|\r)*$/.exec(text)?.[0].length ?? 0
  const blankLinesNeeded = Math.max(0, 2 - trailingNewlines)
  return text + newline.repeat(blankLinesNeeded)
}

const addBlankLineAfter = (text: string, newline: string) => {
  const leadingNewlines = /^(?:\r\n|\n|\r)*/.exec(text)?.[0].length ?? 0
  const blankLinesNeeded = Math.max(0, 2 - leadingNewlines)
  return newline.repeat(blankLinesNeeded) + text
}

export const normalizeMath = (text: string) => {
  const newline = text.includes("\r\n") ? "\r\n" : "\n"
  const { pairs, unmatched } = getPairs(getMathDelimiters(text))
  const edits: {
    start: number
    end: number
    value: string
    display: boolean
  }[] = pairs.map(({ open, close, display }) => {
    const body = text
      .slice(open.end, close.start)
      .replace(/^(?:\r\n|\n|\r)/, "")
      .replace(/(?:\r\n|\n|\r)$/, "")

    if (display) {
      return {
        start: open.start,
        end: close.end,
        value: `$$${newline}${body}${newline}$$`,
        display: true
      }
    }

    return {
      start: open.start,
      end: close.end,
      value: `$${body}$`,
      display: false
    }
  })

  for (const delimiter of unmatched) {
    if (delimiter.value === "$$") {
      edits.push({
        start: delimiter.start,
        end: delimiter.end,
        value: "\\$\\$",
        display: false
      })
    }
  }

  edits.sort((left, right) => left.start - right.start)
  let output = ""
  let cursor = 0
  let previousWasDisplay = false

  for (const edit of edits) {
    if (edit.start < cursor) continue
    const prefix = text.slice(cursor, edit.start)
    output += previousWasDisplay
      ? addBlankLineAfter(prefix, newline)
      : edit.display
        ? addBlankLineBefore(prefix, newline)
        : prefix
    output += edit.value
    cursor = edit.end
    previousWasDisplay = edit.display
  }

  const suffix = text.slice(cursor)
  output += previousWasDisplay ? addBlankLineAfter(suffix, newline) : suffix

  return output
}
