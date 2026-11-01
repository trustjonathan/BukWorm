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
import { useContext, useEffect, useState } from "react"
import { toast } from "sonner"

interface WorkspaceInvitePageProps {
  params: {
    locale: string
    token: string
  }
}

export default function WorkspaceInvitePage({
  params
}: WorkspaceInvitePageProps) {
  const { setSelectedWorkspace, setWorkspaces, setWorkspaceRoles } =
    useContext(ChatbotUIContext)
  const router = useRouter()
  const [signedIn, setSignedIn] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [acceptedWorkspaceId, setAcceptedWorkspaceId] = useState("")
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

  const handleAccept = async () => {
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
      setAcceptedWorkspaceId(workspace.id)
      setAccepted(true)
      toast.success("You joined the workspace.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not accept this invitation."
      )
    } finally {
      setAccepting(false)
    }
  }

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
        {accepted
          ? "You now have access to this shared workspace."
          : "This is a single-use invitation. It expires seven days after it was created."}
      </p>

      {!signedIn ? (
        <Button asChild>
          <Link
            href={`/${params.locale}/login?next=${encodeURIComponent(invitePath)}`}
          >
            Sign in to accept
          </Link>
        </Button>
      ) : accepted ? (
        <Button
          onClick={() =>
            router.push(`/${params.locale}/${acceptedWorkspaceId}/chat`)
          }
        >
          Open workspace
        </Button>
      ) : (
        <Button disabled={accepting} onClick={() => void handleAccept()}>
          {accepting ? "Accepting…" : "Accept invitation"}
        </Button>
      )}
    </main>
  )
}
