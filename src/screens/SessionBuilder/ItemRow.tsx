import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { IconButton } from '@/components/ui/Button'
import { Stepper } from '@/components/ui/Stepper'
import type { Segment, TextItem } from '@/db/types'
import { MAX_SESSION_SEGMENTS } from '@/domain/session'
import { cn } from '@/lib/cn'

export interface DraftItem {
  key: string
  textId: string
  segmentIds?: string[]
  repeat: number
}

interface ItemRowProps {
  item: DraftItem
  index: number
  count: number
  text?: TextItem
  segments: readonly Segment[]
  onChange: (item: DraftItem) => void
  onRemove: () => void
  onMove: (delta: -1 | 1) => void
}

export function ItemRow({ item, index, count, text, segments, onChange, onRemove, onMove }: ItemRowProps) {
  const { t } = useTranslation()
  const [choosing, setChoosing] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key })
  const selected = new Set(item.segmentIds ?? segments.map((s) => s.id))
  const toggle = (id: string) => {
    const next = segments.filter((s) => (s.id === id ? !selected.has(id) : selected.has(s.id))).map((s) => s.id)
    if (next.length === 0) return
    onChange({ ...item, segmentIds: next.length === segments.length ? undefined : next })
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('card p-3', isDragging && 'relative z-10 shadow-2xl ring-2 ring-gold/50')}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-ink-faint hover:bg-sunk hover:text-ink active:cursor-grabbing"
          aria-label={t('builder.dragHandle')}
          {...attributes}
          {...listeners}
        >
          <Icon name="dots-six-vertical" size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg font-semibold">{text?.title ?? t('sessions.missingText')}</p>
          <p className="text-xs font-medium text-ink-soft">
            {item.segmentIds
              ? t('sessions.someSegments', { count: item.segmentIds.length, total: segments.length })
              : t('builder.allSegments')}
          </p>
        </div>
        <Stepper
          label={t('builder.repeat')}
          value={item.repeat}
          min={1}
          max={MAX_SESSION_SEGMENTS}
          onChange={(repeat) => onChange({ ...item, repeat })}
          format={(value) => t('builder.repeatValue', { count: value })}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1 pl-11">
        <IconButton label={t('common.moveUp')} disabled={index === 0} onClick={() => onMove(-1)} className="size-8">
          <Icon name="caret-up" size={16} />
        </IconButton>
        <IconButton label={t('common.moveDown')} disabled={index === count - 1} onClick={() => onMove(1)} className="size-8">
          <Icon name="caret-down" size={16} />
        </IconButton>
        <button
          type="button"
          aria-expanded={choosing}
          onClick={() => setChoosing((v) => !v)}
          disabled={segments.length < 2}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-sunk hover:text-ink disabled:opacity-40"
        >
          <Icon name="list-checks" size={16} />
          {t('builder.chooseSegments')}
        </button>
        <span className="flex-1" />
        <IconButton label={t('builder.remove')} onClick={onRemove} className="size-8">
          <Icon name="x" size={16} />
        </IconButton>
      </div>
      {choosing && (
        <fieldset className="mt-3 ml-11 space-y-1.5 rounded-xl bg-sunk p-3">
          <legend className="sr-only">{t('builder.segments')}</legend>
          {segments.map((segment, i) => (
            <label key={segment.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-1.5 hover:bg-surface">
              <input
                type="checkbox"
                checked={selected.has(segment.id)}
                onChange={() => toggle(segment.id)}
                className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="font-serif text-ink">
                <span className="tabular mr-1.5 text-xs font-bold text-gold-ink">{i + 1}</span>
                {segment.content}
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </li>
  )
}
