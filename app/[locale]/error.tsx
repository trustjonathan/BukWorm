"use client"

import { LaunchScreen } from "@/components/ui/launch-screen"
import { useEffect } from "react"

export default function LocaleError({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Matrix page failed to render:", error)
  }, [error])

  return <LaunchScreen autoDismiss={false} error onRetry={reset} />
}
