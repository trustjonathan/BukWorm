import { FC } from "react"

interface FinishStepProps {
  displayName: string
}

export const FinishStep: FC<FinishStepProps> = ({ displayName }) => {
  return (
    <div className="space-y-4">
      <div>
        Welcome to BukWorm
        {displayName.length > 0 ? `, ${displayName.split(" ")[0]}` : null}!
      </div>

      <div>
        Click next to start chatting with Gemini. You can configure your own
        Gemini Flash-Lite is ready to help with quick, thoughtful responses.
      </div>
    </div>
  )
}
