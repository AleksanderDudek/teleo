import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, type IconName } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { chromeIntentUrl, type InAppBrowser, type InstallPlatform, type SafariLayout } from '@/domain/install/platform'
import { promptInstall, startPageUrl } from '@/lib/install'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/ui'

/** Proper names, the same in every language. */
const APP_NAMES: Record<Exclude<InAppBrowser, 'other'>, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  messenger: 'Messenger',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  linkedin: 'LinkedIn',
  line: 'LINE',
  wechat: 'WeChat',
}

interface InstallGuideProps {
  platform: InstallPlatform
  /** The browser's own dialog was accepted. */
  onInstalled?: () => void
  /** The browser's own dialog was turned down. */
  onDeclined?: () => void
}

/**
 * How to put Teleo on the home screen on this device (DECISIONS #140): one button where the browser installs by
 * itself, otherwise the steps drawn as the buttons look, or the way out of an app's built-in browser.
 */
export function InstallGuide({ platform, onInstalled, onDeclined }: InstallGuideProps) {
  switch (platform.kind) {
    case 'native':
      return <NativeInstall onInstalled={onInstalled} onDeclined={onDeclined} />
    case 'ios-safari':
      return <SafariSteps initial={platform.layout} />
    case 'ios-chrome':
      return <ChromeIosSteps />
    case 'ios-other':
      return <OtherIosSteps />
    case 'android-menu':
      return <AndroidMenuSteps />
    case 'in-app':
      return <InAppRescue app={platform.app} os={platform.os} />
    default:
      return null
  }
}

function Benefits() {
  const { t } = useTranslation()
  const items: Array<[IconName, string]> = [
    ['house-simple', t('install.benefitApp')],
    ['broadcast', t('install.benefitOffline')],
    ['shield-check', t('install.benefitSafe')],
  ]
  return (
    <ul className="space-y-2 text-sm text-ink">
      {items.map(([icon, text]) => (
        <li key={icon} className="flex items-start gap-2.5">
          <Icon name={icon} size={20} className="mt-px shrink-0" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}

function NativeInstall({ onInstalled, onDeclined }: Pick<InstallGuideProps, 'onInstalled' | 'onDeclined'>) {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <Benefits />
      <Button
        block
        icon="download-simple"
        onClick={async () => {
          if (await promptInstall()) {
            toast({ kind: 'success', title: t('install.done') })
            onInstalled?.()
          } else onDeclined?.()
        }}
      >
        {t('install.button')}
      </Button>
    </div>
  )
}

// --- Steps, drawn as the browser's own buttons look ---------------------------

function Steps({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <ol aria-label={t('install.stepsLabel')} className="space-y-3">
      {children}
    </ol>
  )
}

/** `mock` sits beside the text (a button), `below` under it (a menu row, too wide to share the line). */
function Step({ n, text, mock, below }: { n: number; text: string; mock?: ReactNode; below?: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="halo size-7 shrink-0 text-xs font-bold">{n}</span>
      <span className="min-w-0 flex-1 text-sm text-ink">
        {text}
        {below && (
          <span aria-hidden className="mt-1.5 block">
            {below}
          </span>
        )}
      </span>
      {mock && (
        <span aria-hidden className="shrink-0">
          {mock}
        </span>
      )}
    </li>
  )
}

/** A browser button to tap, lit gold. */
function KeyMock({ icon, text }: { icon?: IconName; text?: string }) {
  return (
    <span className="inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-xl border border-line-strong bg-surface px-2 text-sm font-semibold text-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_35%,transparent)]">
      {icon && <Icon name={icon} size={20} />}
      {text}
    </span>
  )
}

/** A row of the system's share sheet or menu. */
function RowMock({ text, icon }: { text: string; icon: IconName }) {
  return (
    <span className="inline-flex h-9 max-w-full items-center gap-2 rounded-xl bg-sunk px-3 text-xs font-medium text-ink shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_35%,transparent)]">
      <span className="truncate">{text}</span>
      <Icon name={icon} size={18} className="shrink-0" />
    </span>
  )
}

/** Points to where the browser keeps its buttons: Safari's toolbar below the page, menus above it. */
function Pointer({ to }: { to: 'down' | 'up-right' }) {
  return (
    <div aria-hidden className={cn('flex', to === 'down' ? 'justify-center' : 'justify-end')}>
      <Icon name={to === 'down' ? 'arrow-down' : 'arrow-up-right'} size={28} className="motion-safe:animate-bounce" />
    </div>
  )
}

function SafariSteps({ initial }: { initial: SafariLayout }) {
  const { t } = useTranslation()
  // The version can mislead (an iPad, a changed layout): the other way is one tap away.
  const [layout, setLayout] = useState(initial)
  return (
    <div className="space-y-4">
      <Benefits />
      <Steps>
        {layout === 'menu' ? (
          <>
            <Step n={1} text={t('install.safariMenu')} mock={<KeyMock icon="dots-three" />} />
            <Step n={2} text={t('install.safariShare')} mock={<KeyMock icon="export" />} />
            <Step n={3} text={t('install.chooseAdd')} below={<RowMock text={t('install.addToHome')} icon="plus-square" />} />
            <Step n={4} text={t('install.keepWebApp')} mock={<KeyMock text={t('install.add')} />} />
          </>
        ) : (
          <>
            <Step n={1} text={t('install.safariToolbarShare')} mock={<KeyMock icon="export" />} />
            <Step n={2} text={t('install.chooseAdd')} below={<RowMock text={t('install.addToHome')} icon="plus-square" />} />
            <Step n={3} text={t('install.tapAdd')} mock={<KeyMock text={t('install.add')} />} />
          </>
        )}
      </Steps>
      <button
        type="button"
        onClick={() => setLayout(layout === 'menu' ? 'toolbar' : 'menu')}
        className="relative text-sm font-medium text-primary underline-offset-4 before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] hover:underline"
      >
        {t('install.otherLayout')}
      </button>
      <p className="text-xs text-ink-soft">{t('install.fromOtherApp')}</p>
      <Pointer to="down" />
    </div>
  )
}

function ChromeIosSteps() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <Pointer to="up-right" />
      <Benefits />
      <Steps>
        <Step n={1} text={t('install.chromeShare')} mock={<KeyMock icon="export" />} />
        <Step n={2} text={t('install.chooseAdd')} below={<RowMock text={t('install.addToHome')} icon="plus-square" />} />
        <Step n={3} text={t('install.tapAdd')} mock={<KeyMock text={t('install.add')} />} />
      </Steps>
    </div>
  )
}

function OtherIosSteps() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <Benefits />
      <Steps>
        <Step n={1} text={t('install.otherMenu')} mock={<KeyMock icon="export" />} />
        <Step n={2} text={t('install.chooseAdd')} below={<RowMock text={t('install.addToHome')} icon="plus-square" />} />
        <Step n={3} text={t('install.tapAdd')} mock={<KeyMock text={t('install.add')} />} />
      </Steps>
      <p className="text-sm text-ink-soft">{t('install.otherEasier')}</p>
      <CopyLinkButton browser="Safari" />
    </div>
  )
}

