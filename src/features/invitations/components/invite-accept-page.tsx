"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { signup, switchInvitationAccount } from "@/features/auth/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { acceptInvitation } from "@/features/invitations/actions"
import { Loader2Icon, CheckCircle2Icon, XCircleIcon } from "lucide-react"
import Link from "next/link"

export function InviteAcceptPage({ token, currentEmail, invitation }: {
  token: string
  currentEmail?: string
  invitation: { email?: string; org_name?: string; error?: string } | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const [notice, setNotice] = useState("")
  const invitePath = `/invite/${token}`
  const loginPath = `/login?redirect=${encodeURIComponent(invitePath)}`
  const matches = currentEmail?.toLowerCase() === invitation?.email?.toLowerCase()

  function handleSignup(formData: FormData) {
    startTransition(async () => {
      const result = await signup(formData, invitePath)
      if (result?.error) toast.error(result.error)
      if (result?.success) setNotice(result.success)
    })
  }

  function handleSwitch() {
    startTransition(async () => {
      const result = await switchInvitationAccount(token)
      if (result?.error) toast.error(result.error)
    })
  }

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptInvitation(token)

      if (result.requiresAuth) {
        router.push(`/login?redirect=/invite/${token}`)
        return
      }

      if (result.error) {
        setStatus("error")
        setErrorMessage(result.error)
        toast.error(result.error)
        return
      }

      if (result.success) {
        setStatus("success")
        toast.success("Invitation accepted")
        router.push("/dashboard")
      }
    })
  }

  if (status === "success") {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-2">
            <CheckCircle2Icon className="h-10 w-10 text-green-500" />
          </div>
          <CardTitle className="text-center">You're in</CardTitle>
          <CardDescription className="text-center">
            Invitation accepted. Redirecting to your dashboard...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.push("/dashboard")}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (status === "error") {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-2">
            <XCircleIcon className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="text-center">
            Unable to accept invitation
          </CardTitle>
          <CardDescription className="text-center">
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setStatus("idle")
              setErrorMessage("")
            }}
          >
            Try again
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Need help?{" "}
            <Link
              href={loginPath}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in with a different account
            </Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!invitation?.email || invitation.error) {
    return <Card><CardHeader><CardTitle>Invitation unavailable</CardTitle>
      <CardDescription>This invitation is expired, revoked, already accepted, or invalid. Ask the sender for a new invitation.</CardDescription>
    </CardHeader></Card>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {invitation.org_name || "your team"}</CardTitle>
        <CardDescription>Invited as {invitation.email}. Use this email to join the assigned workspaces.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentEmail ? <>
          <p className="text-sm">Signed in as {currentEmail}.</p>
          {matches ? <Button className="w-full" onClick={handleAccept} disabled={isPending}>
            {isPending && <Loader2Icon className="animate-spin" />}Accept invitation
          </Button> : <p className="text-sm text-destructive">This invitation is for a different email. Switch accounts to continue.</p>}
          <Button variant="outline" className="w-full" onClick={handleSwitch} disabled={isPending}>Use a different account</Button>
        </> : <>
          <p className="text-sm">New to FlowCRM? Create your password below. You will join this team without creating a separate organization.</p>
          <form action={handleSignup} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="invite-email">Invited email</Label>
              <Input id="invite-email" name="email" type="email" value={invitation.email} readOnly autoComplete="username" /></div>
            <div className="space-y-2"><Label htmlFor="invite-password">Create password</Label>
              <Input id="invite-password" name="password" type="password" required minLength={6} autoComplete="new-password" /></div>
            <Button className="w-full" type="submit" disabled={isPending}>{isPending && <Loader2Icon className="animate-spin" />}Create account and continue</Button>
          </form>
          {notice && <p role="status" className="text-sm">{notice}</p>}
          <p className="text-sm">Already have an account, or previously used a magic link? <Link className="underline" href={loginPath}>Sign in or reset your password</Link>.</p>
        </>}
      </CardContent>
    </Card>
  )
}
