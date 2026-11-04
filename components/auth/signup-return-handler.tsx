"use client"

import { useEffect } from "react"

const SIGNUP_RETURN_KEY = "matrix_signup_return_pending"

export function markSignupPending() {
  try {
    window.sessionStorage.setItem(SIGNUP_RETURN_KEY, "true")
  } catch {
    // The form still works if browser storage is unavailable.
  }
}

export function SignupReturnHandler() {
  useEffect(() => {
    const clearCredentialsOnReturn = () => {
      if (document.visibilityState !== "visible") return

      try {
        if (window.sessionStorage.getItem(SIGNUP_RETURN_KEY) !== "true") return
        window.sessionStorage.removeItem(SIGNUP_RETURN_KEY)
      } catch {
        return
      }

      const form = document.getElementById("auth-form")
      form
        ?.querySelectorAll<HTMLInputElement>(
          'input[name="email"], input[name="password"]'
        )
        .forEach(input => {
          input.value = ""
        })
    }

    window.addEventListener("pageshow", clearCredentialsOnReturn)
    document.addEventListener("visibilitychange", clearCredentialsOnReturn)
    return () => {
      window.removeEventListener("pageshow", clearCredentialsOnReturn)
      document.removeEventListener("visibilitychange", clearCredentialsOnReturn)
    }
  }, [])

  return null
}
