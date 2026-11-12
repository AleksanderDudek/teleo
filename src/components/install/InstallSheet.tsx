import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { shouldOfferInstall, type InstallMoment } from '@/domain/install/offer'
import { isInstallable, type InstallPlatform } from '@/domain/install/platform'
import { useInstallPlatform } from '@/lib/install'
import { dismissInstallOffer, readSettings } from '@/services/settings'
import { InstallGuide } from './InstallGuide'

function InstallSheet({ open, platform, onClose, onLater }: { open: boolean; platform: InstallPlatform; onClose: () => void; onLater: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      onClose={onLater}
      title={platform.kind === 'in-app' ? t('install.inAppTitle') : t('install.title')}
      actions={
        <Button variant="ghost" onClick={onLater}>
          {t('install.notNow')}
        </Button>
      }
    >
      <InstallGuide platform={platform} onInstalled={onClose} onDeclined={onLater} />
    </Dialog>
  )
}

/** How long a screen shows itself before the offer slides over it. */
const DELAY_MS: Record<InstallMoment, number> = { summary: 1500, today: 600 }

/**
 * Opens the install sheet by itself when `shouldOfferInstall` allows (DECISIONS #140). The count of "Not now"s is
 * read from the database when deciding, not from the store: it changes rarely and must be current.
 */
export function InstallOffer({ moment, enabled = true }: { moment: InstallMoment; enabled?: boolean }) {
  const { platform, mobile } = useInstallPlatform()
  const [open, setOpen] = useState(false)
  const candidate = enabled && mobile && isInstallable(platform)

  useEffect(() => {
    if (!candidate) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void readSettings().then(({ meta }) => {
        if (!cancelled && shouldOfferInstall({ platform, mobile, offer: meta.installOffer, now: Date.now(), moment })) setOpen(true)
      })
    }, DELAY_MS[moment])
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // Once per screen visit: a new platform object for the same device must not restart the wait.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, moment, platform.kind])

  // Installed meanwhile (the browser's own dialog, or from its menu): nothing left to offer.
  const shown = open && isInstallable(platform)
  return (
    <InstallSheet
      open={shown}
      platform={platform}
      onClose={() => setOpen(false)}
      onLater={() => {
        setOpen(false)
        void dismissInstallOffer()
      }}
    />
  )
}

/** The way in that is always there on a phone, until Teleo is installed: a small chip in Today's header. */
export function InstallChip() {
  const { t } = useTranslation()
  const { platform, mobile } = useInstallPlatform()
  const [open, setOpen] = useState(false)
  if (!mobile || !isInstallable(platform)) return null
  return (
    <>
      <Button size="xs" variant="gold" icon="download-simple" onClick={() => setOpen(true)}>
        {t('install.chip')}
      </Button>
      <InstallSheet open={open} platform={platform} onClose={() => setOpen(false)} onLater={() => setOpen(false)} />
    </>
  )
}
