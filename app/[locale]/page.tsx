"use client"

import { IconArrowRight, IconSparkles } from "@tabler/icons-react"
import Image from "next/image"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="relative flex size-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 via-white to-violet-100 px-6 text-slate-900 dark:from-[#080d1a] dark:via-[#10172a] dark:to-[#17112c] dark:text-slate-100">
      <div className="pointer-events-none absolute -left-36 -top-40 size-[30rem] rounded-full bg-cyan-300/25 blur-3xl dark:bg-cyan-500/10" />
      <div className="pointer-events-none absolute -bottom-48 -right-36 size-[32rem] rounded-full bg-violet-300/25 blur-3xl dark:bg-violet-500/10" />

      <div className="relative flex max-w-2xl flex-col items-center text-center">
        <div className="mb-6 flex size-24 items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
          <Image
            src="/matrix-black.png"
            alt="Matrix AI"
            width={72}
            height={72}
            className="block object-contain dark:hidden"
            priority
          />
          <Image
            src="/matrix-white.png"
            alt="Matrix AI"
            width={72}
            height={72}
            className="hidden object-contain dark:block"
            priority
          />
        </div>

        <div className="flex items-center gap-2 text-5xl font-bold tracking-tight">
          Matrix AI
          <IconSparkles
            className="text-cyan-600 dark:text-cyan-300"
            size={26}
          />
        </div>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          Your intelligent workspace, reading companion, and reasoning assistant
          — powered by Matrix.
        </p>

        <Link
          className="mt-8 inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3 font-semibold text-white shadow-xl shadow-cyan-900/20 transition hover:-translate-y-0.5 hover:shadow-cyan-900/30"
          href="/login"
        >
          Start chatting
          <IconArrowRight size={19} />
        </Link>
      </div>
    </div>
  )
}
