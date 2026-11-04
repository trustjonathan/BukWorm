import { generateLocalEmbedding } from "@/lib/generate-local-embedding"
import { generateGoogleEmbeddings } from "@/lib/generate-google-embeddings"
import {
  checkApiKey,
  createServerSupabaseClient,
  getServerProfile
} from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"

export async function POST(request: Request) {
  try {
    let json: unknown
    try {
      json = await request.json()
    } catch {
      return Response.json(
        { message: "Request body must be valid JSON." },
        { status: 400 }
      )
    }

    if (!json || typeof json !== "object" || Array.isArray(json)) {
      return Response.json(
        { message: "Request body must be a JSON object." },
        { status: 400 }
      )
    }

    const body = json as Record<string, unknown>
    const { userInput, fileIds, embeddingsProvider, sourceCount } = body

    if (typeof userInput !== "string" || !userInput.trim()) {
      return Response.json(
        { message: "A search query is required." },
        { status: 400 }
      )
    }
    if (
      !Array.isArray(fileIds) ||
      fileIds.some(id => typeof id !== "string" || !id.trim())
    ) {
      return Response.json(
        { message: "File IDs must be an array of non-empty strings." },
        { status: 400 }
      )
    }
    if (
      embeddingsProvider !== "google" &&
      embeddingsProvider !== "openai" &&
      embeddingsProvider !== "local"
    ) {
      return Response.json(
        { message: "A valid embeddings provider is required." },
        { status: 400 }
      )
    }
    if (
      typeof sourceCount !== "number" ||
      !Number.isInteger(sourceCount) ||
      sourceCount < 1 ||
      sourceCount > 10
    ) {
      return Response.json(
        { message: "Source count must be between 1 and 10." },
        { status: 400 }
      )
    }

    const uniqueFileIds = [...new Set(fileIds as string[])]
    if (uniqueFileIds.length === 0) {
      return Response.json({ results: [] })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error(
        "Retrieval service is missing Supabase server configuration."
      )
      return Response.json(
        { message: "Retrieval service is not configured." },
        { status: 503 }
      )
    }

    const supabaseAdmin = createClient<Database>(
      supabaseUrl,
      supabaseServiceRoleKey
    )

    const profile = await getServerProfile()

    if (embeddingsProvider === "google" && !profile.google_gemini_api_key) {
      return Response.json(
        { message: "AI is not configured for file search." },
        { status: 503 }
      )
    }

    if (embeddingsProvider === "openai") {
      if (profile.use_azure_openai) {
        checkApiKey(profile.azure_openai_api_key, "Azure OpenAI")
      } else {
        checkApiKey(profile.openai_api_key, "OpenAI")
      }
    }

    let chunks: Array<{
      id: string
      file_id: string
      content: string
      tokens: number
      similarity: number
    }> = []

    if (embeddingsProvider === "google") {
      const supabaseUser = createServerSupabaseClient()
      const { data: accessibleFiles, error: filesError } = await supabaseUser
        .from("files")
        .select("id")
        .in("id", uniqueFileIds)

      if (filesError) throw filesError

      const accessibleFileIds = (accessibleFiles ?? []).map(file => file.id)
      if (accessibleFileIds.length === 0) {
        return Response.json({ results: [] })
      }

      const { data: missingEmbeddings, error: missingEmbeddingsError } =
        await supabaseUser
          .from("file_items")
          .select("*")
          .in("file_id", accessibleFileIds)
          .is("google_embedding", null)

      if (missingEmbeddingsError) throw missingEmbeddingsError

      if (missingEmbeddings?.length) {
        const documentEmbeddings = await generateGoogleEmbeddings(
          missingEmbeddings.map(item => item.content),
          profile.google_gemini_api_key!,
          "RETRIEVAL_DOCUMENT"
        )
        const reindexedItems = missingEmbeddings.map((item, index) => ({
          ...item,
          google_embedding: JSON.stringify(documentEmbeddings[index])
        }))
        const { error: reindexError } = await supabaseAdmin
          .from("file_items")
          .upsert(reindexedItems, { onConflict: "id" })

        if (reindexError) throw reindexError
      }

      const [googleEmbedding] = await generateGoogleEmbeddings(
        [userInput],
        profile.google_gemini_api_key!,
        "RETRIEVAL_QUERY"
      )

      const { data: googleFileItems, error: googleError } =
        await supabaseAdmin.rpc("match_file_items_google", {
          query_embedding: JSON.stringify(googleEmbedding),
          match_count: sourceCount,
          file_ids: accessibleFileIds
        })

      if (googleError) throw googleError
      chunks = googleFileItems ?? []
    } else if (embeddingsProvider === "openai") {
      const openai = profile.use_azure_openai
        ? new OpenAI({
            apiKey: profile.azure_openai_api_key || "",
            baseURL: `${profile.azure_openai_endpoint}/openai/deployments/${profile.azure_openai_embeddings_id}`,
            defaultQuery: { "api-version": "2023-12-01-preview" },
            defaultHeaders: { "api-key": profile.azure_openai_api_key }
          })
        : new OpenAI({
            apiKey: profile.openai_api_key || "",
            organization: profile.openai_organization_id
          })

      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: userInput
      })

      const openaiEmbedding = response.data.map(item => item.embedding)[0]

      const { data: openaiFileItems, error: openaiError } =
        await supabaseAdmin.rpc("match_file_items_openai", {
          query_embedding: openaiEmbedding as any,
          match_count: sourceCount,
          file_ids: uniqueFileIds
        })

      if (openaiError) {
        throw openaiError
      }

      chunks = openaiFileItems ?? []
    } else if (embeddingsProvider === "local") {
      const localEmbedding = await generateLocalEmbedding(userInput)

      const { data: localFileItems, error: localFileItemsError } =
        await supabaseAdmin.rpc("match_file_items_local", {
          query_embedding: localEmbedding as any,
          match_count: sourceCount,
          file_ids: uniqueFileIds
        })

      if (localFileItemsError) {
        throw localFileItemsError
      }

      chunks = localFileItems ?? []
    }

    const mostSimilarChunks = chunks.sort((a, b) => b.similarity - a.similarity)

    return Response.json({ results: mostSimilarChunks })
  } catch (error) {
    console.error("Retrieval request failed:", error)
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number" &&
      error.status >= 400 &&
      error.status < 600
        ? error.status
        : 500
    const message =
      error instanceof Error && status < 500
        ? error.message
        : "Retrieval failed. Please try again."
    return Response.json({ message }, { status })
  }
}
