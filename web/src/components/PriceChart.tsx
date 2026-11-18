import { useState } from 'react'
import { formatEur } from '../lib/format'

export interface PricePoint {
  label: string
  value: number
}

/**
 * Petite courbe de prix en SVG (une seule série).
 * Toucher ou survoler un point affiche sa valeur.
 */
export function PriceChart({ points }: { points: PricePoint[] }) {
  const [active, setActive] = useState<number | null>(null)
  if (points.length < 2) return null

  const W = 320
  const H = 150
  const pad = { l: 44, r: 30, t: 16, b: 28 }
  const values = points.map((p) => p.value)
  let min = Math.min(...values)
  let max = Math.max(...values)
  const margin = (max - min) * 0.2 || max * 0.1 || 1
  min = Math.max(0, min - margin)
  max = max + margin

  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1)
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)
  const ticks = [min, (min + max) / 2, max]
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const shown = active ?? points.length - 1

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Évolution du prix moyen">
        {/* Lignes de repère discrètes */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--color-muted)">
              {formatEur(t, true)}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
            {p.label}
          </text>
        ))}

        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1={pad.t} y2={H - pad.b} stroke="var(--color-muted)" strokeDasharray="3 3" />
        )}
        <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={p.label}
            cx={x(i)}
            cy={y(p.value)}
            r={i === shown ? 5 : 4}
            fill="var(--color-primary)"
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
        ))}
        {/* Zones de toucher, plus larges que les points */}
        {points.map((p, i) => (
          <rect
            key={p.label}
            x={x(i) - 24}
            y={0}
            width={48}
            height={H}
            fill="transparent"
            onPointerEnter={() => setActive(i)}
            onPointerDown={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
          />
        ))}
      </svg>
      <div
        className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-line bg-surface px-2 py-1 text-xs font-bold shadow"
        style={{ left: `${(x(shown) / W) * 100}%`, top: `${(y(points[shown].value) / H) * 100 - 30}%` }}
      >
        {formatEur(points[shown].value)}
      </div>
    </figure>
  )
}
