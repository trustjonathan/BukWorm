import { createClient } from "@/lib/supabase/middleware"
import { i18nRouter } from "next-i18n-router"
import { NextResponse, type NextRequest } from "next/server"
import i18nConfig from "./i18nConfig"

export async function middleware(request: NextRequest) {
  const legacyInviteMatch = request.nextUrl.pathname.match(
    /^\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/invite\/([0-9a-f]{64})\/?$/i
  )

  if (legacyInviteMatch) {
    const inviteUrl = request.nextUrl.clone()
    inviteUrl.pathname = `/invite/${legacyInviteMatch[1]}`
    inviteUrl.search = ""
    return NextResponse.redirect(inviteUrl)
  }

  const i18nResult = i18nRouter(request, i18nConfig)
  const showLandingAfterLogin =
    request.cookies.get("matrix_show_landing_after_login")?.value === "1"

  try {
    const { supabase, response } = createClient(request)
    const {
      data: { user }
    } = await supabase.auth.getUser()

    const pathSegments = request.nextUrl.pathname.split("/").filter(Boolean)
    const locale =
      pathSegments.length === 0
        ? i18nConfig.defaultLocale
        : i18nConfig.locales.includes(pathSegments[0])
          ? pathSegments[0]
          : null
    const isLocaleLandingPage =
      locale !== null &&
      (pathSegments.length === 0 || pathSegments.length === 1)

    if (user && isLocaleLandingPage && !showLandingAfterLogin) {
      const { data: homeWorkspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_home", true)
        .maybeSingle()

      if (homeWorkspace) {
        return NextResponse.redirect(
          new URL(`/${locale}/${homeWorkspace.id}/chat`, request.url)
        )
      }
    }

    const middlewareResponse = i18nResult ?? response
    if (user && showLandingAfterLogin && pathSegments.length === 1 && locale) {
      middlewareResponse.cookies.set("matrix_show_landing_after_login", "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0
      })
    }

    return middlewareResponse
  } catch (e) {
    console.error("Locale landing redirect failed:", e)
    return i18nResult ?? NextResponse.next()
  }
}

export const config = {
  matcher: "/((?!api|static|.*\\..*|_next|auth).*)"
}
