"use client"

import { useEffect, useId, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// Measure actual wrapped lines, including single paragraphs and narrow screens.
export function CollapsibleActivityContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const id = useId()

  useEffect(() => {
    const text = textRef.current
    if (!text) return
    function measure() {
      if (!text) return
      const lineHeight = parseFloat(getComputedStyle(text).lineHeight)
      setOverflows(text.scrollHeight > lineHeight * 5 + 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(text)
    return () => observer.disconnect()
  }, [content])

  return (
    <div>
      <p id={id} ref={textRef} className={cn("text-sm text-foreground/80 whitespace-pre-wrap break-words leading-relaxed", !expanded && "line-clamp-5")}>
        {content}
      </p>
      {overflows && (
        <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((value) => !value)} className="mt-1 text-xs text-primary underline underline-offset-2">
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}
