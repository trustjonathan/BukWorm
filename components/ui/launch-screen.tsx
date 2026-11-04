"use client"

import { useEffect, useState } from "react"

interface LaunchScreenProps {
  active?: boolean
  delayMs?: number
  error?: boolean
  listenForAppReadiness?: boolean
  onRetry?: () => void
}

const LAUNCH_DELAY_MS = 900

export function LaunchScreen({
  active = true,
  delayMs = LAUNCH_DELAY_MS,
  error = false,
  listenForAppReadiness = false,
  onRetry
}: LaunchScreenProps) {
  const [leaving, setLeaving] = useState(false)
  const [visible, setVisible] = useState(error)
  const [isActive, setIsActive] = useState(active)
  const [showDelayed, setShowDelayed] = useState(false)
  const [showRetry, setShowRetry] = useState(false)

  useEffect(() => {
    setIsActive(active)
  }, [active])

  useEffect(() => {
    if (!listenForAppReadiness) return

    const showLoading = () => setIsActive(true)
    const finishLoading = () => setIsActive(false)
    window.addEventListener("matrix:app-loading", showLoading)
    window.addEventListener("matrix:app-ready", finishLoading)
    if (document.documentElement.dataset.matrixAppLoading === "true") {
      setIsActive(true)
    }

    return () => {
      window.removeEventListener("matrix:app-loading", showLoading)
      window.removeEventListener("matrix:app-ready", finishLoading)
    }
  }, [listenForAppReadiness])

  useEffect(() => {
    if (error || !isActive) {
      setShowDelayed(false)
      setShowRetry(false)
      return
    }

    setShowDelayed(false)
    setShowRetry(false)
    const delayedTimeout = window.setTimeout(() => setShowDelayed(true), 6000)
    const retryTimeout = window.setTimeout(() => setShowRetry(true), 15000)

    return () => {
      window.clearTimeout(delayedTimeout)
      window.clearTimeout(retryTimeout)
    }
  }, [error, isActive])

  useEffect(() => {
    if (error) {
      setVisible(true)
      setLeaving(false)
      return
    }

    let hideTimeout: number | undefined
    if (!isActive) {
      if (visible) {
        setLeaving(true)
        hideTimeout = window.setTimeout(() => setVisible(false), 260)
      }

      return () => {
        if (hideTimeout !== undefined) window.clearTimeout(hideTimeout)
      }
    }

    setLeaving(false)
    const showTimeout = window.setTimeout(() => setVisible(true), delayMs)

    return () => {
      window.clearTimeout(showTimeout)
      if (hideTimeout !== undefined) window.clearTimeout(hideTimeout)
    }
  }, [delayMs, error, isActive, visible])

  return (
    <div
      className="matrix-launch-screen"
      data-state={!visible ? "hidden" : leaving ? "leaving" : "visible"}
      aria-hidden={!visible || leaving}
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
              {showDelayed && (
                <span className="matrix-launch-delayed">
                  Taking longer than usual...
                </span>
              )}
            </p>
            {showRetry && (
              <button
                className="matrix-launch-retry matrix-launch-actions"
                onClick={() => window.location.reload()}
                type="button"
              >
                Retry
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
