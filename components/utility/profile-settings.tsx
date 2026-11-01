import { ChatbotUIContext } from "@/context/context"
import {
  PROFILE_CONTEXT_MAX,
  PROFILE_DISPLAY_NAME_MAX,
  PROFILE_USERNAME_MAX,
  PROFILE_USERNAME_MIN
} from "@/db/limits"
import { updateProfile } from "@/db/profile"
import { uploadProfileImage } from "@/db/storage/profile-images"
import { exportLocalStorageAsJSON } from "@/lib/export-old-data"
import { fetchOpenRouterModels } from "@/lib/models/fetch-models"
import { LLM_LIST_MAP } from "@/lib/models/llm/llm-list"
import { DEFAULT_GOOGLE_MODEL_ID } from "@/lib/models/llm/google-llm-list"
import { supabase } from "@/lib/supabase/browser-client"
import { cn } from "@/lib/utils"
import { OpenRouterLLM } from "@/types"
import {
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconFileDownload,
  IconChevronDown,
  IconLoader2,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
  IconUser,
  IconX
} from "@tabler/icons-react"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { FC, useCallback, useContext, useEffect, useRef, useState } from "react"
import useHotkey from "@/lib/hooks/use-hotkey"
import { toast } from "sonner"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "../ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "../ui/dropdown-menu"
import ImagePicker from "../ui/image-picker"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { LimitDisplay } from "../ui/limit-display"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { WithTooltip } from "../ui/with-tooltip"
import { ThemeSwitcher } from "./theme-switcher"
import { WorkspaceSettings } from "../workspace/workspace-settings"
import { SettingsLibrary } from "./settings-library"
import { ChatSettings } from "../chat/chat-settings"
import { ChatSecondaryButtons } from "../chat/chat-secondary-buttons"
import { QuickSettings } from "../chat/quick-settings"
import { ChatHelp } from "../chat/chat-help"

type SettingsSection =
  | "chat"
  | "profile"
  | "workspace"
  | "library"
  | "appearance"
  | "advanced"

const isSettingsSection = (
  section: string | null
): section is SettingsSection =>
  section === "profile" ||
  section === "chat" ||
  section === "workspace" ||
  section === "library" ||
  section === "appearance" ||
  section === "advanced"

type LibraryType =
  | "prompts"
  | "presets"
  | "files"
  | "collections"
  | "assistants"
  | "tools"
  | "models"

const isLibraryType = (tab: string | null): tab is LibraryType =>
  tab === "prompts" ||
  tab === "presets" ||
  tab === "files" ||
  tab === "collections" ||
  tab === "assistants" ||
  tab === "tools" ||
  tab === "models"

interface ProfileSettingsProps {}

