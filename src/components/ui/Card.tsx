import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Gilded inner double rule of a painted panel — for the one hero card per screen. */
  framed?: boolean
}

export function Card({ framed, className, ...rest }: CardProps) {
  return <div className={cn('card card-pad', framed && 'card-framed', className)} {...rest} />
}
