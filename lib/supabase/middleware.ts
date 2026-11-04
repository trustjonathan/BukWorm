import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export const createClient = (request: NextRequest) => {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  })

  const updateResponseCookie = (
    name: string,
    value: string,
    options: CookieOptions
  ) => {
    const updatedResponse = NextResponse.next({
      request: {
        headers: request.headers
      }
    })
    response.cookies.getAll().forEach(cookie => {
      updatedResponse.cookies.set(cookie)
    })
    updatedResponse.cookies.set(name, value, options)
    response = updatedResponse
  }

  const projectRef = new URL(
    process.env.NEXT_PUBLIC_SUPABASE_URL!
  ).hostname.split(".")[0]
  const authCookieName = `sb-${projectRef}-auth-token`

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options
          })
          updateResponseCookie(name, value, options)
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options
          })
          updateResponseCookie(name, "", options)
        }
      }
    }
  )

  const clearAuthCookies = () => {
    request.cookies
      .getAll()
      .filter(
        ({ name }) =>
          name === authCookieName ||
          name.startsWith(`${authCookieName}.`) ||
          name === `${authCookieName}-code-verifier`
      )
      .forEach(({ name }) => {
        request.cookies.delete(name)
        updateResponseCookie(name, "", {
          path: "/",
          maxAge: 0,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production"
        })
      })
  }

  return { supabase, getResponse: () => response, clearAuthCookies }
}
