"use client"

import { cn } from "@/lib/utils"
import { emojiAssetUrl } from "@/lib/emoji-assets"
import { IconMoodSmile, IconSearch } from "@tabler/icons-react"
import Image from "next/image"
import { FC, ReactNode, useEffect, useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"]

const EMOJI_LIST_URL =
  "https://cdn.jsdelivr.net/gh/realityripple/emoji@trunk/list.json"
const EMOJI_GROUPS = [
  "Smileys & Emotion",
  "People & Body",
  "Animals & Nature",
  "Food & Drink",
  "Travel & Places",
  "Activities",
  "Objects",
  "Symbols",
  "Flags"
]

interface EmojiEntry {
  code: string
  name: string
  group: string
}

interface WorkspaceEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void
  children?: ReactNode
  label?: string
}

let emojiListRequest: Promise<EmojiEntry[]> | undefined

const fetchEmojiList = () => {
  if (!emojiListRequest) {
    emojiListRequest = fetch(EMOJI_LIST_URL)
      .then(async response => {
        if (!response.ok) {
          throw new Error("Could not load the emoji directory.")
        }

        const data = (await response.json()) as Record<
          string,
          {
            name?: string
            group?: string
            target?: string
          }
        >

        return Object.entries(data)
          .filter(
            ([code, entry]) =>
              /^[0-9a-f-]+$/i.test(code) &&
              typeof entry === "object" &&
              typeof entry?.name === "string" &&
              typeof entry.group === "string" &&
              /^[0-9a-f-]+$/i.test(entry.target || code)
          )
          .map(([code, entry]) => ({
            code: entry.target || code,
            name: entry.name!,
            group: entry.group!
          }))
      })
      .catch(error => {
        emojiListRequest = undefined
        throw error
      })
  }

  return emojiListRequest
}

export const EmojiImage: FC<{
  emoji: string
  name?: string
  size?: number
}> = ({ emoji, name, size = 22 }) => {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span aria-hidden="true" className="leading-none">
        {emoji}
      </span>
    )
  }

  return (
    <Image
      src={emojiAssetUrl(emoji)}
      alt={name || emoji}
      width={size}
      height={size}
      unoptimized
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
    />
  )
}

const emojiForCode = (code: string) =>
  String.fromCodePoint(
    ...code.split("-").map(part => Number.parseInt(part, 16))
  )

export const WorkspaceEmojiPicker: FC<WorkspaceEmojiPickerProps> = ({
  onSelectEmoji,
  children,
  label = "Choose emoji"
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [activeGroup, setActiveGroup] = useState(EMOJI_GROUPS[0])
  const [emojiList, setEmojiList] = useState<EmojiEntry[]>([])
  const [emojiError, setEmojiError] = useState("")

  useEffect(() => {
    if (!open || emojiList.length > 0) return

    let active = true
    void fetchEmojiList()
      .then(entries => {
        if (active) setEmojiList(entries)
      })
      .catch(error => {
        if (active) {
          setEmojiError(
            error instanceof Error ? error.message : "Could not load emojis."
          )
        }
      })

    return () => {
      active = false
    }
  }, [open, emojiList.length])

  const filteredEmojis = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return emojiList.filter(entry => {
      const inGroup = normalizedSearch || entry.group === activeGroup
      const matchesSearch =
        !normalizedSearch || entry.name.toLowerCase().includes(normalizedSearch)
      return inGroup && matchesSearch
    })
  }, [activeGroup, emojiList, search])

  const selectEmoji = (emoji: string) => {
    onSelectEmoji(emoji)
    setOpen(false)
  }

  const trigger = children || <IconMoodSmile size={18} aria-hidden="true" />

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          {trigger}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        collisionPadding={12}
        className="w-[min(94vw,380px)] overflow-hidden p-0"
      >
        <div className="flex items-center justify-around border-b p-2">
          {QUICK_REACTIONS.map(emoji => (
            <button
              type="button"
              key={emoji}
              aria-label={`Insert ${emoji}`}
              title={`Insert ${emoji}`}
              className="hover:bg-accent flex size-9 items-center justify-center rounded-full"
              onClick={() => selectEmoji(emoji)}
            >
              <EmojiImage emoji={emoji} size={26} />
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 border-b px-3 py-2">
          <IconSearch size={17} className="text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search emoji"
            aria-label="Search emoji"
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>

        <div className="flex gap-1 overflow-x-auto border-b px-2 py-1.5">
          {EMOJI_GROUPS.map(group => (
            <button
              type="button"
              key={group}
              aria-label={group}
              title={group}
              onClick={() => {
                setSearch("")
                setActiveGroup(group)
              }}
              className={cn(
                "shrink-0 rounded px-2 py-1 text-xs",
                activeGroup === group && !search.trim()
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {group}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="Emoji"
          className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto p-2"
        >
          {filteredEmojis.map(entry => {
            const emoji = emojiForCode(entry.code)
            return (
              <button
                type="button"
                aria-label={entry.name}
                title={entry.name}
                key={`${entry.code}-${entry.name}`}
                className="hover:bg-accent focus-visible:ring-ring flex aspect-square items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
                onClick={() => selectEmoji(emoji)}
              >
                <EmojiImage emoji={emoji} name={entry.name} size={30} />
              </button>
            )
          })}
          {emojiError && (
            <p className="text-destructive col-span-8 px-2 py-6 text-center text-sm">
              {emojiError}
            </p>
          )}
          {!emojiError && emojiList.length === 0 && (
            <p className="text-muted-foreground col-span-8 px-2 py-6 text-center text-sm">
              Loading emoji…
            </p>
          )}
          {!emojiError &&
            emojiList.length > 0 &&
            filteredEmojis.length === 0 && (
              <p className="text-muted-foreground col-span-8 px-2 py-6 text-center text-sm">
                No emoji found.
              </p>
            )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
