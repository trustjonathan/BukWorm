import { IconArrowRight, IconSparkles } from "@tabler/icons-react"
import { createServerClient } from "@supabase/ssr"
import Image from "next/image"
import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Database } from "@/supabase/types"

export default async function HomePage({
  params: { locale }
}: {
  params: { locale: string }
}) {
  const cookieStore = cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        }
      }
    }
  )

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()
  const showLandingAfterLogin =
    cookieStore.get("matrix_show_landing_after_login")?.value === "1"

  if (authError) {
    throw new Error(`Could not verify your session: ${authError.message}`)
  }

  let chatHref = `/${locale}/login`
  let actionLabel = "Start chatting"

  if (user) {
    const { data: homeWorkspace, error: homeWorkspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_home", true)
      .maybeSingle()

    if (homeWorkspaceError) {
      throw new Error(
        `Could not load your home workspace: ${homeWorkspaceError.message}`
      )
    }

    let workspaceId = homeWorkspace?.id

    if (!workspaceId) {
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()

      if (workspaceError) {
        throw new Error(
          `Could not load your workspace: ${workspaceError.message}`
        )
      }

      workspaceId = workspace?.id
    }

    if (!workspaceId) {
      redirect(`/${locale}/setup`)
    }

    if (!showLandingAfterLogin) {
      redirect(`/${locale}/${workspaceId}/chat`)
    }

    chatHref = `/${locale}/${workspaceId}/chat`
    actionLabel = "Continue chatting"
  }

  return (
    <div className="bg-background text-foreground relative flex size-full flex-col items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute -left-36 -top-40 size-[30rem] rounded-full bg-cyan-300/15 blur-3xl dark:bg-cyan-500/10" />
      <div className="pointer-events-none absolute -bottom-48 -right-36 size-[32rem] rounded-full bg-indigo-300/15 blur-3xl dark:bg-indigo-500/10" />

      <div className="relative flex max-w-2xl flex-col items-center text-center">
        <div className="mb-6 flex size-20 items-center justify-center">
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

        <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          Matrix AI
          <IconSparkles className="text-primary" />
        </div>
        <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed">
          Your intelligent workspace, reading companion, and reasoning assistant
          — powered by Matrix.
        </p>

        <Link
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring mt-8 inline-flex min-h-10 items-center gap-2 rounded-md px-6 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          href={chatHref}
        >
          {actionLabel}
          <IconArrowRight />
        </Link>
      </div>
    </div>
  )
}
