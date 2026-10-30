"use client"

import { IconBook } from "@tabler/icons-react"
import Link from "next/link"

export const Brand = () => {
  return (
    <Link
      className="flex cursor-pointer flex-col items-center transition-opacity hover:opacity-80"
      href="/"
    >
      <div className="mb-3 flex size-16 items-center justify-center rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-100 via-white to-violet-100 text-indigo-600 shadow-xl shadow-cyan-900/10 dark:border-cyan-400/25 dark:from-cyan-400/15 dark:via-slate-950 dark:to-indigo-400/15 dark:text-cyan-200">
        <IconBook size={34} stroke={1.6} />
      </div>
      <div className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        BukWorm
      </div>
      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        A clearer way to think with Gemini
      </div>
    </Link>
  )
}
