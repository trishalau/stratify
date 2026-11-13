import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button as ShadcnButton } from './ui/button'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  to?: string
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', to, className = '', children, ...props }: ButtonProps) {
  const classes = `button button-${variant} button-${size} ${className}`
  if (to) return <Link className={classes} to={to}>{children}</Link>
  const shadcnVariant = variant === 'primary' ? 'default' : variant === 'secondary' ? 'outline' : variant === 'danger' ? 'destructive' : 'ghost'
  return <ShadcnButton variant={shadcnVariant} size={size === 'sm' ? 'sm' : 'default'} className={classes} {...props}>{children}</ShadcnButton>
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-header">
    <div>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {description && <p className="page-description">{description}</p>}
    </div>
    {action && <div className="page-header-action">{action}</div>}
  </div>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function DemoNotice({ children = 'Demonstration data only. Values are illustrative and are not predictions or financial advice.' }: { children?: ReactNode }) {
  return <div className="demo-notice"><span className="demo-dot" />{children}</div>
}

export function Field({ label, value, onChange, type = 'text', prefix, suffix, help }: {
  label: string
  value: string | number
  onChange?: (value: string) => void
  type?: string
  prefix?: string
  suffix?: string
  help?: string
}) {
  return <label className="field">
    <span className="field-label">{label}</span>
    <span className="input-wrap">
      {prefix && <span className="input-affix">{prefix}</span>}
      <input type={type} value={value} onChange={(event) => onChange?.(event.target.value)} />
      {suffix && <span className="input-affix">{suffix}</span>}
    </span>
    {help && <span className="field-help">{help}</span>}
  </label>
}
