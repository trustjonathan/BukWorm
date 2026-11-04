const GOOGLE_EMBEDDING_MODEL = "gemini-embedding-001"
const GOOGLE_EMBEDDING_DIMENSIONS = 768
const GOOGLE_EMBEDDING_BATCH_SIZE = 100

type GoogleEmbeddingTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"

interface GoogleEmbeddingResponse {
  embeddings?: Array<{
    values?: number[]
  }>
}

export async function generateGoogleEmbeddings(
  contents: string[],
  apiKey: string,
  taskType: GoogleEmbeddingTask
) {
  const embeddings: number[][] = []

  for (
    let offset = 0;
    offset < contents.length;
    offset += GOOGLE_EMBEDDING_BATCH_SIZE
  ) {
    const batch = contents.slice(offset, offset + GOOGLE_EMBEDDING_BATCH_SIZE)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_EMBEDDING_MODEL}:batchEmbedContents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          requests: batch.map(text => ({
            model: `models/${GOOGLE_EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            taskType,
            outputDimensionality: GOOGLE_EMBEDDING_DIMENSIONS
          }))
        })
      }
    )

    if (!response.ok) {
      const error = new Error(
        response.status === 429
          ? "Gemini embedding quota is temporarily unavailable."
          : "Gemini could not generate file-search embeddings."
      ) as Error & { status: number }
      error.status = response.status === 429 ? 503 : 502
      throw error
    }

    const result = (await response.json()) as GoogleEmbeddingResponse
    const batchEmbeddings = result.embeddings?.map(
      embedding => embedding.values
    )

    if (!batchEmbeddings || batchEmbeddings.length !== batch.length) {
      throw new Error("Gemini returned invalid file-search embeddings.")
    }

    for (const values of batchEmbeddings) {
      if (
        !values ||
        values.length !== GOOGLE_EMBEDDING_DIMENSIONS ||
        values.some(value => !Number.isFinite(value))
      ) {
        throw new Error("Gemini returned invalid file-search embeddings.")
      }

      embeddings.push(values)
    }
  }

  return embeddings
}
