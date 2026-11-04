"use client"

import { markSignupPending } from "@/components/auth/signup-return-handler"
import { SubmitButton } from "@/components/ui/submit-button"

interface SignupSubmitButtonProps {
  action: (formData: FormData) => void | Promise<void>
  className?: string
}

export function SignupSubmitButton({
  action,
  className
}: SignupSubmitButtonProps) {
  return (
    <SubmitButton
      formAction={action}
      className={className}
      onClick={markSignupPending}
    >
      Sign Up
    </SubmitButton>
  )
}
