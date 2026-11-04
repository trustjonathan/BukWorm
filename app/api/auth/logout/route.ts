import { cookies } from "next/headers"

const POST_LOGOUT_LANDING_COOKIE = "matrix_show_landing_after_login"

export async function POST() {
  const cookieStore = cookies()
  cookieStore.set(POST_LOGOUT_LANDING_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  })

  return Response.json({ success: true })
}
