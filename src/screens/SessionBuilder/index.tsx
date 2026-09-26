import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/Progress'
import { db } from '@/db/schema'
import type { Segment } from '@/db/types'
import { countTemplateSegments, MAX_SESSION_SEGMENTS } from '@/domain/session'
import { newId } from '@/lib/id'
import { createTemplate, SessionError, updateTemplate } from '@/services/sessions'
import { toast } from '@/stores/ui'
import { ItemRow, type DraftItem } from './ItemRow'
import { TextPicker } from './TextPicker'

export default function SessionBuilder() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { templateId } = useParams()
  const data = useLiveQuery(async () => {
    const [texts, segments, template] = await Promise.all([
      db.texts.toArray(),
      db.segments.toArray(),
      templateId ? db.sessionTemplates.get(templateId) : Promise.resolve(undefined),
    ])
    const byText = new Map<string, Segment[]>()
    for (const segment of segments.filter((s) => !s.archived).sort((a, b) => a.order - b.order)) {
      byText.set(segment.textId, [...(byText.get(segment.textId) ?? []), segment])
    }
    return { texts, byText, template: template ?? null }
  }, [templateId])

  const [name, setName] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current || !data?.template) return
    loaded.current = true
    setName(data.template.name)
    setItems(data.template.items.map((item) => ({ ...item, key: newId() })))
  }, [data])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const count = useMemo(() => (data ? countTemplateSegments(items, data.byText) : 0), [items, data])
  const segmentCounts = useMemo(() => new Map([...(data?.byText ?? [])].map(([id, list]) => [id, list.length])), [data])
  const textsById = useMemo(() => new Map((data?.texts ?? []).map((text) => [text.id, text])), [data])

  if (!data) return null
  if (templateId && !data.template) return <PageHeader backTo="/sessions" title={t('builder.errors.notFound')} />
  if (data.template && data.template.source !== 'user') {
    return <PageHeader backTo="/sessions" title={data.template.name} subtitle={t('builder.errors.notEditable')} />
  }

  const overLimit = count > MAX_SESSION_SEGMENTS
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setItems((current) => {
      const from = current.findIndex((i) => i.key === active.id)
      const to = current.findIndex((i) => i.key === over.id)
      return arrayMove(current, from, to)
    })
  }

  const save = async () => {
    setError(null)
    const payload = items.map(({ textId, segmentIds, repeat }) => ({ textId, repeat, ...(segmentIds ? { segmentIds } : {}) }))
    try {
      if (templateId) await updateTemplate(templateId, name, payload)
      else await createTemplate(name, payload)
      toast({ kind: 'success', title: t('builder.saved') })
      navigate('/sessions', { replace: true })
    } catch (e) {
      if (e instanceof SessionError) setError(t(`builder.errors.${e.code}`))
      else throw e
    }
  }

  return (
    <>
      <PageHeader backTo="/sessions" rubric={templateId ? t('builder.titleEdit') : t('builder.titleNew')} title={name.trim() || t('builder.titleNew')} />
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Card>
          <label className="block">
            <span className="mb-2 block font-medium">{t('builder.fieldName')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={t('builder.namePlaceholder')}
              className="h-12 w-full rounded-xl border border-line-strong bg-paper px-4 placeholder:text-ink-faint focus:outline-2 focus:outline-gold"
            />
          </label>
        </Card>

        <section aria-labelledby="items-heading">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 id="items-heading" className="text-2xl font-semibold">
              {t('builder.items')}
            </h2>
            <span aria-live="polite" className={`tabular text-sm font-semibold ${overLimit ? 'text-bad' : 'text-ink-soft'}`}>
              {t('builder.counter', { count, max: MAX_SESSION_SEGMENTS })}
            </span>
          </div>
          <ProgressBar value={count} max={MAX_SESSION_SEGMENTS} tone={overLimit ? 'gold' : 'leaf'} label={t('builder.counter', { count, max: MAX_SESSION_SEGMENTS })} className="mb-4" />
          {overLimit && (
            <p role="alert" className="mb-3 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
              {t('builder.overLimit', { max: MAX_SESSION_SEGMENTS })}
            </p>
          )}

          {items.length === 0 ? (
            <EmptyState
              title={t('builder.noItems')}
              action={
                <Button onClick={() => setPicking(true)} icon="plus">
                  {t('builder.addText')}
                </Button>
              }
            />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
                <ol className="space-y-3">
                  {items.map((item, index) => (
                    <ItemRow
                      key={item.key}
                      item={item}
                      index={index}
                      count={items.length}
                      text={textsById.get(item.textId)}
                      segments={data.byText.get(item.textId) ?? []}
                      onChange={(next) => setItems((current) => current.map((i) => (i.key === next.key ? next : i)))}
                      onRemove={() => setItems((current) => current.filter((i) => i.key !== item.key))}
                      onMove={(delta) => setItems((current) => arrayMove(current, index, index + delta))}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
          {items.length > 0 && (
            <Button variant="secondary" className="mt-4" onClick={() => setPicking(true)} icon="plus">
              {t('builder.addText')}
            </Button>
          )}
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 font-medium text-bad">
            {error}
          </p>
        )}
        <div className="sticky bottom-24 z-10 flex justify-end lg:bottom-6">
          <Button type="submit" size="lg" disabled={items.length === 0 || overLimit || !name.trim()} className="shadow-xl">
            {t('builder.save')}
          </Button>
        </div>
      </form>

      <TextPicker
        open={picking}
        texts={data.texts}
        segmentCounts={segmentCounts}
        onClose={() => setPicking(false)}
        onPick={(textId) => {
          setItems((current) => [...current, { key: newId(), textId, repeat: 1 }])
          setPicking(false)
        }}
      />
    </>
  )
}
