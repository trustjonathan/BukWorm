import { createClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/site-url"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const siteUrl = getSiteUrl(request.headers, request.url)
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next")

  if (code) {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    await supabase.auth.exchangeCodeForSession(code)
  }

  const nextPath =
    next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
      ? next
      : "/"
  const redirectUrl = new URL(nextPath, siteUrl)

  if (redirectUrl.origin !== siteUrl) {
    redirectUrl.pathname = "/"
    redirectUrl.search = ""
    redirectUrl.hash = ""
  }

  return NextResponse.redirect(redirectUrl)
}
