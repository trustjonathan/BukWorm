import { isInvalidAuthSessionError } from "@/lib/supabase/auth-errors"

describe("isInvalidAuthSessionError", () => {
  it.each([
    "invalid claim: missing sub claim",
    "Session from session_id claim in JWT does not exist",
    "Invalid Refresh Token: Refresh Token Not Found"
  ])("recognizes invalid session error: %s", message => {
    expect(isInvalidAuthSessionError({ message })).toBe(true)
  })

  it("does not classify unrelated auth errors as invalid sessions", () => {
    expect(
      isInvalidAuthSessionError({ message: "Auth service unavailable" })
    ).toBe(false)
    expect(isInvalidAuthSessionError(null)).toBe(false)
  })
})
