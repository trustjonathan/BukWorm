import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { DEFAULT_GOOGLE_MODEL_ID } from "@/lib/models/llm/google-llm-list"
import { GoogleGenerativeAI } from "@google/generative-ai"

export const runtime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { input } = json as {
    input: string
  }

  try {
    const profile = await getServerProfile()

    checkApiKey(profile.google_gemini_api_key, "Google")

    const genAI = new GoogleGenerativeAI(profile.google_gemini_api_key || "")
    const model = genAI.getGenerativeModel({
      model: DEFAULT_GOOGLE_MODEL_ID,
      systemInstruction:
        "When responding with mathematical equations, fractions, or chemical formulas, always use standard LaTeX. Use inline math with $...$ for short expressions and block math with $$...$$ for standalone equations or multi-step calculations."
    })

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: input }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 512
      }
    })

    const content = response.response.text()

    return new Response(JSON.stringify({ content }), {
      status: 200
    })
  } catch (error: any) {
    const errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
