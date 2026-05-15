"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { Loader2 } from "lucide-react"
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
import { useBoardsStore } from "@/stores/boards-store"

export const WORKSPACE_ICON_PRESETS = [
  "📂",
  "🚀",
  "🎓",
  "🧠",
  "🎨",
  "🛠️",
  "📚",
  "💡",
  "📈",
  "🌐",
  "🎯",
  "🌱",
] as const

type CreateWorkspaceModalContextValue = {
  open: () => void
}

const CreateWorkspaceModalContext = createContext<CreateWorkspaceModalContextValue | null>(null)

export function useOpenCreateWorkspaceModal(): () => void {
  const ctx = useContext(CreateWorkspaceModalContext)
  if (!ctx) {
    throw new Error("useOpenCreateWorkspaceModal must be used within CreateWorkspaceModalProvider")
  }
  return ctx.open
}

export function CreateWorkspaceModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [formMountKey, setFormMountKey] = useState(0)
  const openModal = useCallback(() => {
    setFormMountKey((k) => k + 1)
    setOpen(true)
  }, [])
  const value = useMemo(() => ({ open: openModal }), [openModal])

  return (
    <CreateWorkspaceModalContext.Provider value={value}>
      {children}
      <CreateWorkspaceModal open={open} onOpenChange={setOpen} formMountKey={formMountKey} />
    </CreateWorkspaceModalContext.Provider>
  )
}

export function CreateWorkspaceModal({
  open,
  onOpenChange,
  formMountKey,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  formMountKey: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        {open ? (
          <CreateWorkspaceModalForm key={formMountKey} onRequestClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function CreateWorkspaceModalForm({ onRequestClose }: { onRequestClose: () => void }) {
  const createWorkspace = useBoardsStore((s) => s.createWorkspace)
  const formId = useId()
  const nameFieldId = `${formId}-name`
  const iconFieldId = `${formId}-icon`

  const nameRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState<string>(WORKSPACE_ICON_PRESETS[0])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    const frame = requestAnimationFrame(() => {
      nameRef.current?.focus()
    })
    return () => {
      mountedRef.current = false
      cancelAnimationFrame(frame)
    }
  }, [])

  const trimmedName = name.trim()
  const canSubmit = trimmedName.length > 0 && !loading

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      const result = await createWorkspace(trimmed, icon.trim() || "📂")
      if (!mountedRef.current) return
      if (result.ok) {
        toast.success("Workspace created.")
        onRequestClose()
      } else {
        toast.error(result.message)
      }
    } catch {
      if (mountedRef.current) {
        toast.error("Could not create workspace. Please try again.")
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>New workspace</DialogTitle>
        <DialogDescription>
          Create a folder to group related boards and tasks. You can rename it later.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 py-1">
        <div className="grid gap-2">
          <Label htmlFor={nameFieldId}>Name</Label>
          <Input
            ref={nameRef}
            id={nameFieldId}
            name="workspaceName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Capstone Project"
            autoComplete="off"
            disabled={loading}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={iconFieldId}>Icon</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={iconFieldId}
              name="workspaceIcon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              className="w-20 text-center"
              disabled={loading}
            />
            <div className="flex flex-1 flex-wrap gap-1.5">
              {WORKSPACE_ICON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={loading}
                  onClick={() => setIcon(preset)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md border border-border/60 text-base transition-colors hover:bg-muted/60",
                    icon === preset && "border-primary bg-primary/10"
                  )}
                  aria-label={`Use ${preset} as workspace icon`}
                  aria-pressed={icon === preset}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onRequestClose()} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit} className="inline-flex items-center gap-2">
          {loading ? (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              Creating…
            </>
          ) : (
            "Create workspace"
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}
