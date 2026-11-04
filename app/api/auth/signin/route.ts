import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"
import i18nConfig from "@/i18nConfig"
import { Database } from "@/supabase/types"

interface PendingCookie {
  name: string
  value: string
  options: CookieOptions
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const emailValue = formData.get("email")
  const passwordValue = formData.get("password")
  const requestedLocale = formData.get("locale")
  const requestedNext = formData.get("next")
  const locale =
    typeof requestedLocale === "string" &&
    i18nConfig.locales.includes(requestedLocale)
      ? requestedLocale
      : i18nConfig.defaultLocale
  const nextPath =
    typeof requestedNext === "string" &&
    requestedNext.startsWith("/") &&
    !requestedNext.startsWith("//") &&
    !requestedNext.includes("\\")
      ? requestedNext
      : null
  const loginUrl = (message: string) => {
    const url = new URL(`/${locale}/login`, request.url)
    url.searchParams.set("message", message)
    if (nextPath) url.searchParams.set("next", nextPath)
    return url
  }

  if (
    typeof emailValue !== "string" ||
    !emailValue.trim() ||
    typeof passwordValue !== "string" ||
    !passwordValue
  ) {
    return NextResponse.redirect(
      loginUrl("Enter your email and password to sign in."),
      303
    )
  }

  const pendingCookies: PendingCookie[] = []
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          pendingCookies.push({ name, value, options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.delete(name)
          pendingCookies.push({ name, value: "", options })
        }
      }
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailValue.trim(),
    password: passwordValue
  })

  let destination: URL

  if (error) {
    destination = loginUrl(error.message)
  } else {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_model")
      .eq("user_id", data.user.id)
      .maybeSingle()

    if (profileError) {
      destination = loginUrl(
        `Could not load your profile: ${profileError.message}`
      )
    } else if (!profile?.default_model) {
      destination = new URL(
        nextPath
          ? `/${locale}/setup?next=${encodeURIComponent(nextPath)}`
          : `/${locale}/setup`,
        request.url
      )
    } else if (nextPath) {
      destination = new URL(nextPath, request.url)
    } else {
      const { data: homeWorkspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", data.user.id)
        .eq("is_home", true)
        .maybeSingle()

      if (workspaceError) {
        destination = loginUrl(
          `Could not load your workspace: ${workspaceError.message}`
        )
      } else if (!homeWorkspace) {
        destination = new URL(`/${locale}/setup`, request.url)
      } else {
        destination = new URL(`/${locale}`, request.url)
        pendingCookies.push({
          name: "matrix_show_landing_after_login",
          value: "1",
          options: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 120
          }
        })
      }
    }
  }

  const response = NextResponse.redirect(destination, 303)
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  return response
}
