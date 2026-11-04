/** @jest-environment node */

import { generateGoogleEmbeddings } from "@/lib/generate-google-embeddings"

describe("generateGoogleEmbeddings", () => {
  const originalFetch = global.fetch
  const vector = Array.from({ length: 768 }, (_, index) => index / 768)

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it("requests retrieval-document vectors from Gemini without exposing the key in the URL", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          embeddings: [{ values: vector }]
        }),
        { status: 200 }
      )
    )
    global.fetch = fetchMock

    await expect(
      generateGoogleEmbeddings(
        ["A searchable document."],
        "server-only-key",
        "RETRIEVAL_DOCUMENT"
      )
    ).resolves.toEqual([vector])

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain("gemini-embedding-001:batchEmbedContents")
    expect(url).not.toContain("server-only-key")
    expect(options.headers["x-goog-api-key"]).toBe("server-only-key")
    expect(JSON.parse(options.body)).toEqual({
      requests: [
        {
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: "A searchable document." }] },
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: 768
        }
      ]
    })
  })

  it("maps Gemini quota errors to a temporary service-unavailable status", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("quota exceeded", { status: 429 }))

    await expect(
      generateGoogleEmbeddings(["query"], "server-only-key", "RETRIEVAL_QUERY")
    ).rejects.toMatchObject({
      message: "Gemini embedding quota is temporarily unavailable.",
      status: 503
    })
  })
})
