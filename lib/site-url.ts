type HeaderReader = Pick<Headers, "get">
type SiteUrlEnvironment = {
  NEXT_PUBLIC_SITE_URL?: string
  RENDER_EXTERNAL_URL?: string
  NODE_ENV?: string
}

const parseHttpUrl = (value: string) => {
  const url = new URL(value)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The application URL must use HTTP or HTTPS.")
  }
  return url
}

export const getSiteUrl = (
  requestHeaders: HeaderReader,
  fallbackUrl?: string,
  environment: SiteUrlEnvironment = process.env
) => {
  const configuredUrl =
    environment.NEXT_PUBLIC_SITE_URL || environment.RENDER_EXTERNAL_URL

  if (configuredUrl) {
    return parseHttpUrl(configuredUrl).origin
  }

  if (environment.NODE_ENV === "production") {
    throw new Error(
      "Set NEXT_PUBLIC_SITE_URL or RENDER_EXTERNAL_URL to generate authentication links."
    )
  }

  const forwardedHost = requestHeaders
    .get("x-forwarded-host")
    ?.split(",")[0]
    .trim()
  const host = forwardedHost || requestHeaders.get("host")

  if (host) {
    const forwardedProtocol = requestHeaders
      .get("x-forwarded-proto")
      ?.split(",")[0]
      .trim()
    const protocol = forwardedProtocol || "http"
    return parseHttpUrl(`${protocol}://${host}`).origin
  }

  const origin = requestHeaders.get("origin")
  if (origin) {
    return parseHttpUrl(origin).origin
  }

  if (fallbackUrl) {
    return parseHttpUrl(fallbackUrl).origin
  }

  throw new Error("Could not determine the local application URL.")
}
