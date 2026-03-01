"use client"

import { useParams } from "next/navigation"
import { SidebarNav } from "@/components/layout/SidebarNav"

export function StoryLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const storyId = params.id as string

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {children}
      <SidebarNav storyId={storyId} />
    </div>
  )
}
