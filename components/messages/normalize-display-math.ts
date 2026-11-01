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

const findDoubleDollar = (line: string, start: number) => {
  for (let index = start; index < line.length; index++) {
    if (line[index] === "`") {
      let runLength = 1
      while (line[index + runLength] === "`") runLength += 1
      const codeDelimiter = "`".repeat(runLength)
      const closeIndex = line.indexOf(codeDelimiter, index + runLength)
      if (closeIndex !== -1) {
        index = closeIndex + runLength - 1
        continue
      }
    }

    if (line.startsWith("$$", index) && !isEscaped(line, index)) return index
  }

  return -1
}

export const normalizeDisplayMathInLists = (markdown: string) => {
  const output: string[] = []
  let fenceCharacter = ""
  let fenceLength = 0

  for (const line of markdown.split("\n")) {
    const fence = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]

    if (fence) {
      if (!fenceCharacter) {
        fenceCharacter = fence[0]
        fenceLength = fence.length
      } else if (fence[0] === fenceCharacter && fence.length >= fenceLength) {
        fenceCharacter = ""
        fenceLength = 0
      }
      output.push(line)
      continue
    }

    if (fenceCharacter) {
      output.push(line)
      continue
    }

    const listItem = /^(\s*)([-+*]|\d+[.)])(\s+)(.*)$/.exec(line)
    if (!listItem) {
      output.push(line)
      continue
    }

    const [, indent, marker, spacing, body] = listItem
    const firstOpen = findDoubleDollar(body, 0)
    if (firstOpen < 0) {
      output.push(line)
      continue
    }

    const firstClose = findDoubleDollar(body, firstOpen + 2)
    if (firstClose < 0) {
      output.push(line)
      continue
    }

    const continuation = " ".repeat(
      indent.length + marker.length + spacing.length
    )
    output.push(
      `${indent}${marker}${spacing}${body.slice(0, firstOpen).trimEnd()}`
    )
    output.push(
      "",
      `${continuation}$$`,
      `${continuation}${body.slice(firstOpen + 2, firstClose).trim()}`,
      `${continuation}$$`
    )

    let remainder = body.slice(firstClose + 2)
    let open = findDoubleDollar(remainder, 0)
    while (open >= 0) {
      const close = findDoubleDollar(remainder, open + 2)
      if (close < 0) break

      const between = remainder.slice(0, open).trim()
      if (between) output.push("", `${continuation}${between}`)
      output.push(
        "",
        `${continuation}$$`,
        `${continuation}${remainder.slice(open + 2, close).trim()}`,
        `${continuation}$$`
      )
      remainder = remainder.slice(close + 2)
      open = findDoubleDollar(remainder, 0)
    }

    const between = remainder
      .slice(0, open >= 0 ? open : remainder.length)
      .trim()
    if (between) output.push("", `${continuation}${between}`)

    if (open >= 0) {
      output.push(
        "",
        `${continuation}$$`,
        `${continuation}${remainder.slice(open + 2).trim()}`,
        `${continuation}$$`
      )
    }
  }

  return output.join("\n")
}