export const ProfileSettings: FC<ProfileSettingsProps> = ({}) => {
  const {
    profile,
    setProfile,
    envKeyMap,
    setAvailableHostedModels,
    setAvailableOpenRouterModels,
    availableOpenRouterModels,
    streamingSpeed,
    setStreamingSpeed
  } = useContext(ChatbotUIContext)

  const router = useRouter()
  const { setTheme, theme } = useTheme()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const buttonRef = useRef<HTMLButtonElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("profile")
  const [libraryTab, setLibraryTab] = useState<LibraryType>("prompts")
  const [activeChatControl, setActiveChatControl] = useState<
    "quick" | "chat" | "help" | null
  >(null)

  const [displayName, setDisplayName] = useState(profile?.display_name || "")
  const [username, setUsername] = useState(profile?.username || "")
  const [usernameAvailable, setUsernameAvailable] = useState(true)
  const [loadingUsername, setLoadingUsername] = useState(false)
  const [profileImageSrc, setProfileImageSrc] = useState(
    profile?.image_url || ""
  )
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [profileInstructions, setProfileInstructions] = useState(
    profile?.profile_context || ""
  )

  const [useAzureOpenai, setUseAzureOpenai] = useState(
    profile?.use_azure_openai
  )
  const [openaiAPIKey, setOpenaiAPIKey] = useState(
    profile?.openai_api_key || ""
  )
  const [openaiOrgID, setOpenaiOrgID] = useState(
    profile?.openai_organization_id || ""
  )
  const [azureOpenaiAPIKey, setAzureOpenaiAPIKey] = useState(
    profile?.azure_openai_api_key || ""
  )
  const [azureOpenaiEndpoint, setAzureOpenaiEndpoint] = useState(
    profile?.azure_openai_endpoint || ""
  )
  const [azureOpenai35TurboID, setAzureOpenai35TurboID] = useState(
    profile?.azure_openai_35_turbo_id || ""
  )
  const [azureOpenai45TurboID, setAzureOpenai45TurboID] = useState(
    profile?.azure_openai_45_turbo_id || ""
  )
  const [azureOpenai45VisionID, setAzureOpenai45VisionID] = useState(
    profile?.azure_openai_45_vision_id || ""
  )
  const [azureEmbeddingsID, setAzureEmbeddingsID] = useState(
    profile?.azure_openai_embeddings_id || ""
  )
  const [anthropicAPIKey, setAnthropicAPIKey] = useState(
    profile?.anthropic_api_key || ""
  )
  const [googleGeminiAPIKey, setGoogleGeminiAPIKey] = useState(
    profile?.google_gemini_api_key || ""
  )
  const [mistralAPIKey, setMistralAPIKey] = useState(
    profile?.mistral_api_key || ""
  )
  const [groqAPIKey, setGroqAPIKey] = useState(profile?.groq_api_key || "")
  const [perplexityAPIKey, setPerplexityAPIKey] = useState(
    profile?.perplexity_api_key || ""
  )

  const [openrouterAPIKey, setOpenrouterAPIKey] = useState(
    profile?.openrouter_api_key || ""
  )

  useEffect(() => {
    const savedSection = localStorage.getItem("matrixSettingsSection")
    if (isSettingsSection(savedSection)) setSettingsSection(savedSection)
  }, [])

  useEffect(() => {
    const section = searchParams.get("settings")
    if (isSettingsSection(section)) {
      setSettingsSection(section)
      localStorage.setItem("matrixSettingsSection", section)
      const tab = searchParams.get("tab")
      if (section === "library" && isLibraryType(tab)) {
        setLibraryTab(tab)
      }
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }, [searchParams])

  const updateSettingsQuery = (
    section?: SettingsSection,
    tab?: LibraryType
  ) => {
    const params = new URLSearchParams(searchParams.toString())
    if (section) {
      params.set("settings", section)
      if (section === "library") {
        const currentTab = params.get("tab")
        params.set(
          "tab",
          tab || (isLibraryType(currentTab) ? currentTab : libraryTab)
        )
      } else {
        params.delete("tab")
      }
    } else {
      params.delete("settings")
      params.delete("tab")
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false
    })
  }

  const openSettings = (section: SettingsSection = settingsSection) => {
    setSettingsSection(section)
    localStorage.setItem("matrixSettingsSection", section)
    setIsOpen(true)
    updateSettingsQuery(section)
  }

  const selectSettingsSection = (section: SettingsSection) => {
    setSettingsSection(section)
    localStorage.setItem("matrixSettingsSection", section)
    updateSettingsQuery(section)
  }

  const selectLibraryTab = (tab: LibraryType) => {
    setLibraryTab(tab)
    updateSettingsQuery("library", tab)
  }

  const handleSettingsOpenChange = (open: boolean) => {
    setIsOpen(open)
    updateSettingsQuery(open ? settingsSection : undefined)
  }

  const openChatControl = (control: "quick" | "chat" | "help") => {
    setSettingsSection("chat")
    localStorage.setItem("matrixSettingsSection", "chat")
    setActiveChatControl(control)
    setIsOpen(true)
    updateSettingsQuery("chat")
  }

  useHotkey("p", () => openChatControl("quick"))
  useHotkey("i", () => openChatControl("chat"))
  useHotkey("/", () => openChatControl("help"))

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
    return
  }

  const handleSave = async () => {
    if (!profile) return
    let profileImageUrl = profile.image_url
    let profileImagePath = ""

    if (profileImageFile) {
      const { path, url } = await uploadProfileImage(profile, profileImageFile)
      profileImageUrl = url ?? profileImageUrl
      profileImagePath = path
    }

    const updatedProfile = await updateProfile(profile.id, {
      ...profile,
      display_name: displayName,
      username,
      profile_context: profileInstructions,
      image_url: profileImageUrl,
      image_path: profileImagePath,
      openai_api_key: openaiAPIKey,
      openai_organization_id: openaiOrgID,
      anthropic_api_key: anthropicAPIKey,
      google_gemini_api_key: googleGeminiAPIKey,
      mistral_api_key: mistralAPIKey,
      groq_api_key: groqAPIKey,
      perplexity_api_key: perplexityAPIKey,
      use_azure_openai: useAzureOpenai,
      azure_openai_api_key: azureOpenaiAPIKey,
      azure_openai_endpoint: azureOpenaiEndpoint,
      azure_openai_35_turbo_id: azureOpenai35TurboID,
      azure_openai_45_turbo_id: azureOpenai45TurboID,
      azure_openai_45_vision_id: azureOpenai45VisionID,
      azure_openai_embeddings_id: azureEmbeddingsID,
      openrouter_api_key: openrouterAPIKey
    })

    setProfile(updatedProfile)

    toast.success("Profile updated!")

    const providers = ["google"]

    providers.forEach(async provider => {
      let providerKey: keyof typeof profile

      if (provider === "google") {
        providerKey = "google_gemini_api_key"
      } else if (provider === "azure") {
        providerKey = "azure_openai_api_key"
      } else {
        providerKey = `${provider}_api_key` as keyof typeof profile
      }

      const models = LLM_LIST_MAP[provider].filter(
        model => model.modelId === DEFAULT_GOOGLE_MODEL_ID
      )
      const envKeyActive = envKeyMap[provider]

      if (!envKeyActive) {
        const hasApiKey = !!updatedProfile[providerKey]

        if (provider === "openrouter") {
          if (hasApiKey && availableOpenRouterModels.length === 0) {
            const openrouterModels: OpenRouterLLM[] =
              await fetchOpenRouterModels()
            setAvailableOpenRouterModels(prev => {
              const newModels = openrouterModels.filter(
                model =>
                  !prev.some(prevModel => prevModel.modelId === model.modelId)
              )
              return [...prev, ...newModels]
            })
          } else {
            setAvailableOpenRouterModels([])
          }
        } else {
          if (hasApiKey && Array.isArray(models)) {
            setAvailableHostedModels(prev => {
              const newModels = models.filter(
                model =>
                  !prev.some(prevModel => prevModel.modelId === model.modelId)
              )
              return [...prev, ...newModels]
            })
          } else if (!hasApiKey && Array.isArray(models)) {
            setAvailableHostedModels(prev =>
              prev.filter(model => !models.includes(model))
            )
          }
        }
      }
    })

    setIsOpen(false)
  }

  const debounce = (func: (...args: any[]) => void, wait: number) => {
    let timeout: NodeJS.Timeout | null

    return (...args: any[]) => {
      const later = () => {
        if (timeout) clearTimeout(timeout)
        func(...args)
      }

      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  const checkUsernameAvailability = useCallback(
    debounce(async (username: string) => {
      if (!username) return

      if (username.length < PROFILE_USERNAME_MIN) {
        setUsernameAvailable(false)
        return
      }

      if (username.length > PROFILE_USERNAME_MAX) {
        setUsernameAvailable(false)
        return
      }

      const usernameRegex = /^[a-zA-Z0-9_]+$/
      if (!usernameRegex.test(username)) {
        setUsernameAvailable(false)
        toast.error(
          "Username must be letters, numbers, or underscores only - no other characters or spacing allowed."
        )
        return
      }

      setLoadingUsername(true)

      const response = await fetch(`/api/username/available`, {
        method: "POST",
        body: JSON.stringify({ username })
      })

      const data = await response.json()
      const isAvailable = data.isAvailable

      setUsernameAvailable(isAvailable)

      if (username === profile?.username) {
        setUsernameAvailable(true)
      }

      setLoadingUsername(false)
    }, 500),
    []
  )

  if (!profile) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-2.5 p-2 text-left"
            aria-label={`Open account menu for ${profile.display_name || profile.username || "User"}`}
          >
            <span className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {profile.image_url ? (
                <Image
                  src={profile.image_url}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 rounded-full object-cover"
                />
              ) : (
                <IconUser className="text-muted-foreground" size={18} />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {profile.display_name || profile.username || "User"}
            </span>
            <IconChevronDown size={16} className="shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuItem asChild>
            <button
              type="button"
              className="flex min-h-9 w-full items-center text-left"
              onClick={() => openSettings()}
            >
              <IconSettings className="mr-2" size={16} />
              Settings
            </button>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <button
              type="button"
              className="flex min-h-9 w-full items-center text-left"
              onClick={() => openSettings("library")}
            >
              <IconFileDownload className="mr-2" size={16} />
              Library
            </button>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <button
              type="button"
              className="flex min-h-9 w-full items-center text-left"
              onClick={() => {
                const nextTheme = theme === "dark" ? "light" : "dark"
                localStorage.setItem("theme", nextTheme)
                setTheme(nextTheme)
              }}
            >
              {theme === "dark" ? (
                <IconMoon className="mr-2" size={16} />
              ) : (
                <IconSun className="mr-2" size={16} />
              )}
              Theme
            </button>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <button
              type="button"
              className="flex min-h-9 w-full items-center text-left"
              onClick={handleSignOut}
            >
              <IconLogout className="mr-2" size={16} />
              Logout
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isOpen} onOpenChange={handleSettingsOpenChange}>
        <DialogContent className="h-dvh w-full max-w-none gap-0 overflow-hidden rounded-none p-0 sm:h-[min(800px,calc(100dvh-32px))] sm:max-w-[960px] sm:rounded-lg">
          <div className="flex h-full min-h-0 flex-col sm:flex-row">
            <aside className="border-border flex shrink-0 flex-col border-b p-4 sm:w-56 sm:border-b-0 sm:border-r">
              <DialogHeader className="mb-3 text-left">
                <DialogTitle>Settings</DialogTitle>
              </DialogHeader>
              <nav
                aria-label="Settings sections"
                className="flex gap-1 overflow-x-auto sm:flex-1 sm:flex-col sm:overflow-visible"
              >
                {[
                  ["chat", "Chat"],
                  ["profile", "Profile"],
                  ["workspace", "Workspace"],
                  ["library", "Library"],
                  ["appearance", "Appearance & data"],
                  ["advanced", "Advanced"]
                ].map(([section, label]) => (
                  <Button
                    key={section}
                    type="button"
                    variant={
                      settingsSection === section ? "secondary" : "ghost"
                    }
                    className="shrink-0 justify-start"
                    aria-current={
                      settingsSection === section ? "page" : undefined
                    }
                    onClick={() =>
                      selectSettingsSection(section as SettingsSection)
                    }
                  >
                    {label}
                  </Button>
                ))}
              </nav>
            </aside>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="border-border flex items-center justify-between border-b px-5 py-3">
                <h2 className="text-base font-semibold">
                  {settingsSection === "appearance"
                    ? "Appearance & data"
                    : settingsSection === "chat"
                      ? "Chat controls"
                      : settingsSection.charAt(0).toUpperCase() +
                        settingsSection.slice(1)}
                </h2>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Close settings"
                  >
                    <IconX size={18} />
                  </Button>
                </DialogClose>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {settingsSection === "profile" && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Label>Username</Label>

                        <div className="text-xs">
                          {username !== profile.username ? (
                            usernameAvailable ? (
                              <div className="text-green-500">AVAILABLE</div>
                            ) : (
                              <div className="text-red-500">UNAVAILABLE</div>
                            )
                          ) : null}
                        </div>
                      </div>

                      <div className="relative">
                        <Input
                          className="pr-10"
                          placeholder="Username..."
                          value={username}
                          onChange={e => {
                            setUsername(e.target.value)
                            checkUsernameAvailability(e.target.value)
                          }}
                          minLength={PROFILE_USERNAME_MIN}
                          maxLength={PROFILE_USERNAME_MAX}
                        />

                        {username !== profile.username ? (
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            {loadingUsername ? (
                              <IconLoader2 className="animate-spin" />
                            ) : usernameAvailable ? (
                              <IconCircleCheckFilled className="text-green-500" />
                            ) : (
                              <IconCircleXFilled className="text-red-500" />
                            )}
                          </div>
                        ) : null}
                      </div>

                      <LimitDisplay
                        used={username.length}
                        limit={PROFILE_USERNAME_MAX}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Profile Image</Label>

                      <ImagePicker
                        src={profileImageSrc}
                        image={profileImageFile}
                        height={50}
                        width={50}
                        onSrcChange={setProfileImageSrc}
                        onImageChange={setProfileImageFile}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Chat Display Name</Label>

                      <Input
                        placeholder="Chat display name..."
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        maxLength={PROFILE_DISPLAY_NAME_MAX}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm">
                        What would you like the AI to know about you to provide
                        better responses?
                      </Label>

                      <TextareaAutosize
                        value={profileInstructions}
                        onValueChange={setProfileInstructions}
                        placeholder="Profile context... (optional)"
                        minRows={6}
                        maxRows={10}
                      />

                      <LimitDisplay
                        used={profileInstructions.length}
                        limit={PROFILE_CONTEXT_MAX}
                      />
                    </div>
                  </div>
                )}

                {settingsSection === "chat" && (
                  <div className="space-y-6">
                    <section className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold">Chat behavior</h3>
                        <p className="text-muted-foreground text-sm">
                          Adjust prompts and response settings for the current
                          chat. Your account default model is chosen separately.
                        </p>
                      </div>
                      <ChatSettings
                        hideModelSelect
                        open={activeChatControl === "chat"}
                        onOpenChange={open =>
                          setActiveChatControl(open ? "chat" : null)
                        }
                      />
                    </section>
                    <section className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Preset or assistant
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          Apply a saved preset or assistant to the current chat.
                        </p>
                      </div>
                      <QuickSettings
                        open={activeChatControl === "quick"}
                        onOpenChange={open =>
                          setActiveChatControl(open ? "quick" : null)
                        }
                      />
                    </section>
                    <section className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold">Chat actions</h3>
                        <p className="text-muted-foreground text-sm">
                          View chat details, start a new chat, or open help.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChatSecondaryButtons />
                        <ChatHelp
                          open={activeChatControl === "help"}
                          onOpenChange={open =>
                            setActiveChatControl(open ? "help" : null)
                          }
                        />
                      </div>
                    </section>
                  </div>
                )}

                {settingsSection === "advanced" && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground text-sm">
                      Matrix AI uses advanced intelligence for every
                      conversation. A personal key is optional when this
                      workspace already provides access.
                    </p>

                    <div className="mt-5 space-y-2">
                      <Label className="flex items-center">
                        {useAzureOpenai
                          ? envKeyMap["azure"]
                            ? ""
                            : "Azure OpenAI API Key"
                          : envKeyMap["openai"]
                            ? ""
                            : "OpenAI API Key"}

                        <Button
                          className={cn(
                            "text-caption h-[18px] w-[150px]",
                            (useAzureOpenai && !envKeyMap["azure"]) ||
                              (!useAzureOpenai && !envKeyMap["openai"])
                              ? "ml-3"
                              : "mb-3"
                          )}
                          onClick={() => setUseAzureOpenai(!useAzureOpenai)}
                        >
                          {useAzureOpenai
                            ? "Switch To Standard OpenAI"
                            : "Switch To Azure OpenAI"}
                        </Button>
                      </Label>

                      {useAzureOpenai ? (
                        <>
                          {envKeyMap["azure"] ? (
                            <Label>Azure OpenAI API key set by admin.</Label>
                          ) : (
                            <Input
                              placeholder="Azure OpenAI API Key"
                              type="password"
                              value={azureOpenaiAPIKey}
                              onChange={e =>
                                setAzureOpenaiAPIKey(e.target.value)
                              }
                            />
                          )}
                        </>
                      ) : (
                        <>
                          {envKeyMap["openai"] ? (
                            <Label>OpenAI API key set by admin.</Label>
                          ) : (
                            <Input
                              placeholder="OpenAI API Key"
                              type="password"
                              value={openaiAPIKey}
                              onChange={e => setOpenaiAPIKey(e.target.value)}
                            />
                          )}
                        </>
                      )}
                    </div>

                    <div className="ml-8 space-y-3">
                      {useAzureOpenai ? (
                        <>
                          {
                            <div className="space-y-1">
                              {envKeyMap["azure_openai_endpoint"] ? (
                                <Label className="text-xs">
                                  Azure endpoint set by admin.
                                </Label>
                              ) : (
                                <>
                                  <Label>Azure Endpoint</Label>

                                  <Input
                                    placeholder="https://your-endpoint.openai.azure.com"
                                    value={azureOpenaiEndpoint}
                                    onChange={e =>
                                      setAzureOpenaiEndpoint(e.target.value)
                                    }
                                  />
                                </>
                              )}
                            </div>
                          }

                          {
                            <div className="space-y-1">
                              {envKeyMap["azure_gpt_35_turbo_name"] ? (
                                <Label className="text-xs">
                                  Azure GPT-3.5 Turbo deployment name set by
                                  admin.
                                </Label>
                              ) : (
                                <>
                                  <Label>
                                    Azure GPT-3.5 Turbo Deployment Name
                                  </Label>

                                  <Input
                                    placeholder="Azure GPT-3.5 Turbo Deployment Name"
                                    value={azureOpenai35TurboID}
                                    onChange={e =>
                                      setAzureOpenai35TurboID(e.target.value)
                                    }
                                  />
                                </>
                              )}
                            </div>
                          }

                          {
                            <div className="space-y-1">
                              {envKeyMap["azure_gpt_45_turbo_name"] ? (
                                <Label className="text-xs">
                                  Azure GPT-4.5 Turbo deployment name set by
                                  admin.
                                </Label>
                              ) : (
                                <>
                                  <Label>
                                    Azure GPT-4.5 Turbo Deployment Name
                                  </Label>

                                  <Input
                                    placeholder="Azure GPT-4.5 Turbo Deployment Name"
                                    value={azureOpenai45TurboID}
                                    onChange={e =>
                                      setAzureOpenai45TurboID(e.target.value)
                                    }
                                  />
                                </>
                              )}
                            </div>
                          }

                          {
                            <div className="space-y-1">
                              {envKeyMap["azure_gpt_45_vision_name"] ? (
                                <Label className="text-xs">
                                  Azure GPT-4.5 Vision deployment name set by
                                  admin.
                                </Label>
                              ) : (
                                <>
                                  <Label>
                                    Azure GPT-4.5 Vision Deployment Name
                                  </Label>

                                  <Input
                                    placeholder="Azure GPT-4.5 Vision Deployment Name"
                                    value={azureOpenai45VisionID}
                                    onChange={e =>
                                      setAzureOpenai45VisionID(e.target.value)
                                    }
                                  />
                                </>
                              )}
                            </div>
                          }

                          {
                            <div className="space-y-1">
                              {envKeyMap["azure_embeddings_name"] ? (
                                <Label className="text-xs">
                                  Azure Embeddings deployment name set by admin.
                                </Label>
                              ) : (
                                <>
                                  <Label>
                                    Azure Embeddings Deployment Name
                                  </Label>

                                  <Input
                                    placeholder="Azure Embeddings Deployment Name"
                                    value={azureEmbeddingsID}
                                    onChange={e =>
                                      setAzureEmbeddingsID(e.target.value)
                                    }
                                  />
                                </>
                              )}
                            </div>
                          }
                        </>
                      ) : (
                        <>
                          <div className="space-y-1">
                            {envKeyMap["openai_organization_id"] ? (
                              <Label className="text-xs">
                                OpenAI Organization ID set by admin.
                              </Label>
                            ) : (
                              <>
                                <Label>OpenAI Organization ID</Label>

                                <Input
                                  placeholder="OpenAI Organization ID (optional)"
                                  disabled={
                                    !!process.env
                                      .NEXT_PUBLIC_OPENAI_ORGANIZATION_ID
                                  }
                                  type="password"
                                  value={openaiOrgID}
                                  onChange={e => setOpenaiOrgID(e.target.value)}
                                />
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      {envKeyMap["anthropic"] ? (
                        <Label>Anthropic API key set by admin.</Label>
                      ) : (
                        <>
                          <Label>Anthropic API Key</Label>
                          <Input
                            placeholder="Anthropic API Key"
                            type="password"
                            value={anthropicAPIKey}
                            onChange={e => setAnthropicAPIKey(e.target.value)}
                          />
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      {envKeyMap["google"] ? (
                        <Label>
                          Matrix AI access is configured for this workspace.
                        </Label>
                      ) : (
                        <>
                          <Label>Personal Matrix / Model API Key</Label>
                          <Input
                            placeholder="API Key"
                            type="password"
                            value={googleGeminiAPIKey}
                            onChange={e =>
                              setGoogleGeminiAPIKey(e.target.value)
                            }
                          />
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      {envKeyMap["mistral"] ? (
                        <Label>Mistral API key set by admin.</Label>
                      ) : (
                        <>
                          <Label>Mistral API Key</Label>
                          <Input
                            placeholder="Mistral API Key"
                            type="password"
                            value={mistralAPIKey}
                            onChange={e => setMistralAPIKey(e.target.value)}
                          />
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      {envKeyMap["groq"] ? (
                        <Label>Groq API key set by admin.</Label>
                      ) : (
                        <>
                          <Label>Groq API Key</Label>
                          <Input
                            placeholder="Groq API Key"
                            type="password"
                            value={groqAPIKey}
                            onChange={e => setGroqAPIKey(e.target.value)}
                          />
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      {envKeyMap["perplexity"] ? (
                        <Label>Perplexity API key set by admin.</Label>
                      ) : (
                        <>
                          <Label>Perplexity API Key</Label>
                          <Input
                            placeholder="Perplexity API Key"
                            type="password"
                            value={perplexityAPIKey}
                            onChange={e => setPerplexityAPIKey(e.target.value)}
                          />
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      {envKeyMap["openrouter"] ? (
                        <Label>OpenRouter API key set by admin.</Label>
                      ) : (
                        <>
                          <Label>OpenRouter API Key</Label>
                          <Input
                            placeholder="OpenRouter API Key"
                            type="password"
                            value={openrouterAPIKey}
                            onChange={e => setOpenrouterAPIKey(e.target.value)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}

                {settingsSection === "workspace" && (
                  <WorkspaceSettings
                    embedded
                    onClose={() => handleSettingsOpenChange(false)}
                  />
                )}

                {settingsSection === "library" && (
                  <SettingsLibrary
                    tab={libraryTab}
                    onTabChange={selectLibraryTab}
                  />
                )}

                {settingsSection === "appearance" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Theme</Label>
                        <p className="text-muted-foreground text-sm">
                          Switch between light and dark appearance.
                        </p>
                      </div>
                      <ThemeSwitcher />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Streaming speed</Label>
                        <p className="text-muted-foreground text-sm">
                          Choose how streamed replies are revealed.
                        </p>
                      </div>
                      <select
                        className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
                        value={streamingSpeed}
                        onChange={event => {
                          const value = event.target.value
                          if (
                            value === "instant" ||
                            value === "natural" ||
                            value === "relaxed"
                          ) {
                            setStreamingSpeed(value)
                          }
                        }}
                        aria-label="Streaming speed"
                      >
                        <option value="instant">Instant</option>
                        <option value="natural">Natural · 120 chars/s</option>
                        <option value="relaxed">Relaxed · 70 chars/s</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Export data</Label>
                        <p className="text-muted-foreground text-sm">
                          Download Matrix AI chat data as JSON.
                        </p>
                      </div>
                      <WithTooltip
                        display={
                          <div>Download Matrix AI chat data as JSON.</div>
                        }
                        trigger={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={exportLocalStorageAsJSON}
                          >
                            <IconFileDownload size={18} className="mr-2" />
                            Export
                          </Button>
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              {(settingsSection === "profile" ||
                settingsSection === "advanced") && (
                <div className="border-border flex justify-end gap-2 border-t p-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleSettingsOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button ref={buttonRef} onClick={handleSave}>
                    Save
                  </Button>
                </div>
              )}
            </main>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
