import { Brand } from "@/components/ui/brand"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import { createClient } from "@/lib/supabase/server"
import { Database } from "@/supabase/types"
import { createServerClient } from "@supabase/ssr"
import { get } from "@vercel/edge-config"
import { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Login"
}

export default async function Login({
  searchParams
}: {
  searchParams: { message?: string; next?: string }
}) {
  const requestedNext = searchParams.next
  const nextPath =
    requestedNext?.startsWith("/") &&
    !requestedNext.startsWith("//") &&
    !requestedNext.includes("\\")
      ? requestedNext
      : null
  const setupPath = nextPath
    ? `/setup?next=${encodeURIComponent(nextPath)}`
    : "/setup"
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
  const session = (await supabase.auth.getSession()).data.session

  if (session) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_model")
      .eq("user_id", session.user.id)
      .single()

    if (profileError) {
      throw new Error(`Could not load your profile: ${profileError.message}`)
    }

    if (!profile.default_model) {
      return redirect(setupPath)
    }

    if (nextPath) {
      return redirect(nextPath)
    }

    const { data: homeWorkspace, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("is_home", true)
      .single()

    if (!homeWorkspace) {
      throw new Error(error.message)
    }

    return redirect(`/${homeWorkspace.id}/chat`)
  }

  const signIn = async (formData: FormData) => {
    "use server"

    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      const nextQuery = nextPath ? `&next=${encodeURIComponent(nextPath)}` : ""
      return redirect(
        `/login?message=${encodeURIComponent(error.message)}${nextQuery}`
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_model")
      .eq("user_id", data.user.id)
      .single()

    if (profileError) {
      throw new Error(`Could not load your profile: ${profileError.message}`)
    }

    if (!profile.default_model) {
      return redirect(setupPath)
    }

    if (nextPath) {
      return redirect(nextPath)
    }

    const { data: homeWorkspace, error: homeWorkspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", data.user.id)
      .eq("is_home", true)
      .single()

    if (!homeWorkspace) {
      throw new Error(
        homeWorkspaceError?.message || "An unexpected error occurred"
      )
    }

    return redirect(`/${homeWorkspace.id}/chat`)
  }

  const getEnvVarOrEdgeConfigValue = async (name: string) => {
    "use server"
    if (process.env.EDGE_CONFIG) {
      return await get<string>(name)
    }

    return process.env[name]
  }

  const signUp = async (formData: FormData) => {
    "use server"

    const emailValue = formData.get("email")
    const email = typeof emailValue === "string" ? emailValue.trim() : ""
    const password = formData.get("password") as string

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const nextQuery = nextPath ? `&next=${encodeURIComponent(nextPath)}` : ""
      return redirect(
        `/login?message=${encodeURIComponent(
          "Please enter a valid email address."
        )}${nextQuery}`
      )
    }

    const emailDomainWhitelistPatternsString = await getEnvVarOrEdgeConfigValue(
      "EMAIL_DOMAIN_WHITELIST"
    )
    const emailDomainWhitelist = emailDomainWhitelistPatternsString?.trim()
      ? emailDomainWhitelistPatternsString?.split(",")
      : []
    const emailWhitelistPatternsString =
      await getEnvVarOrEdgeConfigValue("EMAIL_WHITELIST")
    const emailWhitelist = emailWhitelistPatternsString?.trim()
      ? emailWhitelistPatternsString?.split(",")
      : []

    // If there are whitelist patterns, check if the email is allowed to sign up
    if (emailDomainWhitelist.length > 0 || emailWhitelist.length > 0) {
      const domainMatch = emailDomainWhitelist?.includes(email.split("@")[1])
      const emailMatch = emailWhitelist?.includes(email)
      if (!domainMatch && !emailMatch) {
        return redirect(
          `/login?message=Email ${email} is not allowed to sign up.`
        )
      }
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    const origin = headers().get("origin")

    if (!origin) {
      const nextQuery = nextPath ? `&next=${encodeURIComponent(nextPath)}` : ""
      return redirect(
        `/login?message=${encodeURIComponent(
          "Unable to start email confirmation. Please try signing up again."
        )}${nextQuery}`
      )
    }

    const setupPath = nextPath
      ? `/setup?next=${encodeURIComponent(nextPath)}`
      : "/setup"

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
          setupPath
        )}`
      }
    })

    if (error) {
      console.error(error)
      return redirect(`/login?message=${error.message}`)
    }

    if (!data.session) {
      const message = `We sent a confirmation link to ${email}. Check your inbox and spam folder, then click the link to confirm your email before signing in.`
      const nextQuery = nextPath ? `&next=${encodeURIComponent(nextPath)}` : ""
      return redirect(
        `/login?message=${encodeURIComponent(message)}${nextQuery}`
      )
    }

    return redirect(setupPath)
  }

  const handleResetPassword = async (formData: FormData) => {
    "use server"

    const origin = headers().get("origin")
    const email = formData.get("email") as string
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/login/password`
    })

    if (error) {
      return redirect(`/login?message=${error.message}`)
    }

    return redirect("/login?message=Check email to reset password")
  }

  return (
    <div className="flex w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
      <form
        className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2"
        action={signIn}
      >
        <Brand />

        <Label className="mt-4 text-base" htmlFor="email">
          Email
        </Label>
        <Input
          className="mb-3 rounded-md border bg-inherit px-4 py-2"
          type="email"
          name="email"
          placeholder="you@example.com"
          required
        />

        <Label className="text-base" htmlFor="password">
          Password
        </Label>
        <Input
          className="mb-6 rounded-md border bg-inherit px-4 py-2"
          type="password"
          name="password"
          placeholder="••••••••"
        />

        <SubmitButton className="mb-2 rounded-md bg-blue-700 px-4 py-2 text-white">
          Login
        </SubmitButton>

        <SubmitButton
          formAction={signUp}
          className="border-foreground/20 mb-2 rounded-md border px-4 py-2"
        >
          Sign Up
        </SubmitButton>

        <div className="text-muted-foreground mt-1 flex justify-center text-sm">
          <span className="mr-1">Forgot your password?</span>
          <button
            formAction={handleResetPassword}
            className="text-primary ml-1 underline hover:opacity-80"
          >
            Reset
          </button>
        </div>

        {searchParams?.message && (
          <p className="bg-foreground/10 text-foreground mt-4 p-4 text-center">
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}
