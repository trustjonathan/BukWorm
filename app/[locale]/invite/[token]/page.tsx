"use client"

import {
  acceptWorkspaceInvite,
  getWorkspaceRole
} from "@/db/workspace-collaboration"
import { getWorkspaceById } from "@/db/workspaces"
import { ChatbotUIContext } from "@/context/context"
import { supabase } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface WorkspaceInvitePageProps {
  params: {
    locale: string
    token: string
  }
  searchParams?: {
    accept?: string
  }
}

export default function WorkspaceInvitePage({
  params,
  searchParams
}: WorkspaceInvitePageProps) {
  const { setSelectedWorkspace, setWorkspaces, setWorkspaceRoles } =
    useContext(ChatbotUIContext)
  const router = useRouter()
  const [signedIn, setSignedIn] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const autoAcceptStarted = useRef<string | null>(null)
  const invitePath = `/${params.locale}/invite/${encodeURIComponent(params.token)}`

  useEffect(() => {
    let active = true
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (error) throw error
        if (active) setSignedIn(!!data.user)
      })
      .catch(error => {
        if (!active) return
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not check your sign-in status."
        )
      })
      .finally(() => {
        if (active) setCheckingSession(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleAccept = useCallback(async () => {
    setAccepting(true)
    try {
      const workspaceId = await acceptWorkspaceInvite(params.token)
      const workspace = await getWorkspaceById(workspaceId)
      const role = await getWorkspaceRole(workspaceId)
      if (!role) {
        throw new Error(
          "Invitation accepted, but workspace access was not found."
        )
      }
      setWorkspaces(current => [
        workspace,
        ...current.filter(item => item.id !== workspace.id)
      ])
      setWorkspaceRoles(current => ({ ...current, [workspace.id]: role }))
      setSelectedWorkspace(workspace)
      toast.success("You joined the workspace.")
      router.replace(`/${params.locale}/${workspace.id}/chat`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not accept this invitation."
      )
    } finally {
      setAccepting(false)
    }
  }, [
    params.locale,
    params.token,
    router,
    setSelectedWorkspace,
    setWorkspaceRoles,
    setWorkspaces
  ])

  useEffect(() => {
    if (
      !checkingSession &&
      signedIn &&
      searchParams?.accept === "1" &&
      autoAcceptStarted.current !== params.token
    ) {
      autoAcceptStarted.current = params.token
      void handleAccept()
    }
  }, [
    checkingSession,
    handleAccept,
    params.token,
    searchParams?.accept,
    signedIn
  ])

  if (checkingSession) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
        <p className="text-muted-foreground text-sm">Checking invitation…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Workspace invitation</h1>
      <p className="text-muted-foreground text-sm">
        {accepting
          ? "Accepting your invitation and opening the workspace…"
          : "This is a single-use invitation. It expires seven days after it was created."}
      </p>

      {!signedIn ? (
        <Button asChild>
          <Link
            href={`/${params.locale}/login?next=${encodeURIComponent(
              `${invitePath}?accept=1`
            )}`}
          >
            Sign in to accept
          </Link>
        </Button>
      ) : (
        <Button disabled={accepting} onClick={() => void handleAccept()}>
          {accepting ? "Accepting…" : "Accept invitation"}
        </Button>
      )}
    </main>
  )
}
