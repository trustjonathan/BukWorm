import {
  getServerProfile,
  ServerProfileError
} from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import {
  Content,
  GenerateContentStreamResult,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIRequestInputError,
  GoogleGenerativeAI
} from "@google/generative-ai"

export const runtime = "edge"

interface GoogleChatRequest {
  chatSettings: ChatSettings
  messages: Content[]
}

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "RequestError"
  }
}

function isGoogleChatRequest(value: unknown): value is GoogleChatRequest {
  if (!value || typeof value !== "object") return false
  const body = value as Partial<GoogleChatRequest>
  const settings = body.chatSettings
  const messages = body.messages

  return (
    !!settings &&
    typeof settings === "object" &&
    typeof settings.model === "string" &&
    settings.model.length > 0 &&
    Number.isFinite(settings.temperature) &&
    settings.temperature >= 0 &&
    settings.temperature <= 2 &&
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(
      message =>
        message &&
        (message.role === "user" || message.role === "model") &&
        Array.isArray(message.parts) &&
        message.parts.length > 0 &&
        message.parts.every(isGooglePart)
    ) &&
    messages[messages.length - 1].role === "user"
  )
}

function isGooglePart(value: unknown): value is Content["parts"][number] {
  if (!value || typeof value !== "object") return false

  const part = value as { text?: unknown; inlineData?: unknown }
  if (typeof part.text === "string") return true

  if (!part.inlineData || typeof part.inlineData !== "object") return false
  const inlineData = part.inlineData as {
    data?: unknown
    mimeType?: unknown
  }
  return (
    typeof inlineData.data === "string" &&
    typeof inlineData.mimeType === "string"
  )
}

function errorResponse(message: string, status: number) {
  return Response.json({ message }, { status })
}

function safeErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { name: "UnknownError" }
  }

  const details = error as {
    name?: unknown
    code?: unknown
    status?: unknown
  }
  return {
    name: typeof details.name === "string" ? details.name : "UnknownError",
    ...(typeof details.code === "string" ? { code: details.code } : {}),
    ...(typeof details.status === "number" ? { status: details.status } : {})
  }
}

function getProviderError(error: unknown): RequestError | null {
  if (!(error instanceof Error)) return null

  if (error instanceof GoogleGenerativeAIRequestInputError) {
    return new RequestError("Gemini could not accept this request.", 400)
  }

  if (/api key not valid|api key.*invalid/i.test(error.message)) {
    return new RequestError(
      "Gemini rejected the configured API key. Check your profile settings.",
      403
    )
  }

  const status =
    "status" in error && typeof error.status === "number" ? error.status : 0
  if (status === 401 || status === 403) {
    return new RequestError(
      "Gemini rejected the configured API key. Check your profile settings.",
      403
    )
  }
  if (status === 400 || status === 404) {
    return new RequestError("Gemini could not accept this request.", 400)
  }
  if (status === 429) {
    return new RequestError(
      "Gemini is busy right now. Please try again shortly.",
      503
    )
  }
  if (status >= 500) {
    return new RequestError(
      "Gemini is temporarily unavailable. Please try again.",
      502
    )
  }
  if (error instanceof GoogleGenerativeAIFetchError) {
    return new RequestError(
      "Gemini is temporarily unavailable. Please try again.",
      502
    )
  }

  return null
}

export async function POST(request: Request) {
  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return errorResponse("Request body must be valid JSON.", 400)
  }

  if (!isGoogleChatRequest(requestBody)) {
    return errorResponse("The Gemini chat request is invalid.", 400)
  }

  let profile: Awaited<ReturnType<typeof getServerProfile>>
  try {
    profile = await getServerProfile({ includeEnvironmentKeys: false })
  } catch (error) {
    if (error instanceof ServerProfileError) {
      return errorResponse(error.message, error.status)
    }

    console.error("[api/chat/google] Profile lookup failed", {
      stage: "profile_lookup",
      ...safeErrorDetails(error)
    })
    return errorResponse(
      "Your profile could not be loaded. Please try again.",
      500
    )
  }

  const apiKey =
    (profile.google_gemini_api_key || "").trim() ||
    process.env.GOOGLE_GEMINI_API_KEY?.trim()

  if (!apiKey) {
    return errorResponse("AI is not configured.", 503)
  }

  let response: GenerateContentStreamResult
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const googleModel = genAI.getGenerativeModel({
      model: requestBody.chatSettings.model,
      systemInstruction:
        "When responding with mathematical equations, fractions, or chemical formulas, always use standard LaTeX. Use inline math with $...$ for short expressions and block math with $$...$$ for standalone equations or multi-step calculations."
    })

    const messages = [...requestBody.messages]
    const lastMessage = messages.pop()
    if (!lastMessage) {
      return errorResponse("Add a message before sending.", 400)
    }

    const chat = googleModel.startChat({
      history: messages,
      generationConfig: {
        temperature: requestBody.chatSettings.temperature,
        maxOutputTokens: 2048
      }
    })

    response = await chat.sendMessageStream(lastMessage.parts)
  } catch (error) {
    const providerError = getProviderError(error)
    if (providerError) {
      if (providerError.status >= 500) {
        console.error("[api/chat/google] Gemini service error", {
          stage: "gemini_request",
          ...safeErrorDetails(error)
        })
      }
      return errorResponse(providerError.message, providerError.status)
    }

    console.error("[api/chat/google] Unexpected Gemini request failure", {
      stage: "gemini_request",
      ...safeErrorDetails(error)
    })
    return errorResponse(
      "Gemini is temporarily unavailable. Please try again.",
      500
    )
  }

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response.stream) {
          controller.enqueue(encoder.encode(chunk.text()))
        }
        controller.close()
      } catch (error) {
        console.error("[api/chat/google] Gemini stream failed", {
          stage: "gemini_stream",
          ...safeErrorDetails(error)
        })
        controller.error(new Error("Gemini response stream failed."))
      }
    }
  })

  return new Response(readableStream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/plain; charset=utf-8"
    }
  })
}
