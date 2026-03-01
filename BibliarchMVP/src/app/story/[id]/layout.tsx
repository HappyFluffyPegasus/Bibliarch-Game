import { StoryLayoutClient } from "./layout-client"

export function generateStaticParams() {
  return [{ id: "_" }]
}

export default function StoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StoryLayoutClient>{children}</StoryLayoutClient>
}
