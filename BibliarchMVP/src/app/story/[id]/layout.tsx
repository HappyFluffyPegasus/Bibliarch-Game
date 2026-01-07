"use client"

import { useParams } from "next/navigation"
import { TabNavigation } from "@/components/layout/TabNavigation"

export default function StoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const storyId = params.id as string

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      {/* Liquid Glass Top Toolbar */}
      <TabNavigation storyId={storyId} />

      {/* Main content - no padding needed since toolbar floats */}
      <div className="min-h-screen">
        {children}
      </div>
    </div>
  )
}
