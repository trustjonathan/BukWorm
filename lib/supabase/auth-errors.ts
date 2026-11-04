type AuthErrorWithMessage = {
  message?: string
}

const invalidSessionMessages = [
  "invalid claim: missing sub claim",
  "session from session_id claim in jwt does not exist"
]

export function isInvalidAuthSessionError(
  error: AuthErrorWithMessage | null | undefined
) {
  const message = error?.message?.toLowerCase()

  return (
    message !== undefined &&
    invalidSessionMessages.some(invalidMessage =>
      message.includes(invalidMessage)
    )
  )
}
