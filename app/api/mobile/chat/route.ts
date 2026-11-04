import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam
} from "openai/resources/chat/completions.mjs"

export const runtime = "nodejs"

type Provider = "google" | "openai"
type MessageRole = "user" | "assistant"

interface MobileMessage {
  role: MessageRole
  content: string
  attachments?: MobileAttachment[]
}

interface MobileAttachment {
  name: string
  mimeType: string
  base64: string
}

interface MobileChatRequest {
  provider: Provider
  model: string
  temperature?: number
  messages: MobileMessage[]
}

const systemPrompt =
  "You are a helpful AI assistant. Use standard LaTeX for mathematical equations and chemical formulas."

function isMobileChatRequest(value: unknown): value is MobileChatRequest {
  if (!value || typeof value !== "object") return false
  const body = value as Partial<MobileChatRequest>
  return (
    (body.provider === "google" || body.provider === "openai") &&
    typeof body.model === "string" &&
    body.model.length <= 100 &&
    Array.isArray(body.messages) &&
    body.messages.length > 0 &&
    body.messages.length <= 100 &&
    body.messages.every(
      message =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.length <= 100_000 &&
        (message.attachments === undefined ||
          (Array.isArray(message.attachments) &&
            message.attachments.length <= 4 &&
            message.attachments.every(
              attachment =>
                attachment &&
                typeof attachment.name === "string" &&
                attachment.name.length <= 200 &&
                typeof attachment.mimeType === "string" &&
                [
                  "application/pdf",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "image/jpeg",
                  "image/png",
                  "image/webp",
                  "text/plain"
                ].includes(attachment.mimeType) &&
                typeof attachment.base64 === "string" &&
                attachment.base64.length > 0 &&
                attachment.base64.length <= 7_000_000 &&
                /^[A-Za-z0-9+/]*={0,2}$/.test(attachment.base64)
            )))
    ) &&
    (body.temperature === undefined ||
      (typeof body.temperature === "number" &&
        Number.isFinite(body.temperature) &&
        body.temperature >= 0 &&
        body.temperature <= 2))
  )
}

async function attachmentText(attachment: MobileAttachment): Promise<string> {
  const buffer = Buffer.from(attachment.base64, "base64")
  const truncate = (text: string) =>
    text.length > 100_000
      ? `${text.slice(0, 100_000)}\n[Document text truncated.]`
      : text
  if (attachment.mimeType === "text/plain")
    return truncate(buffer.toString("utf8"))
  if (attachment.mimeType === "application/pdf") {
    const pdf = await import("pdf-parse")
    const result = await pdf.default(buffer)
    return truncate(result.text)
  }
  if (
    attachment.mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth")
    const result = await mammoth.extractRawText({ buffer })
    return truncate(result.value)
  }
  throw new Error(`Unsupported document type: ${attachment.mimeType}`)
}

function isImageAttachment(attachment: MobileAttachment) {
  return ["image/jpeg", "image/png", "image/webp"].includes(attachment.mimeType)
}

