"use client"

import { useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signup } from "@/features/auth/actions"
import { Loader2Icon } from "lucide-react"

export default function SignupPage() {
  const [isPending, startTransition] = useTransition()

  function handleSignup(formData: FormData) {
    startTransition(async () => {
      const result = await signup(formData)
      if (result?.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Get started with FlowCRM in seconds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2Icon className="animate-spin" />}
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
