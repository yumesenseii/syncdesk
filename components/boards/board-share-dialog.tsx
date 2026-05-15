"use client"

import { useEffect, useState } from "react"
import { Copy, Download, Globe, Link2, Lock, Share2, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Visibility = "private" | "team" | "public"

const VISIBILITIES: { id: Visibility; label: string; description: string; icon: typeof Lock }[] = [
  {
    id: "private",
    label: "Private",
    description: "Only invited members can see this board.",
    icon: Lock,
  },
  {
    id: "team",
    label: "Team",
    description: "Anyone in your workspace can view this board.",
    icon: Users,
  },
  {
    id: "public",
    label: "Public",
    description: "Anyone with the link can view (read-only).",
    icon: Globe,
  },
]

export function BoardShareDialog({
  boardName,
  open,
  onOpenChange,
}: {
  boardName: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [visibility, setVisibility] = useState<Visibility>("team")
  const [link, setLink] = useState("")

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      if (typeof window !== "undefined") setLink(window.location.href)
      setVisibility("team")
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  const copyLink = async () => {
    if (!link) return
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(link)
      }
      toast.success("Board link copied", { description: link })
    } catch {
      toast.error("Could not copy", { description: "Copy the link manually." })
    }
  }

  const exportBoard = (format: "csv" | "json") => {
    toast.success(`Export queued`, {
      description: `${boardName} will be exported as ${format.toUpperCase()}.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-5 text-primary" aria-hidden />
            Share {boardName}
          </DialogTitle>
          <DialogDescription>
            Control who can access this board and grab a shareable link.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor="share-link">Board link</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="share-link"
                  readOnly
                  value={link}
                  className="h-10 pl-9 font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
              <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={copyLink}>
                <Copy className="size-4" aria-hidden />
                Copy
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Visibility</Label>
            <div role="radiogroup" aria-label="Board visibility" className="grid gap-2">
              {VISIBILITIES.map((v) => {
                const Icon = v.icon
                const active = visibility === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setVisibility(v.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/20"
                        : "border-border/60 hover:border-border hover:bg-muted/30"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                        active
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/60 text-muted-foreground"
                      )}
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {v.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {v.description}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-1 size-3.5 shrink-0 rounded-full border-2 transition-colors",
                        active ? "border-primary bg-primary" : "border-border"
                      )}
                      aria-hidden
                    />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Export</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => exportBoard("csv")}
              >
                <Download className="size-4" aria-hidden />
                Export CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => exportBoard("json")}
              >
                <Download className="size-4" aria-hidden />
                Export JSON
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
