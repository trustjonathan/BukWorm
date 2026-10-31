import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FC } from "react"

interface APIStepProps {
  googleGeminiAPIKey: string
  onGoogleGeminiAPIKeyChange: (value: string) => void
}

export const APIStep: FC<APIStepProps> = ({
  googleGeminiAPIKey,
  onGoogleGeminiAPIKeyChange
}) => (
  <div className="space-y-2">
    <Label htmlFor="gemini-api-key">Optional Matrix AI key</Label>
    <Input
      id="gemini-api-key"
      placeholder="Matrix API Key"
      type="password"
      value={googleGeminiAPIKey}
      onChange={event => onGoogleGeminiAPIKeyChange(event.target.value)}
    />
    <p className="text-muted-foreground text-xs">
      You can skip this if Matrix AI already has access configured.
    </p>
  </div>
)
