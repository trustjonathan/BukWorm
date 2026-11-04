import { getSiteUrl } from "@/lib/site-url"

describe("getSiteUrl", () => {
  it("uses the configured public site URL instead of internal request headers", () => {
    expect(
      getSiteUrl(new Headers({ host: "localhost:10000" }), undefined, {
        NEXT_PUBLIC_SITE_URL: "https://bukworm.onrender.com/",
        RENDER_EXTERNAL_URL: "https://internal.onrender.com"
      })
    ).toBe("https://bukworm.onrender.com")
  })

  it("uses Render's public URL when no explicit site URL is configured", () => {
    expect(
      getSiteUrl(new Headers({ host: "localhost:10000" }), undefined, {
        RENDER_EXTERNAL_URL: "https://bukworm.onrender.com"
      })
    ).toBe("https://bukworm.onrender.com")
  })

  it("uses forwarded host and protocol for local development", () => {
    expect(
      getSiteUrl(
        new Headers({
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "http"
        }),
        undefined,
        { NODE_ENV: "development" }
      )
    ).toBe("http://localhost:3000")
  })

  it("requires a configured public URL in production", () => {
    expect(() =>
      getSiteUrl(
        new Headers({ host: "localhost:10000" }),
        undefined,
        { NODE_ENV: "production" }
      )
    ).toThrow("Set NEXT_PUBLIC_SITE_URL or RENDER_EXTERNAL_URL")
  })
})
