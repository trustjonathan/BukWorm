"use client"

import { useEffect } from "react"

export default function Loading() {
  useEffect(() => {
    document.documentElement.dataset.matrixAppLoading = "true"
    window.dispatchEvent(new Event("matrix:app-loading"))

    return () => {
      delete document.documentElement.dataset.matrixAppLoading
      window.dispatchEvent(new Event("matrix:app-ready"))
    }
  }, [])

  return null
}
