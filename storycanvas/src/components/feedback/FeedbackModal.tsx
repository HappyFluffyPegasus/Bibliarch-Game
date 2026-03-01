'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { feedbackSchema, type FeedbackType } from '@/lib/feedback/types'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

const FEEDBACK_TYPES: { value: FeedbackType; label: string; description: string }[] = [
  { value: 'bug', label: '🐛 Bug Report', description: 'Something isn\'t working' },
  { value: 'feature', label: '💡 Feature Suggestion', description: 'I have an idea' },
  { value: 'general', label: '💬 General Feedback', description: 'Other thoughts' },
]

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate form
    const result = feedbackSchema.safeParse({ type, title, description })
    if (!result.success) {
      setError(result.error.errors[0].message)
      return
    }

    setIsSubmitting(true)

    try {
      // Capture context
      const context = {
        page_url: window.location.href,
        browser_info: navigator.userAgent,
        screen_size: `${window.innerWidth}x${window.innerHeight}`,
      }

      console.log('Submitting feedback:', { type, title, description, ...context })

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          description,
          ...context,
        }),
      })

      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)

      if (!response.ok) {
        // Get response as text first to see what we're getting
        const responseText = await response.text()
        console.error('Response text:', responseText)

        let data
        try {
          data = JSON.parse(responseText)
        } catch (e) {
          console.error('Failed to parse response as JSON:', e)
          throw new Error(`Server error (${response.status}): ${responseText.substring(0, 100)}`)
        }

        console.error('Feedback submission failed:', data)

        // Show detailed error to user
        const errorMsg = data.hint
          ? `${data.error}: ${data.hint}`
          : (data.details || data.error || 'Failed to submit feedback')

        throw new Error(errorMsg)
      }

      // Show success state
      setIsSuccess(true)

      // Reset form after delay
      setTimeout(() => {
        setIsSuccess(false)
        setType('bug')
        setTitle('')
        setDescription('')
        onClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !mounted) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto my-auto relative">
        {isSuccess ? (
          // Success State
          <div className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Thank you!</h2>
            <p className="text-gray-600 dark:text-gray-300">
              Your feedback has been submitted. We'll review it shortly!
            </p>
          </div>
        ) : (
          // Form State
          <>
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Send Feedback</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  What type of feedback?
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as FeedbackType)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {FEEDBACK_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>
                      {ft.label} - {ft.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief description of the issue"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Details
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us more..."
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
                  required
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg hover:from-sky-600 hover:to-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
