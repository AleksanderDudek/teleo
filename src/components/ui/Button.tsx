import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { Icon, type IconName } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'
import { BUTTON_ICON_SIZE, buttonClasses, type ButtonSize, type ButtonVariant } from './buttonClasses'

type IconSlot = IconName | ReactElement

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  /** Leading icon: an icon name (gilded duotone) or a ready element. */
  icon?: IconSlot
  iconEnd?: IconSlot
  /** Solid gold-leaf fill for the leading icon (the play triangle). */
  iconFill?: boolean
}

function slot(icon: IconSlot | undefined, { variant = 'primary', size = 'md', iconFill }: CommonProps, fill = false): ReactNode {
  if (typeof icon !== 'string') return icon
  // Status-coloured buttons keep a quiet, same-colour fill; the others are gilded.
  const tone = variant === 'gold' || variant === 'danger' ? 'plain' : 'gilded'
  return <Icon name={icon} size={BUTTON_ICON_SIZE[size]} tone={tone} fillOpacity={fill && iconFill ? 1 : undefined} />
}

export function Button({
  variant,
  size,
  block,
  icon,
  iconEnd,
  iconFill,
  className,
  children,
  type = 'button',
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  const props = { variant, size, iconFill }
  return (
    <button type={type} className={buttonClasses({ variant, size, block, className })} {...rest}>
      {slot(icon, props, true)}
      {children}
      {slot(iconEnd, props)}
    </button>
  )
}

export function ButtonLink({
  variant,
  size,
  block,
  icon,
  iconEnd,
  iconFill,
  className,
  children,
  ...rest
}: CommonProps & LinkProps) {
  const props = { variant, size, iconFill }
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      {slot(icon, props, true)}
      {children}
      {slot(iconEnd, props)}
    </Link>
  )
}

/** Round 40px icon-only button; `outlined` = 48px bordered disc (player side controls). */
export function IconButton({
  label,
  icon,
  outlined = false,
  className,
  children,
  type = 'button',
  ...rest
}: { label: string; icon?: IconName; outlined?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sunk hover:text-ink disabled:pointer-events-none disabled:opacity-40',
        outlined ? 'size-12 border border-line bg-surface' : 'size-10',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  )
}
