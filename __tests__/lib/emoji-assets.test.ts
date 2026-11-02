import { emojiAssetUrl, emojiToCodepoint } from "@/lib/emoji-assets"

describe("emoji asset paths", () => {
  it("preserves variation selectors in Twemoji codepoints", () => {
    expect(emojiToCodepoint("❤️")).toBe("2764-fe0f")
    expect(emojiAssetUrl("❤️")).toBe(
      "https://cdn.jsdelivr.net/gh/realityripple/emoji@trunk/twemoji/2764-fe0f.png"
    )
  })

  it("encodes joined emoji sequences as separate codepoints", () => {
    expect(emojiToCodepoint("👩‍💻")).toBe("1f469-200d-1f4bb")
  })
})
