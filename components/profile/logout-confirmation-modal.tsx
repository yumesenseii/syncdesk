"use client"

import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function LogoutConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  onConfirm: () => void | Promise<void>
  loading: boolean
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
              <LogOut className="size-5" aria-hidden />
            </span>
            <div className="space-y-0.5">
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Log out of SyncDesk?
              </DialogTitle>
              <DialogDescription className="text-sm">
                Your current session will end and you’ll need to log in again to access your
                workspace.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={loading}
            autoFocus
          >
            {loading ? "Signing out…" : "Log out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
