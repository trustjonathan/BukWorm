import { FC } from "react"

interface FinishStepProps {
  displayName: string
}

export const FinishStep: FC<FinishStepProps> = ({ displayName }) => {
  return (
    <div className="space-y-4">
      <div>
        Welcome to Matrix AI
        {displayName.length > 0 ? `, ${displayName.split(" ")[0]}` : null}!
      </div>

      <div>
        Click next to start chatting with Matrix AI. Matrix is ready to help
        with quick, thoughtful responses.
      </div>
    </div>
  )
}
