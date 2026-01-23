'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from './button'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        style={{ transition: 'none' }}
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="relative bg-background border border-border rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        style={{ transition: 'none', animation: 'none' }}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground text-lg">{title}</h3>
            <p className="text-muted-foreground text-sm mt-1">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
