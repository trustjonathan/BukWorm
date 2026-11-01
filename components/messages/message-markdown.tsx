import { cn } from "@/lib/utils"
import React, { FC, ReactNode } from "react"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { MessageCodeBlock } from "./message-codeblock"
import { MessageMarkdownMemoized } from "./message-markdown-memoized"
import { getStreamingParts } from "./markdown-stream-boundaries"
import { normalizeDisplayMathInLists } from "./normalize-display-math"
import { normalizeMath } from "./normalize-math"

interface MessageMarkdownProps {
  content: string
  isStreaming?: boolean
  newTextStart?: number
  newTextKind?: "word" | "block"
  trailingIndicator?: ReactNode
}

const wrapLastTextNode = (
  children: ReactNode,
  newTextLength: number,
  key: string
): ReactNode | null => {
  if (newTextLength <= 0) return null

  const nodes = React.Children.toArray(children)

  for (let index = nodes.length - 1; index >= 0; index--) {
    const node = nodes[index]

    if (typeof node === "string" && node.length > 0) {
      const tailLength = Math.min(newTextLength, node.length)
      const splitAt = node.length - tailLength
      nodes[index] = (
        <React.Fragment key={`stream-tail-${key}`}>
          {node.slice(0, splitAt)}
          <span key={key} className="matrix-streaming-text">
            {node.slice(splitAt)}
          </span>
        </React.Fragment>
      )
      return nodes
    }

    if (
      React.isValidElement<{ children?: ReactNode }>(node) &&
      node.props.children !== undefined
    ) {
      const wrappedChildren = wrapLastTextNode(
        node.props.children,
        newTextLength,
        key
      )
      if (wrappedChildren) {
        nodes[index] = React.cloneElement(node, {}, wrappedChildren)
        return nodes
      }
    }
  }

  return null
}

export const MessageMarkdown: FC<MessageMarkdownProps> = ({
  content,
  isStreaming = false,
  newTextStart = content.length,
  newTextKind = "word",
  trailingIndicator
}) => {
  const { markdown } = isStreaming
    ? getStreamingParts(content)
    : { markdown: content }
  const renderedMarkdown = normalizeDisplayMathInLists(normalizeMath(markdown))
  const newTextLength =
    renderedMarkdown === markdown
      ? Math.max(0, markdown.length - newTextStart)
      : 0
  const cursorClass = isStreaming
    ? "streaming"
    : trailingIndicator
      ? "streaming-fade"
      : ""
  const isNewBlock = (node?: { position?: { start?: { offset?: number } } }) =>
    newTextKind === "block" &&
    (node?.position?.start?.offset ?? -1) >= newTextStart
  const isLastBlock = (node?: { position?: { end?: { offset?: number } } }) =>
    !!trailingIndicator &&
    (node?.position?.end?.offset ?? -1) >= renderedMarkdown.trimEnd().length

  return (
    <div className="min-w-0 max-w-none break-words text-slate-800 dark:text-slate-100">
      <MessageMarkdownMemoized
        className={cn(
          "prose dark:prose-invert prose-p:leading-[1.75] prose-pre:p-0 prose-li:marker:text-slate-700 dark:prose-li:marker:text-slate-300 min-w-0 max-w-none space-y-6 break-words",
          cursorClass
        )}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
        components={{
          p({ children, node }) {
            const isLastParagraph = isLastBlock(node)
            const animatedChildren = wrapLastTextNode(
              children,
              newTextLength,
              String(renderedMarkdown.length)
            )

            return (
              <p className="mb-2 last:mb-0">
                {animatedChildren ?? children}
                {isLastParagraph && trailingIndicator}
              </p>
            )
          },
          img({ node, ...props }) {
            return <img className="max-w-[67%]" {...props} />
          },
          code({ node, className, children, ...props }) {
            const blockClass = isNewBlock(node) ? "matrix-streaming-block" : ""
            const childArray = React.Children.toArray(children)
            const firstChild = childArray[0] as React.ReactElement
            const firstChildAsString = React.isValidElement(firstChild)
              ? (firstChild as React.ReactElement).props.children
              : firstChild

            if (firstChildAsString === "▍") {
              return (
                <span className="mt-1 animate-pulse cursor-default">▍</span>
              )
            }

            if (typeof firstChildAsString === "string") {
              childArray[0] = firstChildAsString.replace("`▍`", "▍")
            }

            const match = /language-(\w+)/.exec(className || "")

            if (
              typeof firstChildAsString === "string" &&
              !firstChildAsString.includes("\n")
            ) {
              return (
                <code className={cn(className, blockClass)} {...props}>
                  {childArray}
                </code>
              )
            }

            return (
              <MessageCodeBlock
                language={(match && match[1]) || ""}
                value={String(childArray).replace(/\n$/, "")}
                className={blockClass}
                {...props}
              />
            )
          },
          span({ node, className, children, ...props }) {
            if (className?.split(" ").includes("katex-error")) {
              return (
                <code className="bg-muted text-muted-foreground rounded px-1 py-0.5 font-sans text-sm">
                  {children}
                </code>
              )
            }

            return (
              <span
                className={cn(
                  className,
                  className?.split(" ").includes("katex") && isNewBlock(node)
                    ? "matrix-streaming-block"
                    : ""
                )}
                {...props}
              >
                {children}
              </span>
            )
          },
          div({ node, className, children, ...props }) {
            const isDisplayMath = className
              ?.split(" ")
              .includes("katex-display")
            return (
              <>
                <div
                  className={cn(
                    className,
                    isDisplayMath && isNewBlock(node)
                      ? "matrix-streaming-block"
                      : ""
                  )}
                  {...props}
                >
                  {children}
                </div>
                {isDisplayMath && isLastBlock(node) && trailingIndicator}
              </>
            )
          },
          pre({ node, children, ...props }) {
            return (
              <>
                <pre {...props}>{children}</pre>
                {isLastBlock(node) && trailingIndicator}
              </>
            )
          },
          table({ node, children, ...props }) {
            return (
              <>
                <div
                  className={cn(
                    "my-4 overflow-x-auto",
                    isNewBlock(node) && "matrix-streaming-block"
                  )}
                >
                  <table className="w-full border-collapse text-sm" {...props}>
                    {children}
                  </table>
                </div>
                {isLastBlock(node) && trailingIndicator}
              </>
            )
          }
        }}
      >
        {renderedMarkdown}
      </MessageMarkdownMemoized>
    </div>
  )
}
