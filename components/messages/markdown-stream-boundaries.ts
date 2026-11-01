const findUnclosedFence = (content: string) => {
  let offset = 0
  let openFenceStart = -1
  let openFenceCharacter = ""
  let openFenceLength = 0

  for (const line of content.split("\n")) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]

    if (marker) {
      if (!openFenceCharacter) {
        openFenceStart = offset
        openFenceCharacter = marker[0]
        openFenceLength = marker.length
      } else if (
        marker[0] === openFenceCharacter &&
        marker.length >= openFenceLength
      ) {
        openFenceStart = -1
        openFenceCharacter = ""
        openFenceLength = 0
      }
    }

    offset += line.length + 1
  }

  return openFenceStart
}

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

const isTableRow = (line: string) =>
  line.trim().startsWith("|") && line.trim().split("|").length > 2

const isTableSeparator = (line: string) =>
  /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)

const findUnclosedTable = (content: string) => {
  const lines = content.split("\n")
  let offset = 0
  let fenceCharacter = ""
  let fenceLength = 0

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]

    if (marker) {
      if (!fenceCharacter) {
        fenceCharacter = marker[0]
        fenceLength = marker.length
      } else if (marker[0] === fenceCharacter && marker.length >= fenceLength) {
        fenceCharacter = ""
        fenceLength = 0
      }
      offset += line.length + 1
      continue
    }

    if (fenceCharacter || !isTableRow(line)) {
      offset += line.length + 1
      continue
    }

    const nextLine = lines[index + 1]
    if (nextLine === undefined) return offset
    if (!isTableSeparator(nextLine)) {
      if (isTableRow(nextLine) && nextLine.includes("-") && !lines[index + 2]) {
        return offset
      }
      offset += line.length + 1
      continue
    }

    let rowIndex = index + 2
    while (
      rowIndex < lines.length &&
      lines[rowIndex].trim() !== "" &&
      isTableRow(lines[rowIndex])
    ) {
      rowIndex += 1
    }

    if (rowIndex === lines.length) return offset

    offset += line.length + 1
  }

  return -1
}

const findUnclosedMath = (content: string) => {
  let offset = 0
  let openDelimiter: string | null = null
  let openStart = -1
  let openCodeDelimiter: string | null = null
  let openCodeStart = -1
  let fenceCharacter = ""
  let fenceLength = 0

  for (const line of content.split("\n")) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]

    if (marker) {
      if (!fenceCharacter) {
        fenceCharacter = marker[0]
        fenceLength = marker.length
      } else if (marker[0] === fenceCharacter && marker.length >= fenceLength) {
        fenceCharacter = ""
        fenceLength = 0
      }
      offset += line.length + 1
      continue
    }

    if (fenceCharacter) {
      offset += line.length + 1
      continue
    }

    for (let index = 0; index < line.length; index++) {
      if (openCodeDelimiter) {
        if (line[index] !== "`") continue

        let runLength = 1
        while (line[index + runLength] === "`") runLength += 1
        if ("`".repeat(runLength) === openCodeDelimiter) {
          openCodeDelimiter = null
          openCodeStart = -1
          index += runLength - 1
        }
        continue
      }

      if (line[index] === "`") {
        let runLength = 1
        while (line[index + runLength] === "`") runLength += 1
        const codeDelimiter = "`".repeat(runLength)
        const closeIndex = line.indexOf(codeDelimiter, index + runLength)
        if (closeIndex !== -1) {
          index = closeIndex + runLength - 1
          continue
        }
        openCodeDelimiter = codeDelimiter
        openCodeStart = offset + index
        index = line.length
        continue
      }

      let token = ""
      if (line.startsWith("\\[", index) || line.startsWith("\\(", index)) {
        if (!isEscaped(line, index)) token = line.slice(index, index + 2)
      } else if (
        line.startsWith("\\]", index) ||
        line.startsWith("\\)", index)
      ) {
        if (!isEscaped(line, index)) token = line.slice(index, index + 2)
      } else if (line[index] === "$" && !isEscaped(line, index)) {
        token = line.startsWith("$$", index) ? "$$" : "$"
      }

      if (!token) continue

      if (openDelimiter) {
        const expectedClose =
          openDelimiter === "\\["
            ? "\\]"
            : openDelimiter === "\\("
              ? "\\)"
              : openDelimiter
        if (token === expectedClose) {
          openDelimiter = null
          openStart = -1
          index += token.length - 1
        }
      } else if (
        token === "$" ||
        token === "$$" ||
        token === "\\[" ||
        token === "\\("
      ) {
        openDelimiter = token
        openStart = offset + index
        index += token.length - 1
      }
    }

    offset += line.length + 1
  }

  const openStarts = [openStart, openCodeStart].filter(start => start >= 0)
  return openStarts.length > 0 ? Math.min(...openStarts) : -1
}

