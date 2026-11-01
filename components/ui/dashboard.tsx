"use client"

export const SIDEBAR_WIDTH = 280

import { MatrixSidebar } from "@/components/sidebar/matrix-sidebar"
import { ChatbotUIContext } from "@/context/context"
import useHotkey from "@/lib/hooks/use-hotkey"
import { cn } from "@/lib/utils"
import { FC, useContext, useRef, useState } from "react"
import { useSelectFileHandler } from "../chat/chat-hooks/use-select-file-handler"
import { CommandK } from "../utility/command-k"

interface DashboardProps {
  children: React.ReactNode
}

export const Dashboard: FC<DashboardProps> = ({ children }) => {
  const { showSidebar, setShowSidebar } = useContext(ChatbotUIContext)

  const setSidebarVisible = (visible: boolean) => {
    setShowSidebar(visible)
    localStorage.setItem("showSidebar", String(visible))
  }

  useHotkey("s", () => setSidebarVisible(!showSidebar))

  const { handleSelectDeviceFiles } = useSelectFileHandler()
  const [isDragging, setIsDragging] = useState(false)
  const dragDepth = useRef(0)

  // Mobile swipe gestures
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current

    // Reveal on scroll/swipe right from left edge on mobile
    if (
      !showSidebar &&
      touchStartX.current < 65 &&
      deltaX > 45 &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      setSidebarVisible(true)
    }
    // Close on swipe left when sidebar is open on mobile
    else if (
      showSidebar &&
      deltaX < -50 &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      setSidebarVisible(false)
    }

    touchStartX.current = null
    touchStartY.current = null
  }

  const onFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    if (files.length > 0) {
      void handleSelectDeviceFiles(files)
    }
    dragDepth.current = 0
    setIsDragging(false)
  }

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current += 1
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  return (
    <div
      className="flex size-full overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[#070a13] dark:text-slate-100"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <CommandK />

      {showSidebar && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarVisible(false)}
        />
      )}
      <div
        className={cn(
          "h-full shrink-0 overflow-hidden transition-[width,transform] duration-300 ease-in-out",
          showSidebar
            ? "fixed inset-y-0 left-0 z-50 w-[285px] max-w-[85vw] shadow-2xl lg:relative lg:z-auto lg:w-[280px] lg:max-w-none lg:shadow-none"
            : "hidden lg:block lg:w-0"
        )}
      >
        <MatrixSidebar onClose={() => setSidebarVisible(false)} />
      </div>

      {/* ── Main Workspace Content Area ─────────────────────────────────── */}
      <div
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
        onDrop={onFileDrop}
        onDragOver={onDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        {isDragging ? (
          <div className="flex h-full items-center justify-center bg-black/60 text-xl font-medium text-white backdrop-blur-sm">
            Drop files to attach
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
