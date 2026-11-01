import { useEffect } from "react"

const useHotkey = (key: string, callback: () => void, enabled = true): void => {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey && event.shiftKey && event.key === key) {
        event.preventDefault()
        callback()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [key, callback, enabled])
}

export default useHotkey
