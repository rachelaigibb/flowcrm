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
import { acceptInvitation } from "@/features/invitations/actions"
import { Loader2Icon, CheckCircle2Icon, XCircleIcon } from "lucide-react"
import Link from "next/link"

export function InviteAcceptPage({ token }: { token: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

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
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in with a different account
            </Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept Invitation</CardTitle>
        <CardDescription>
          You've been invited to join an organization on FlowCRM. Click below to
          accept and get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          className="w-full"
          onClick={handleAccept}
          disabled={isPending}
        >
          {isPending && <Loader2Icon className="animate-spin" />}
          Accept Invitation
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup?redirect=/invite/${token}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign up first
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
