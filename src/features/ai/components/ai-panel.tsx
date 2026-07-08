"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { scoreContact, summarizeContact, draftFollowUp, type LeadScore } from "../actions"
import { ComposeEmailDialog } from "@/features/email/components/compose-email-dialog"
import { ComposeSmsDialog } from "@/features/sms/components/compose-sms-dialog"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatSmartDate } from "@/lib/utils/dates"
import { Sparkles, Loader2, RefreshCw, Mail, MessageSquare, AlignLeft } from "lucide-react"

const TIER_STYLES: Record<LeadScore["tier"], string> = {
  hot: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  warm: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  cold: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
}

interface AIPanelProps {
  contactId: string
  contactName: string
  contactEmail: string | null
  contactPhone: string | null
  initialScore: LeadScore | null
}

export function AIPanel({
  contactId,
  contactName,
  contactEmail,
  contactPhone,
  initialScore,
}: AIPanelProps) {
  const [score, setScore] = useState<LeadScore | null>(initialScore)
  const [summary, setSummary] = useState<string | null>(null)
  const [isScoring, startScoring] = useTransition()
  const [isSummarizing, startSummarizing] = useTransition()
  const [draftingChannel, setDraftingChannel] = useState<"email" | "sms" | null>(null)
  const [isDrafting, startDrafting] = useTransition()

  const [emailDraftOpen, setEmailDraftOpen] = useState(false)
  const [smsDraftOpen, setSmsDraftOpen] = useState(false)
  const [draftSubject, setDraftSubject] = useState("")
  const [draftBody, setDraftBody] = useState("")

  function handleScore() {
    startScoring(async () => {
      const result = await scoreContact(contactId)
      if (result.error) toast.error(result.error)
      else if (result.data) setScore(result.data)
    })
  }

  function handleSummarize() {
    startSummarizing(async () => {
      const result = await summarizeContact(contactId)
      if (result.error) toast.error(result.error)
      else if (result.data) setSummary(result.data)
    })
  }

  function handleDraft(channel: "email" | "sms") {
    setDraftingChannel(channel)
    startDrafting(async () => {
      const result = await draftFollowUp(contactId, channel)
      setDraftingChannel(null)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data) {
        setDraftSubject(result.data.subject ?? "")
        setDraftBody(result.data.body)
        if (channel === "email") setEmailDraftOpen(true)
        else setSmsDraftOpen(true)
      }
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="size-4" />
            AI Assistant
          </CardTitle>
          <CardAction>
            <Button
              size="sm"
              variant={score ? "ghost" : "default"}
              onClick={handleScore}
              disabled={isScoring}
            >
              {isScoring ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : score ? (
                <RefreshCw className="size-3.5" />
              ) : (
                <>Score lead</>
              )}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {score ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold tabular-nums">{score.score}</span>
                <Badge variant="outline" className={TIER_STYLES[score.tier]}>
                  {score.tier}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatSmartDate(score.scored_at)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{score.reasoning}</p>
              <ul className="text-xs text-muted-foreground/80 flex flex-col gap-0.5">
                {score.factors.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No lead score yet. Score this contact to see conversion likelihood.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleSummarize} disabled={isSummarizing}>
              {isSummarizing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <AlignLeft className="size-3.5" />
              )}
              Summarize
            </Button>
            {contactEmail && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDraft("email")}
                disabled={isDrafting}
              >
                {isDrafting && draftingChannel === "email" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Mail className="size-3.5" />
                )}
                Draft email
              </Button>
            )}
            {contactPhone && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDraft("sms")}
                disabled={isDrafting}
              >
                {isDrafting && draftingChannel === "sms" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <MessageSquare className="size-3.5" />
                )}
                Draft SMS
              </Button>
            )}
          </div>

          {summary && (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs whitespace-pre-wrap">{summary}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Draft review: the compose dialogs open prefilled — nothing sends until
          the user clicks Send themselves */}
      {contactEmail && (
        <ComposeEmailDialog
          open={emailDraftOpen}
          onOpenChange={setEmailDraftOpen}
          contactId={contactId}
          contactEmail={contactEmail}
          contactName={contactName}
          initialSubject={draftSubject}
          initialBody={draftBody}
        />
      )}
      {contactPhone && (
        <ComposeSmsDialog
          open={smsDraftOpen}
          onOpenChange={setSmsDraftOpen}
          contactId={contactId}
          contactPhone={contactPhone}
          contactName={contactName}
          initialBody={draftBody}
        />
      )}
    </>
  )
}
