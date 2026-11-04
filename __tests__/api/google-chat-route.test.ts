/** @jest-environment node */

import {
  getServerProfile,
  ServerProfileError
} from "@/lib/server/server-chat-helpers"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { POST } from "@/app/api/chat/google/route"

const mockSendMessageStream = jest.fn()
const mockStartChat = jest.fn(() => ({
  sendMessageStream: mockSendMessageStream
}))
const mockGetGenerativeModel = jest.fn(() => ({
  startChat: mockStartChat
}))

jest.mock("@/lib/server/server-chat-helpers", () => ({
  getServerProfile: jest.fn(),
  ServerProfileError: class ServerProfileError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
}))

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAIFetchError: class GoogleGenerativeAIFetchError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
  GoogleGenerativeAIRequestInputError: class GoogleGenerativeAIRequestInputError extends Error {},
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel
  }))
}))

const mockGetServerProfile = jest.mocked(getServerProfile)
const mockGoogleGenerativeAI = jest.mocked(GoogleGenerativeAI)

const requestBody = {
  chatSettings: { model: "gemini-test", temperature: 0.5 },
  messages: [{ role: "user", parts: [{ text: "Hello" }] }]
}

function createRequest(body: unknown = requestBody) {
  return new Request("http://localhost/api/chat/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
}

describe("Google chat route", () => {
  const originalEnvironmentKey = process.env.GOOGLE_GEMINI_API_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GOOGLE_GEMINI_API_KEY = "shared-server-key"
    mockSendMessageStream.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => "Hello back" }
      })()
    })
  })

  afterAll(() => {
    if (originalEnvironmentKey === undefined) {
      delete process.env.GOOGLE_GEMINI_API_KEY
    } else {
      process.env.GOOGLE_GEMINI_API_KEY = originalEnvironmentKey
    }
  })

  it("uses a signed-in user's saved Gemini key before the shared key", async () => {
    mockGetServerProfile.mockResolvedValue({
      google_gemini_api_key: "user-saved-key"
    } as Awaited<ReturnType<typeof getServerProfile>>)

    const response = await POST(createRequest())

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("Hello back")
    expect(mockGoogleGenerativeAI).toHaveBeenCalledWith("user-saved-key")
  })

  it("uses the server key when the signed-in user has no saved key", async () => {
    mockGetServerProfile.mockResolvedValue({
      google_gemini_api_key: null
    } as Awaited<ReturnType<typeof getServerProfile>>)

    const response = await POST(createRequest())

    expect(response.status).toBe(200)
    expect(mockGoogleGenerativeAI).toHaveBeenCalledWith("shared-server-key")
  })

  it("continues after the profile helper creates a missing profile", async () => {
    mockGetServerProfile.mockResolvedValue({
      google_gemini_api_key: null
    } as Awaited<ReturnType<typeof getServerProfile>>)

    const response = await POST(createRequest())

    expect(response.status).toBe(200)
    expect(mockGetServerProfile).toHaveBeenCalledWith({
      includeEnvironmentKeys: false
    })
  })

  it("returns 401 for a signed-out request", async () => {
    mockGetServerProfile.mockRejectedValue(
      new ServerProfileError("Sign in to use Gemini chat.", 401)
    )

    const response = await POST(createRequest())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      message: "Sign in to use Gemini chat."
    })
    expect(mockGoogleGenerativeAI).not.toHaveBeenCalled()
  })

  it("returns 503 when neither a user nor server key is configured", async () => {
    delete process.env.GOOGLE_GEMINI_API_KEY
    mockGetServerProfile.mockResolvedValue({
      google_gemini_api_key: null
    } as Awaited<ReturnType<typeof getServerProfile>>)

    const response = await POST(createRequest())

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ message: "AI is not configured." })
  })

  it("returns 400 for malformed chat input", async () => {
    const response = await POST(createRequest({ messages: [] }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      message: "The Gemini chat request is invalid."
    })
  })
})
