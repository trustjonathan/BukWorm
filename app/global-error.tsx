"use client"

import { LaunchScreen } from "@/components/ui/launch-screen"
import { LAUNCH_BACKGROUND, LAUNCH_CRITICAL_CSS } from "@/lib/launch-screen"
import { useEffect } from "react"

export default function GlobalError({
  error
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    console.error("Matrix app shell failed to render:", error)
  }, [error])

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content={LAUNCH_BACKGROUND} />
        <style dangerouslySetInnerHTML={{ __html: LAUNCH_CRITICAL_CSS }} />
      </head>
      <body>
        <LaunchScreen autoDismiss={false} error />
      </body>
    </html>
  )
}
