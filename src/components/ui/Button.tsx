import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/lib/cn'
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonClasses'

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  icon?: ReactNode
  iconEnd?: ReactNode
}

export function Button({
  variant,
  size,
  block,
  icon,
  iconEnd,
  className,
  children,
  type = 'button',
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClasses({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
      {iconEnd}
    </button>
  )
}

export function ButtonLink({
  variant,
  size,
  block,
  icon,
  iconEnd,
  className,
  children,
  ...rest
}: CommonProps & LinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
      {iconEnd}
    </Link>
  )
}

export function IconButton({
  label,
  className,
  children,
  type = 'button',
  ...rest
}: { label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sunk hover:text-ink disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
