"use client"

import { useTransition, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updatePassword } from "@/features/auth/actions"
import { Loader2Icon } from "lucide-react"

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>
}

function ResetPasswordForm() {
  const redirectTo = useSearchParams().get("redirect") ?? undefined
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    const password = formData.get("password") as string
    const confirm = formData.get("confirm") as string
    if (password !== confirm) {
      toast.error("Passwords do not match.")
      return
    }
    startTransition(async () => {
      const result = await updatePassword(formData, redirectTo)
      if (result?.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>
          Enter a new password for your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              placeholder="Re-enter your password"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2Icon className="animate-spin" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
