"use client"

import { useTransition, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { login, signInWithMagicLink } from "@/features/auth/actions"
import { Loader2Icon, MailIcon } from "lucide-react"

export default function LoginPage() {
  const [isPending, startTransition] = useTransition()
  const [isMagicLinkPending, startMagicLinkTransition] = useTransition()
  const [email, setEmail] = useState("")
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") ?? undefined

  function handleLogin(formData: FormData) {
    startTransition(async () => {
      const result = await login(formData, redirectTo)
      if (result?.error) {
        toast.error(result.error)
      }
    })
  }

  function handleMagicLink() {
    if (!email) {
      toast.error("Enter your email first.")
      return
    }
    const formData = new FormData()
    formData.set("email", email)

    startMagicLinkTransition(async () => {
      const result = await signInWithMagicLink(formData)
      if (result?.error) {
        toast.error(result.error)
      }
      if (result?.success) {
        toast.success(result.success)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Your password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2Icon className="animate-spin" />}
            Sign in
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleMagicLink}
          disabled={isMagicLinkPending}
        >
          {isMagicLinkPending ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <MailIcon />
          )}
          Send magic link
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
