"use client"

import Image from "next/image"
import Link from "next/link"

export const Brand = () => {
  return (
    <Link
      className="flex cursor-pointer flex-col items-center transition-opacity hover:opacity-80"
      href="/"
    >
      <div className="mb-3 flex size-20 items-center justify-center">
        <Image
          src="/matrix-logo-light.png"
          alt="Matrix AI"
          width={80}
          height={80}
          className="block object-contain dark:hidden"
          priority
        />
        <Image
          src="/matrix-logo-dark.png"
          alt="Matrix AI"
          width={80}
          height={80}
          className="hidden object-contain dark:block"
          priority
        />
      </div>
      <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Matrix AI
      </div>
      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        A clearer way to think with Matrix
      </div>
    </Link>
  )
}
