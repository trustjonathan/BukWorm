import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { GiphyFetch } from "@giphy/js-fetch-api"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    await getServerProfile()
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401 }
      )
    }

    if (error instanceof Error && error.message === "Profile not found") {
      return NextResponse.json(
        { error: "A user profile is required." },
        { status: 403 }
      )
    }

    console.error("Could not verify GIPHY search access:", error)
    return NextResponse.json(
      { error: "Could not verify access to GIPHY search." },
      { status: 500 }
    )
  }

  const apiKey = process.env.GIPHY_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GIPHY search is not configured. Set GIPHY_API_KEY on the server."
      },
      { status: 503 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")?.trim() || ""
  const type = searchParams.get("type")
  const offsetValue = Number(searchParams.get("offset") || 0)

  if (query.length > 100) {
    return NextResponse.json(
      { error: "Search terms must be 100 characters or fewer." },
      { status: 400 }
    )
  }

  if (type !== "gifs" && type !== "stickers") {
    return NextResponse.json(
      { error: "Choose either GIFs or stickers." },
      { status: 400 }
    )
  }

  const offset = Number.isFinite(offsetValue)
    ? Math.max(0, Math.min(500, Math.floor(offsetValue)))
    : 0

  try {
    const giphy = new GiphyFetch(apiKey)
    const result = query
      ? await giphy.search(query, {
          limit: 24,
          offset,
          rating: "g",
          type
        })
      : await giphy.trending({
          limit: 24,
          offset,
          rating: "g",
          type
        })

    return NextResponse.json({
      data: result.data
        .filter(gif => {
          const urls = [
            gif.images.fixed_width?.url,
            gif.images.fixed_width_small?.url
          ]
          return urls.every(url =>
            /^https:\/\/media\d*\.giphy\.com\//.test(url || "")
          )
        })
        .map(gif => ({
          id: String(gif.id),
          title: gif.title || type.slice(0, -1),
          url: gif.images.fixed_width.url,
          shareUrl: gif.url,
          previewUrl: gif.images.fixed_width_small.url,
          width: gif.images.fixed_width.width,
          height: gif.images.fixed_width.height,
          type
        }))
    })
  } catch (error) {
    console.error("GIPHY search failed:", error)
    return NextResponse.json(
      { error: "GIPHY could not load results. Please try again." },
      { status: 502 }
    )
  }
}
