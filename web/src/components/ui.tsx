import type { HTMLAttributes, ReactNode } from 'react'

// Petits composants réutilisables pour garder un style cohérent partout.

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </div>
  )
}

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return (
    <section {...rest} className={`rounded-3xl border border-line bg-surface p-4 ${className}`}>
      {children}
    </section>
  )
}

export function Badge({ children, tone = 'primary' }: { children: ReactNode; tone?: 'primary' | 'accent' }) {
  const cls = tone === 'accent' ? 'bg-accent text-[#3a2a00]' : 'bg-primary-soft text-primary'
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{children}</span>
}

/** Écran « en construction » pour les fonctionnalités des étapes suivantes. */
export function ComingSoon({
  emoji,
  title,
  text,
  features,
  step,
}: {
  emoji: string
  title: string
  text: string
  features: string[]
  step: number
}) {
  return (
    <>
      <ScreenTitle title={title} />
      <Card className="text-center">
        <div className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-primary-soft text-4xl" aria-hidden>
          {emoji}
        </div>
        <Badge tone="accent">Bientôt · étape {step}</Badge>
        <p className="mt-3 text-muted">{text}</p>
      </Card>
      <Card className="mt-4">
        <h2 className="mb-2 font-bold">Ce que tu pourras faire ici</h2>
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
