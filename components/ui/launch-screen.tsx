"use client"

import { useEffect, useState } from "react"

interface LaunchScreenProps {
  autoDismiss?: boolean
  error?: boolean
  onRetry?: () => void
}

export function LaunchScreen({
  autoDismiss = true,
  error = false,
  onRetry
}: LaunchScreenProps) {
  const [leaving, setLeaving] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!autoDismiss) return

    const frame = window.requestAnimationFrame(() => setLeaving(true))
    const timeout = window.setTimeout(() => setVisible(false), 240)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [autoDismiss])

  if (!visible) return null

  return (
    <div
      className="matrix-launch-screen"
      data-state={leaving ? "leaving" : "visible"}
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      aria-label={error ? "Matrix AI could not load" : "Loading Matrix AI"}
    >
      <div className="matrix-launch-content">
        <img
          className="matrix-launch-mark"
          src="/matrix-logo-dark.png"
          alt="Matrix AI"
          width={88}
          height={88}
        />
        {error ? (
          <>
            <div className="matrix-launch-status">
              <strong>Matrix couldn&apos;t load</strong>
              <div>Something interrupted the connection. Please try again.</div>
            </div>
            <button
              className="matrix-launch-retry"
              onClick={onRetry ?? (() => window.location.reload())}
              type="button"
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <p className="matrix-launch-status">
              <span className="matrix-launch-delayed">
                Taking longer than usual...
              </span>
            </p>
            <button
              className="matrix-launch-retry matrix-launch-actions"
              onClick={() => window.location.reload()}
              type="button"
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  )
}
