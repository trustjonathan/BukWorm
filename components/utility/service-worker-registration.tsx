"use client"

import { useEffect } from "react"

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    void navigator.serviceWorker
      .register("/sw.js")
      .catch(error =>
        console.error("Could not register Matrix service worker:", error)
      )
  }, [])

  return null
}
