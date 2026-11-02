const EMOJI_ASSET_BASE =
  "https://cdn.jsdelivr.net/gh/realityripple/emoji@trunk/twemoji"

export const emojiToCodepoint = (emoji: string) =>
  Array.from(emoji)
    .map(character => character.codePointAt(0)!.toString(16))
    .join("-")

export const emojiAssetUrl = (emoji: string) =>
  `${EMOJI_ASSET_BASE}/${emojiToCodepoint(emoji)}.png`
