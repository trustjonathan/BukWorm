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

  useHotkey("s", () => {
    setShowSidebar(prev => {
      const next = !prev
      localStorage.setItem("showSidebar", String(next))
      return next
    })
  })

  const { handleSelectDeviceFile } = useSelectFileHandler()
  const [isDragging, setIsDragging] = useState(false)

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
      setShowSidebar(true)
    }
    // Close on swipe left when sidebar is open on mobile
    else if (
      showSidebar &&
      deltaX < -50 &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      setShowSidebar(false)
    }

    touchStartX.current = null
    touchStartY.current = null
  }

  const onFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    if (files.length > 0) {
      handleSelectDeviceFile(files[0])
    }
    setIsDragging(false)
  }

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
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

      {/* ── Desktop Single Unified Sidebar ──────────────────────────────── */}
      <div
        className={cn(
          "hidden h-full shrink-0 transition-all duration-300 ease-in-out lg:block",
          showSidebar ? "w-[280px]" : "w-0 overflow-hidden"
        )}
      >
        <MatrixSidebar />
      </div>

      {/* ── Mobile Off-canvas Drawer Sidebar (Reveals on swipe/scroll right) ── */}
      <div
        className={cn(
          "fixed inset-0 z-50 transition-opacity duration-300 lg:hidden",
          showSidebar
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setShowSidebar(false)}
        />
        {/* Drawer panel */}
        <div
          className={cn(
            "relative h-full w-[285px] max-w-[85vw] shadow-2xl transition-transform duration-300 ease-in-out",
            showSidebar ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <MatrixSidebar onClose={() => setShowSidebar(false)} />
        </div>
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
            Drop file to attach
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
