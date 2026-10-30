import { FC } from "react"

interface ThreadConnectorProps {
  /** True for the last child in a list — stops the vertical trunk line */
  isLast?: boolean
  /** Depth level — root=0, first nested=1, etc. */
  depth?: number
}

/**
 * Renders the vertical spine line + curved elbow that branches into a child node.
 * Matches the git-graph / comment-tree visual in the design mockup.
 */
export const ThreadConnector: FC<ThreadConnectorProps> = ({
  isLast = false,
  depth = 0
}) => {
  const spineColor =
    depth === 0
      ? "stroke-slate-700 dark:stroke-slate-700"
      : "stroke-slate-800 dark:stroke-slate-800"

  return (
    <svg
      className={`absolute left-[19px] top-0 w-[2px] shrink-0 overflow-visible ${spineColor}`}
      style={{ height: isLast ? "24px" : "100%" }}
      aria-hidden="true"
    >
      {/* Vertical trunk line */}
      {!isLast && (
        <line
          x1="1"
          y1="0"
          x2="1"
          y2="100%"
          strokeWidth="2"
          className={spineColor}
        />
      )}
    </svg>
  )
}

/**
 * The curved elbow that turns left-to-right from the parent spine into a child.
 * Rendered to the LEFT of the child's avatar.
 */
export const BranchElbow: FC<{ isLast?: boolean }> = ({ isLast = false }) => (
  <svg
    className="shrink-0 overflow-visible text-slate-700 dark:text-slate-700"
    width="28"
    height="40"
    viewBox="0 0 28 40"
    aria-hidden="true"
  >
    {/* Vertical portion of elbow — connects downward from parent */}
    {!isLast && (
      <line
        x1="1"
        y1="0"
        x2="1"
        y2="40"
        stroke="currentColor"
        strokeWidth="2"
      />
    )}
    {/* Curved horizontal turn */}
    <path
      d="M 1 20 Q 1 32, 14 32 L 28 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)
