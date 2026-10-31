"use client"

import Image from "next/image"
import Link from "next/link"

export const Brand = () => {
  return (
    <Link
      className="flex cursor-pointer flex-col items-center transition-opacity hover:opacity-80"
      href="/"
    >
      <div className="mb-3 flex size-16 items-center justify-center rounded-2xl border border-cyan-200 bg-white p-2.5 shadow-xl shadow-cyan-900/10 dark:border-cyan-400/25 dark:bg-slate-900 dark:shadow-cyan-950/40">
        <Image
          src="/matrix.png"
          alt="Matrix AI"
          width={48}
          height={48}
          className="object-contain"
          priority
        />
      </div>
      <div className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Matrix AI
      </div>
      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        A clearer way to think with Matrix
      </div>
    </Link>
  )
}