const findUnclosedStrongEmphasis = (content: string) => {
  let openStart = -1

  for (let index = 0; index < content.length; index++) {
    if (content[index] === "`") {
      let runLength = 1
      while (content[index + runLength] === "`") runLength += 1
      const codeDelimiter = "`".repeat(runLength)
      const closeIndex = content.indexOf(codeDelimiter, index + runLength)
      if (closeIndex !== -1) {
        index = closeIndex + runLength - 1
        continue
      }
    }

    if (content[index] === "$" && !isEscaped(content, index)) {
      const mathDelimiter = content.startsWith("$$", index) ? "$$" : "$"
      const closeIndex = content.indexOf(
        mathDelimiter,
        index + mathDelimiter.length
      )
      if (closeIndex !== -1) {
        index = closeIndex + mathDelimiter.length - 1
        continue
      }
    }

    if (
      !content.startsWith("**", index) ||
      isEscaped(content, index) ||
      content[index - 1] === "*" ||
      content[index + 2] === "*"
    ) {
      continue
    }

    if (openStart < 0) {
      openStart = index
    } else {
      openStart = -1
    }

    index += 1
  }

  return openStart
}

export const getStreamingParts = (content: string) => {
  let safeEnd = findUnclosedFence(content)
  if (safeEnd < 0) safeEnd = content.length

  const prefix = content.slice(0, safeEnd)
  const tableStart = findUnclosedTable(prefix)
  if (tableStart >= 0) safeEnd = Math.min(safeEnd, tableStart)

  const mathStart = findUnclosedMath(content.slice(0, safeEnd))
  if (mathStart >= 0) safeEnd = Math.min(safeEnd, mathStart)

  const strongStart = findUnclosedStrongEmphasis(content.slice(0, safeEnd))
  if (strongStart >= 0) safeEnd = Math.min(safeEnd, strongStart)

  return {
    markdown: content.slice(0, safeEnd),
    pending: content.slice(safeEnd)
  }
}

export interface StreamingRevealUnit {
  end: number
  kind: "word" | "block"
}

const MAX_REVEAL_WORD_LENGTH = 32

const findMatchingDelimiter = (
  content: string,
  start: number,
  delimiter: string
) => {
  for (
    let index = start + delimiter.length;
    index <= content.length - delimiter.length;
    index++
  ) {
    if (content.startsWith(delimiter, index) && !isEscaped(content, index)) {
      return index + delimiter.length
    }
  }

  return -1
}

const findTableEnd = (content: string, start: number) => {
  if (content.lastIndexOf("\n", start - 1) + 1 !== start) return -1

  const lines = content.slice(start).split("\n")
  if (!isTableRow(lines[0]) || !isTableSeparator(lines[1] || "")) return -1

  let end = start + lines[0].length + 1 + lines[1].length
  for (let index = 2; index < lines.length; index++) {
    if (!lines[index].trim() || !isTableRow(lines[index])) break
    end += 1 + lines[index].length
  }

  return end
}

const findAtomicRevealUnit = (
  content: string,
  start: number
): StreamingRevealUnit | null => {
  const lineStart = content.lastIndexOf("\n", start - 1) + 1
  if (lineStart === start) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(content.slice(start))?.[1]
    if (marker) {
      let offset = start
      const lines = content.slice(start).split("\n")
      for (let index = 0; index < lines.length; index++) {
        const close =
          index > 0 ? /^\s*(`{3,}|~{3,})/.exec(lines[index])?.[1] : undefined
        offset += lines[index].length + 1
        if (close && close[0] === marker[0] && close.length >= marker.length) {
          return { end: Math.min(offset, content.length), kind: "block" }
        }
      }
      return null
    }

    const tableEnd = findTableEnd(content, start)
    if (tableEnd >= 0) return { end: tableEnd, kind: "block" }
  }

  if (content[start] === "`") {
    let runLength = 1
    while (content[start + runLength] === "`") runLength += 1
    const end = findMatchingDelimiter(content, start, "`".repeat(runLength))
    if (end >= 0) return { end, kind: "block" }
  }

  if (content[start] === "$" && !isEscaped(content, start)) {
    const delimiter = content.startsWith("$$", start) ? "$$" : "$"
    const end = findMatchingDelimiter(content, start, delimiter)
    if (end >= 0) return { end, kind: "block" }
  }

  if (
    (content.startsWith("\\(", start) || content.startsWith("\\[", start)) &&
    !isEscaped(content, start)
  ) {
    const delimiter = content.slice(start, start + 2)
    const close = delimiter === "\\(" ? "\\)" : "\\]"
    const end = findMatchingDelimiter(content, start, close)
    if (end >= 0) return { end, kind: "block" }
  }

  return null
}

export const getStreamingRevealUnits = (
  content: string,
  includeTrailingWord = true
) => {
  const safeContent = getStreamingParts(content).markdown
  const units: StreamingRevealUnit[] = []
  let cursor = 0

  while (cursor < safeContent.length) {
    const atomicUnit = findAtomicRevealUnit(safeContent, cursor)
    if (atomicUnit) {
      units.push(atomicUnit)
      cursor = atomicUnit.end
      continue
    }

    let end = cursor
    let hasWord = false
    let wordClosed = false
    while (end < safeContent.length) {
      if (findAtomicRevealUnit(safeContent, end)) break

      if (/\s/.test(safeContent[end])) {
        end += 1
        if (hasWord) {
          wordClosed = true
          while (end < safeContent.length && /\s/.test(safeContent[end])) {
            end += 1
          }
          break
        }
        continue
      }

      hasWord = true
      end += 1
      if (end - cursor >= MAX_REVEAL_WORD_LENGTH) break
    }

    if (
      hasWord &&
      !wordClosed &&
      end === safeContent.length &&
      !includeTrailingWord
    ) {
      break
    }

    if (end === cursor) end += 1
    units.push({ end, kind: "word" })
    cursor = end
  }

  return units
}