function AndroidMenuSteps() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <Pointer to="up-right" />
      <Benefits />
      <Steps>
        <Step n={1} text={t('install.androidMenu')} mock={<KeyMock icon="dots-three-vertical" />} />
        <Step n={2} text={t('install.androidChoose')} below={<RowMock text={t('install.androidInstallItem')} icon="download-simple" />} />
        <Step n={3} text={t('install.androidConfirm')} mock={<KeyMock text={t('install.androidInstall')} />} />
      </Steps>
    </div>
  )
}

// --- Out of an app's built-in browser ------------------------------------------

function CopyLinkButton({ browser, variant = 'secondary' }: { browser: string; variant?: 'primary' | 'secondary' }) {
  const { t } = useTranslation()
  return (
    <Button
      block
      variant={variant}
      icon="copy"
      onClick={async () => {
        const url = startPageUrl()
        try {
          await navigator.clipboard.writeText(url)
          toast({ kind: 'success', title: t('install.copied', { browser }) })
        } catch {
          toast({ kind: 'info', title: t('install.copyFailed', { url }) })
        }
      }}
    >
      {t('install.copyLink')}
    </Button>
  )
}

function InAppRescue({ app, os }: { app: InAppBrowser; os: 'ios' | 'android' }) {
  const { t } = useTranslation()
  const browser = os === 'ios' ? 'Safari' : 'Chrome'
  return (
    <div className="space-y-4">
      <p className="text-ink-soft">
        {app === 'other' ? t('install.inAppBody', { browser }) : t('install.inAppBodyNamed', { app: APP_NAMES[app], browser })}
      </p>
      {os === 'android' && (
        // A link, not a script: the in-app browser hands `intent://` over to Android, which opens Chrome.
        <a href={chromeIntentUrl(startPageUrl())} className={buttonClasses({ block: true })}>
          <Icon name="arrow-square-out" size={18} tone="plain" />
          {t('install.openInChrome')}
        </a>
      )}
      <CopyLinkButton browser={browser} variant={os === 'ios' ? 'primary' : 'secondary'} />
      <p className="text-sm text-ink-soft">{os === 'ios' ? t('install.inAppIosHint') : t('install.inAppAndroidHint')}</p>
    </div>
  )
}
