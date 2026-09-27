import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { Character } from '@/components/brand/Character'
import { Icon } from '@/components/icons/Icon'
import { ArchFrame } from '@/components/ui/ArchFrame'
import { Button, ButtonLink } from '@/components/ui/Button'
import { db } from '@/db/schema'
import { decodeFriendCard } from '@/domain/leaderboard/friends'
import { saveFriend } from '@/services/leaderboard'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/stores/ui'

/**
 * A friend's card opened from a link: shows their points and adds them to the leaderboard on request.
 * Reachable before onboarding, so an invitation to a new user is not lost.
 */
export default function Friend() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const onboarded = useSettingsStore((s) => s.app.onboardingCompleted)
  const [busy, setBusy] = useState(false)
  const card = decodeFriendCard(params.get('c') ?? '')
  const existing = useLiveQuery(async () => (card ? ((await db.friends.get(card.id)) ?? null) : null), [card?.id])
  const next = onboarded ? '/progress' : '/onboarding'

  if (!card) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-xl">{t('friend.invalid')}</p>
        <ButtonLink to="/">{t('errors.home')}</ButtonLink>
      </main>
    )
  }

  const number = new Intl.NumberFormat(i18n.language)
  const stats = [
    { value: number.format(card.day.p), label: t('friend.today') },
    { value: number.format(card.week.p), label: t('friend.week') },
    { value: number.format(card.month.p), label: t('friend.month') },
    { value: number.format(card.streak), label: t('friend.streak') },
  ]

  const add = async () => {
    setBusy(true)
    const result = await saveFriend(card)
    setBusy(false)
    const title =
      result === 'self' ? t('friend.self') : result === 'older' ? t('friend.older', { name: card.name }) : t('friend.added', { name: card.name })
    toast({ kind: result === 'added' || result === 'updated' ? 'success' : 'info', title })
    navigate(next, { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-10 text-center">
      <ArchFrame glow className="px-5 pt-6 pb-6">
        <Character id={card.character} pose="orans" size={170} decorative className="mx-auto" />
        <p className="rubric mt-2">{t('friend.rubric')}</p>
        <h1 className="mt-1 text-3xl font-semibold">{t('friend.title', { name: card.name })}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {t('friend.cardFrom', { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(card.at) })}
        </p>
      </ArchFrame>

      <dl className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse rounded-2xl bg-sunk px-4 py-3 text-left">
            <dt className="text-sm text-ink-soft">{stat.label}</dt>
            <dd className="text-2xl font-semibold tabular">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-col gap-3">
        <Button size="lg" icon="user-plus" disabled={busy || existing === undefined} onClick={() => void add()}>
          {existing ? t('friend.update') : t('friend.add')}
        </Button>
        <Button variant="ghost" onClick={() => navigate(onboarded ? '/' : '/onboarding', { replace: true })}>
          {t('friend.notNow')}
        </Button>
      </div>
      <p className="mt-6 flex justify-center gap-2 text-xs text-ink-faint">
        <Icon name="shield-cross" size={14} className="mt-0.5 text-primary" />
        {t('friend.privacy')}
      </p>
    </main>
  )
}
