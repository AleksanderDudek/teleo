import type { ReactNode } from 'react'
import { Sprig } from '@/components/Ornaments'

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong px-6 py-10 text-center">
      <Sprig className="mb-4 h-10 w-16 text-gold" />
      <h2 className="text-xl font-semibold">{title}</h2>
      {body && <p className="mt-2 max-w-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
