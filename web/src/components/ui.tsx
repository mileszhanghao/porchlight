import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-night text-white hover:bg-night-2',
    secondary: 'bg-white text-ink border border-line hover:bg-paper',
    danger: 'bg-white text-alert border border-alert/40 hover:bg-alert-soft',
    ghost: 'text-muted hover:text-ink hover:bg-white',
  }[variant]
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-white p-5 shadow-sm ${className}`}>{children}</section>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-serif text-xl font-semibold">{children}</h2>
      {action}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'lamp' | 'alert' | 'moss' }) {
  const styles = {
    neutral: 'bg-paper text-muted border-line',
    lamp: 'bg-lamp-soft text-[#8a5a00] border-lamp/40',
    alert: 'bg-alert-soft text-alert border-alert/30',
    moss: 'bg-[#e7f0ea] text-moss border-moss/30',
  }[tone]
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>{children}</span>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-night focus:ring-2 focus:ring-lamp/40'

/** Native <dialog>: focus trapping, Esc to close and the backdrop come from the browser. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close?.()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line p-0 shadow-xl backdrop:bg-night/40"
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="font-serif text-xl font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="rounded px-2 text-xl leading-none text-muted hover:text-ink">
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert">
      {error instanceof Error ? error.message : 'Something went wrong'}
    </p>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-muted">Loading…</p>
}
