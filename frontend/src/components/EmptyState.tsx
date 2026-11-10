import type { ReactNode } from 'react'

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-dim">{children}</p>
    </div>
  )
}