function errorResponse(message: string, status: number) {
  return Response.json({ message }, { status })
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization")
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!bearer || bearer.length > 4096) {
    return errorResponse("Sign in to use mobile chat.", 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Request body must be valid JSON.", 400)
  }
  if (!isMobileChatRequest(body)) {
    return errorResponse("The mobile chat request is invalid.", 400)
  }
  if (
    (body.provider === "google" && !/^gemini-[\w.-]+$/.test(body.model)) ||
    (body.provider === "openai" && !/^(gpt-|o[134])[\w.-]*$/.test(body.model))
  ) {
    return errorResponse("Choose a supported model for this provider.", 400)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("Supabase is not configured on the server.", 503)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } }
  })
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(bearer)
  if (authError || !user) return errorResponse("Your session has expired.", 401)

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("google_gemini_api_key, openai_api_key, openai_organization_id")
    .eq("user_id", user.id)
    .single()
  if (profileError || !profile) {
    return errorResponse("Your Study Hub profile could not be loaded.", 403)
  }

  const apiKey =
    body.provider === "google"
      ? process.env.GOOGLE_GEMINI_API_KEY || profile.google_gemini_api_key
      : process.env.OPENAI_API_KEY || profile.openai_api_key
  if (!apiKey) {
    return errorResponse(
      `Add a ${body.provider === "google" ? "Google Gemini" : "OpenAI"} API key in your profile settings.`,
      403
    )
  }

  try {
    if (body.provider === "google") {
      const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: body.model,
        systemInstruction: systemPrompt
      })
      const messages = body.messages
      const lastMessage = messages[messages.length - 1]
      if (!lastMessage || lastMessage.role !== "user") {
        return errorResponse("The last chat message must be from you.", 400)
      }
      const history = messages.slice(0, -1).map(message => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [
          { text: message.content },
          ...(message.attachments ?? [])
            .filter(isImageAttachment)
            .map(attachment => ({
              inlineData: {
                mimeType: attachment.mimeType,
                data: attachment.base64
              }
            })),
          ...(message.attachments ?? [])
            .filter(attachment => !isImageAttachment(attachment))
            .map(async attachment => ({
              text: `[Document: ${attachment.name}]\n${await attachmentText(attachment)}`
            }))
        ]
      }))
      const currentParts = [
        { text: lastMessage.content },
        ...(lastMessage.attachments ?? [])
          .filter(isImageAttachment)
          .map(attachment => ({
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.base64
            }
          })),
        ...(await Promise.all(
          (lastMessage.attachments ?? [])
            .filter(attachment => !isImageAttachment(attachment))
            .map(async attachment => ({
              text: `[Document: ${attachment.name}]\n${await attachmentText(attachment)}`
            }))
        ))
      ]
      const resolvedHistory = await Promise.all(
        history.map(async message => ({
          ...message,
          parts: await Promise.all(message.parts)
        }))
      )
      const chat = model.startChat({
        history: resolvedHistory,
        generationConfig: {
          temperature: body.temperature ?? 0.7,
          maxOutputTokens: 4096
        }
      })
      const result = await chat.sendMessageStream(currentParts)
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of result.stream) {
              if (request.signal.aborted) break
              controller.enqueue(encoder.encode(chunk.text()))
            }
            controller.close()
          } catch (error) {
            controller.error(error)
          }
        }
      })
      return new Response(stream, {
        headers: {
          "Cache-Control": "no-cache, no-transform",
          "Content-Type": "text/plain; charset=utf-8"
        }
      })
    }

    const openai = new OpenAI({
      apiKey,
      organization:
        process.env.OPENAI_ORGANIZATION_ID ||
        profile.openai_organization_id ||
        undefined
    })
    const messages: ChatCompletionMessageParam[] = [
      { role: "system" as const, content: systemPrompt },
      ...(await Promise.all(
        body.messages.map(async message => {
          if (message.role === "assistant") {
            return { role: "assistant" as const, content: message.content }
          }
          const documentText = await Promise.all(
            (message.attachments ?? [])
              .filter(attachment => !isImageAttachment(attachment))
              .map(
                async attachment =>
                  `[Document: ${attachment.name}]\n${await attachmentText(attachment)}`
              )
          )
          const content: ChatCompletionContentPart[] = [
            {
              type: "text" as const,
              text: [message.content, ...documentText]
                .filter(Boolean)
                .join("\n\n")
            }
          ]
          for (const attachment of message.attachments ?? []) {
            if (isImageAttachment(attachment)) {
              content.push({
                type: "image_url" as const,
                image_url: {
                  url: `data:${attachment.mimeType};base64,${attachment.base64}`
                }
              })
            }
          }
          return {
            role: "user" as const,
            content
          }
        })
      ))
    ]
    const stream = await openai.chat.completions.create(
      {
        model: body.model,
        messages,
        temperature: body.temperature ?? 0.7,
        stream: true
      },
      { signal: request.signal }
    )
    const encoder = new TextEncoder()
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content
            if (text) controller.enqueue(encoder.encode(text))
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })
    return new Response(readable, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/plain; charset=utf-8"
      }
    })
  } catch (error) {
    console.error("Mobile chat request failed:", error)
    return errorResponse("The AI request failed. Please try again.", 502)
  }
}
