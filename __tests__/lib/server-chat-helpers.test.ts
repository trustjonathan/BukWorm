const mockGetUser = jest.fn()
const mockMaybeSingle = jest.fn()
const mockInsert = jest.fn()
const mockCreateSingle = jest.fn()

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ maybeSingle: mockMaybeSingle }))
      })),
      insert: mockInsert
    }))
  }))
}))

jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({ get: jest.fn() }))
}))

import {
  getServerProfile,
  ServerProfileError
} from "@/lib/server/server-chat-helpers"

describe("getServerProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "reader@example.com",
          user_metadata: { full_name: "Reader One" }
        }
      }
    })
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockInsert.mockReturnValue({
      select: jest.fn(() => ({ single: mockCreateSingle }))
    })
    mockCreateSingle.mockResolvedValue({
      data: {
        user_id: "user-1",
        google_gemini_api_key: null
      },
      error: null
    })
  })

  it("creates an owned profile when an authenticated user's profile is missing", async () => {
    const profile = await getServerProfile({ includeEnvironmentKeys: false })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        display_name: "Reader One",
        use_azure_openai: false
      })
    )
    expect(profile.google_gemini_api_key).toBeNull()
  })

  it("rejects requests without a signed-in user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(getServerProfile()).rejects.toMatchObject<
      Partial<ServerProfileError>
    >({
      status: 401,
      message: "Sign in to use Gemini chat."
    })
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
