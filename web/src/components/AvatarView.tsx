import { useId } from 'react'
import { type Avatar, mix, shade } from '../lib/avatar'

/**
 * Dessin du dresseur, de face, façon personnage de jeu en 3D :
 * anatomie réaliste (≈ 7 têtes), membres modelés, ombres douces et vêtements détaillés
 * (empiècements, coutures, liserés, cordons, semelles…).
 * crop : « full » = en pied, « bust » = portrait jusqu'aux épaules, « head » = la tête seule.
 */

type Pt = [number, number]
type LP = [number, number, number] // x, y, demi-largeur

const INK = '#22222c'

/** Courbe lisse (Catmull-Rom) passant par tous les points, à partir du premier. */
function smooth(p: Pt[]): string {
  let d = ''
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] ?? p2
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return d
}

/** Contour d'un membre (bras, jambe, manche…) à partir de sa ligne centrale et de ses largeurs. */
function limb(pts: LP[]): string {
  const n = pts.length
  const tan = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const l = Math.hypot(dx, dy) || 1
    return [dx / l, dy / l] as Pt
  })
  const L: Pt[] = pts.map((p, i) => [p[0] - tan[i][1] * p[2], p[1] + tan[i][0] * p[2]])
  const R: Pt[] = pts.map((p, i) => [p[0] + tan[i][1] * p[2], p[1] - tan[i][0] * p[2]])
  const e = n - 1
  const k = 0.75
  const cap = (a: Pt, b: Pt, t: Pt, w: number) =>
    ` C${(a[0] + t[0] * w * k).toFixed(2)} ${(a[1] + t[1] * w * k).toFixed(2)} ${(b[0] + t[0] * w * k).toFixed(2)} ${(b[1] + t[1] * w * k).toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`
  const back = [...R].reverse()
  return (
    `M${L[0][0].toFixed(2)} ${L[0][1].toFixed(2)}` +
    smooth(L) +
    cap(L[e], R[e], tan[e], pts[e][2]) +
    smooth(back) +
    cap(R[0], L[0], [-tan[0][0], -tan[0][1]], pts[0][2]) +
    'Z'
  )
}

/** Points intermédiaires d'une ligne centrale (t de 0 à 1). */
function along(pts: LP[], t: number): LP {
  const segs = pts.length - 1
  const f = Math.min(segs - 1e-6, Math.max(0, t * segs))
  const i = Math.floor(f)
  const u = f - i
  const a = pts[i]
  const b = pts[i + 1]
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]
}
function slice(pts: LP[], t0: number, t1: number, grow = 0, steps = 5): LP[] {
  return Array.from({ length: steps }, (_, i) => {
    const p = along(pts, t0 + ((t1 - t0) * i) / (steps - 1))
    return [p[0], p[1], p[2] + grow] as LP
  })
}
/** Ligne décalée le long d'un membre (couture, bande latérale). */
function offsetLine(pts: LP[], side: number, f: number, t0 = 0, t1 = 1): string {
  const s = slice(pts, t0, t1, 0, 6)
  const out: Pt[] = s.map((p, i) => {
    const a = s[Math.max(0, i - 1)]
    const b = s[Math.min(s.length - 1, i + 1)]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const l = Math.hypot(dx, dy) || 1
    return [p[0] - (dy / l) * p[2] * f * side, p[1] + (dx / l) * p[2] * f * side]
  })
  return `M${out[0][0].toFixed(2)} ${out[0][1].toFixed(2)}` + smooth(out)
}

export function AvatarView({ a, crop = 'full', size, className = '' }: { a: Avatar; crop?: 'full' | 'bust' | 'head'; size?: number; className?: string }) {
  const uid = 'av' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const url = (k: string) => `url(#${uid}${k})`
  const girl = a.gender === 'girl'
  const b = a.build

  // ---- Repères ----
  const H = 330 + a.height * 50
  const headTop = 392 - H
  const hu = H / 7.4
  const hy = headTop + 30 // ligne des yeux
  const chin = hy + 24
  const shoulderY = chin + 13
  const waistY = headTop + 2.95 * hu
  const hipY = headTop + 3.9 * hu
  const kneeY = headTop + 5.6 * hu
  const ankleY = 376
  const hemY = waistY + (hipY - waistY) * 0.6

  const sh = (girl ? 29 : 34) + b * 12
  const wa = (girl ? 15.5 : 20) + b * 13
  const hp = (girl ? 25 : 21) + b * 12

  const skin = a.skin
  const skinDark = shade(skin, -0.22)
  const accent = a.accentColor

  // ---- Bras ----
  const armPts = (s: number): LP[] => [
    [100 + s * (sh - 8), shoulderY + 9, 7 + b * 3],
    [100 + s * (sh - 1), shoulderY + 22, 6.2 + b * 2.8],
    [100 + s * (sh + 2 + b * 2), waistY - 2, 4.6 + b * 2],
    [100 + s * (sh + 3 + b * 2), waistY + (hipY - waistY) * 0.35, 5.2 + b * 2.2],
    [100 + s * (sh + 3 + b * 1.5), hipY + 2, 3.5 + b * 1.3],
  ]
  // ---- Jambes ----
  const legPts = (s: number): LP[] => {
    const th = 11 + b * 5
    const ca = 7.6 + b * 3.4
    return [
      [100 + s * hp * 0.5, hipY - 10, th],
      [100 + s * hp * 0.47, hipY + (kneeY - hipY) * 0.35, th * 0.92],
      [100 + s * hp * 0.43, kneeY, th * 0.6],
      [100 + s * hp * 0.43, kneeY + (ankleY - kneeY) * 0.3, ca],
      [100 + s * hp * 0.41, ankleY - 4, 4 + b * 1.4],
    ]
  }

  // ---- Torse ----
  const torsoSide = (s: number): Pt[] => [
    [100 + s * 8, shoulderY - 6],
    [100 + s * (sh - 6), shoulderY - 1],
    [100 + s * sh, shoulderY + 9],
    [100 + s * (sh - 4), shoulderY + 24],
    [100 + s * ((sh + wa) / 2 + (girl ? 0 : -2)), (shoulderY + waistY) / 2 + 6],
    [100 + s * wa, waistY],
    [100 + s * hp, waistY + (hipY - waistY) * 0.6],
    [100 + s * (hp - 2), hipY + 2],
  ]
  const Lt = torsoSide(-1)
  const Rt = torsoSide(1).reverse()
  const torso = `M${Lt[0][0]} ${Lt[0][1]}` + smooth(Lt) + ` L${Rt[0][0]} ${Rt[0][1]}` + smooth(Rt) + ` Q100 ${shoulderY - 3} ${Lt[0][0]} ${Lt[0][1]}Z`

  const ids = {
    soft: uid + 'soft',
    torso: uid + 'torso',
    hem: uid + 'hem',
    tank: uid + 'tank',
    hairclip: uid + 'hairclip',
  }

  // Dégradés « cylindre » : clair à gauche, foncé à droite.
  const palette: [string, string][] = [
    ['skin', skin],
    ['hair', a.hairColor],
    ['hat', a.hatColor],
    ['top', a.topColor],
    ['accent', accent],
    ['bottom', a.bottomColor],
    ['shoes', a.shoesColor],
    ['gloves', a.glovesColor],
    ['acc', a.accessoryColor],
  ]

  const viewBox =
    crop === 'head' ? `70 ${hy - 40} 60 60` : crop === 'bust' ? `46 ${hy - 46} 108 ${shoulderY + 46 - (hy - 46)}` : '0 0 200 400'

  const longSleeve = a.top === 'pull' || a.top === 'sweat' || a.top === 'veste'
  const sleeveEnd = a.top === 'tshirt' ? 0.3 : a.top === 'debardeur' ? 0 : 0.97

  // ---- Bras complet (peau, manche, main) ----
  const arm = (s: number) => {
    const pts = armPts(s)
    const W = pts[pts.length - 1]
    const shadow = limb(pts.map(([x, y, w]) => [x - s * 2.5, y + 2, w] as LP))
    return (
      <g key={'arm' + s}>
        <path d={shadow} fill="#000" opacity={0.2} filter={url('soft')} />
        <path d={limb(pts)} fill={url('skin')} />
        {/* Creux du coude */}
        <path d={`M${pts[2][0] - s * 1.5} ${pts[2][1] - 2} q${s * 1.5} 2 ${s * 2.5} 0`} stroke={skinDark} strokeWidth={0.6} fill="none" opacity={0.6} />
        {sleeveEnd > 0 && (
          <>
            <path d={limb(slice(pts, 0, sleeveEnd, 1.6, 7))} fill={url('top')} stroke={shade(a.topColor, -0.35)} strokeWidth={0.4} />
            {/* Liseré sur la manche */}
            {(a.top === 'sweat' || a.top === 'tshirt') && (
              <path d={offsetLine(slice(pts, 0, sleeveEnd, 1.6, 7), s, 0.55, 0.12, 0.92)} stroke={accent} strokeWidth={1.6} fill="none" strokeLinecap="round" />
            )}
            {/* Plis */}
            <path d={offsetLine(slice(pts, 0, sleeveEnd, 1.6, 7), -s, 0.2, 0.55, 0.7)} stroke={shade(a.topColor, -0.3)} strokeWidth={0.6} fill="none" opacity={0.7} />
            {/* Poignet / bord de manche */}
            {longSleeve ? (
              <path d={limb(slice(pts, sleeveEnd - 0.07, sleeveEnd, 2, 3))} fill={a.top === 'sweat' ? url('accent') : shade(a.topColor, -0.2)} />
            ) : (
              <path d={limb(slice(pts, sleeveEnd - 0.04, sleeveEnd, 1.8, 3))} fill={url('accent')} />
            )}
          </>
        )}
        {hand(W, s)}
      </g>
    )
  }

  const hand = (W: LP, s: number) => {
    const [x, y] = W
    const k = 1 + b * 0.25
    const palm = `M${x - 4 * k} ${y} Q${x - 4.6 * k} ${y + 7} ${x - 3.6 * k} ${y + 12} Q${x - 2} ${y + 15.5 * k} ${x + 0.5} ${y + 15 * k} Q${x + 3.6 * k} ${y + 14.2 * k} ${x + 4 * k} ${y + 10} Q${x + 4.4 * k} ${y + 5} ${x + 4 * k} ${y}Z`
    const thumb = limb([
      [x - s * 3.4 * k, y + 3, 1.6 * k],
      [x - s * 4.8 * k, y + 7.5, 1.4 * k],
      [x - s * 4.2 * k, y + 10.5, 1.1 * k],
    ])
    const glove = a.gloves !== 'aucun'
    const fingerless = a.gloves === 'mitaines'
    return (
      <g>
        <path d={thumb} fill={glove && !fingerless ? url('gloves') : url('skin')} />
        <path d={palm} fill={url('skin')} />
        {[-1.8, 0.4, 2.4].map((dx) => (
          <path key={dx} d={`M${x + dx * k} ${y + 10.5} v${3.4 * k}`} stroke={skinDark} strokeWidth={0.5} opacity={0.8} />
        ))}
        {glove && (
          <>
            <path d={palm} fill={url('gloves')} clipPath={fingerless ? `url(#${uid}fl${s})` : undefined} />
            {fingerless && (
              <clipPath id={`${uid}fl${s}`}>
                <rect x={x - 8} y={y - 2} width={16} height={11.5} />
              </clipPath>
            )}
            {fingerless && <path d={`M${x - 3.8 * k} ${y + 9} Q${x} ${y + 10.5} ${x + 3.8 * k} ${y + 9}`} stroke={shade(a.glovesColor, -0.4)} strokeWidth={1} fill="none" />}
            <path d={`M${x - 4.4 * k} ${y + 1} H${x + 4.4 * k}`} stroke={shade(a.glovesColor, 0.25)} strokeWidth={2.4} strokeLinecap="round" />
            <path d={`M${x - 2.6} ${y + 5} h5.2`} stroke={accent} strokeWidth={0.9} strokeLinecap="round" opacity={0.9} />
          </>
        )}
      </g>
    )
  }

  // ---- Jambe complète (peau, bas, chaussure) ----
  const leg = (s: number) => {
    const pts = legPts(s)
    const A = pts[pts.length - 1]
    const pant = a.bottom === 'pantalon'
    const short = a.bottom === 'short'
    return (
      <g key={'leg' + s}>
        <path d={limb(pts)} fill={url('skin')} />
        {/* Rotule */}
        {!pant && <path d={`M${pts[2][0] - 2.5} ${pts[2][1] + 1} q2.5 2.2 5 0`} stroke={skinDark} strokeWidth={0.6} fill="none" opacity={0.6} />}
        {pant && (
          <>
            <path d={limb(slice(pts, 0, 1, 1.6, 9))} fill={url('bottom')} stroke={shade(a.bottomColor, -0.4)} strokeWidth={0.4} />
            {/* Empiècement du genou (coutures) */}
            {[0.4, 0.58].map((t) => {
              const p = along(pts, t)
              return <path key={t} d={`M${p[0] - p[2] - 1} ${p[1] - 1} Q${p[0]} ${p[1] + 2} ${p[0] + p[2] + 1} ${p[1] - 1}`} stroke={shade(a.bottomColor, -0.45)} strokeWidth={0.7} fill="none" />
            })}
            {/* Bande latérale */}
            <path d={offsetLine(slice(pts, 0, 1, 1.6, 9), s, 0.8, 0.04, 0.9)} stroke={accent} strokeWidth={1.4} fill="none" strokeLinecap="round" />
            {/* Plis */}
            <path d={offsetLine(slice(pts, 0, 1, 1.6, 9), -s, 0.25, 0.15, 0.3)} stroke={shade(a.bottomColor, -0.35)} strokeWidth={0.6} fill="none" />
            {/* Bas resserré (jogging) */}
            <path d={limb(slice(pts, 0.88, 0.96, 1.9, 3))} fill={shade(a.bottomColor, -0.2)} />
          </>
        )}
        {short && (
          <>
            <path d={limb(slice(pts, 0, 0.42, 2, 5))} fill={url('bottom')} stroke={shade(a.bottomColor, -0.4)} strokeWidth={0.4} />
            {(() => {
              const p = along(pts, 0.25)
              return <rect x={p[0] + s * p[2] * 0.25 - 4} y={p[1] - 4} width={8} height={9} rx={1.5} fill={shade(a.bottomColor, -0.12)} stroke={shade(a.bottomColor, -0.4)} strokeWidth={0.5} />
            })()}
          </>
        )}
        {shoe(A, s, pts)}
      </g>
    )
  }

  const shoe = (A: LP, s: number, pts: LP[]) => {
    const x = A[0]
    const w = 6.5 + b * 2.2
    const top = ankleY - 5
    const c = url('shoes')
    const sole = a.shoes === 'bottes' ? shade(a.shoesColor, -0.5) : '#f2f2f4'
    return (
      <g>
        {a.shoes === 'bottes' && (
          <>
            <path d={limb(slice(pts, 0.6, 1, 2.2, 5))} fill={c} stroke={shade(a.shoesColor, -0.4)} strokeWidth={0.5} />
            {[0.7, 0.86].map((t) => {
              const p = along(pts, t)
              return (
                <g key={t}>
                  <path d={`M${p[0] - p[2] - 2} ${p[1]} H${p[0] + p[2] + 2}`} stroke={shade(a.shoesColor, -0.35)} strokeWidth={2.2} />
                  <rect x={p[0] + s * (p[2] - 2) - 1.5} y={p[1] - 1.8} width={3} height={3.6} rx={0.6} fill="none" stroke="#c9ccd8" strokeWidth={0.8} />
                </g>
              )
            })}
          </>
        )}
        <path
          d={`M${x - w} ${ankleY + 10} Q${x - w - 1} ${top + 6} ${x - w + 2.5} ${top + 1} Q${x} ${top - 3} ${x + w - 2.5} ${top + 1} Q${x + w + 1} ${top + 6} ${x + w} ${ankleY + 10}Z`}
          fill={c}
          stroke={shade(a.shoesColor, -0.4)}
          strokeWidth={0.5}
        />
        {/* Bout et lacets */}
        <ellipse cx={x} cy={ankleY + 7} rx={w * 0.7} ry={3} fill={shade(a.shoesColor, 0.18)} />
        {a.shoes === 'baskets' && (
          <>
            {[0, 2.4, 4.8].map((dy) => (
              <path key={dy} d={`M${x - 2.2} ${top + 3 + dy} L${x + 2.2} ${top + 3.6 + dy}`} stroke="#fff" strokeWidth={0.9} strokeLinecap="round" opacity={0.9} />
            ))}
            <path d={`M${x + s * (w - 1)} ${top + 4} Q${x + s * (w - 3)} ${ankleY + 3} ${x + s * (w - 0.5)} ${ankleY + 8}`} stroke={accent} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          </>
        )}
        <rect x={x - w - 0.8} y={ankleY + 8.5} width={w * 2 + 1.6} height={4.5} rx={2} fill={sole} />
        <path d={`M${x - w} ${ankleY + 12.4} H${x + w}`} stroke={shade(sole, -0.3)} strokeWidth={0.8} />
      </g>
    )
  }

  // ---- Haut ----
  const topLayer = () => {
    const dark = shade(a.topColor, -0.3)
    const hem = a.top === 'veste' ? hipY + 2 : hemY
    return (
      <>
        <g clipPath={`url(#${ids.hem})`}>
          <g clipPath={a.top === 'debardeur' ? `url(#${ids.tank})` : undefined}>
            <path d={torso} fill={url('top')} stroke={shade(a.topColor, -0.35)} strokeWidth={0.5} />
            {/* Empiècement en diagonale (style dresseur) */}
            {(a.top === 'sweat' || a.top === 'tshirt') && (
              <g clipPath={`url(#${ids.torso})`}>
                <path d={`M${100 - sh - 6} ${waistY + 6} L${100 + sh + 6} ${shoulderY + 16} L${100 + sh + 6} ${hipY + 6} L${100 - sh - 6} ${hipY + 6}Z`} fill={url('accent')} />
                <path d={`M${100 - sh - 6} ${waistY + 6} L${100 + sh + 6} ${shoulderY + 16}`} stroke={shade(accent, -0.3)} strokeWidth={0.6} />
              </g>
            )}
            {a.top === 'veste' && (
              <g clipPath={`url(#${ids.torso})`}>
                <path d={`M92 ${shoulderY - 6} L100 ${shoulderY + 30} L108 ${shoulderY - 6}Z`} fill={url('accent')} />
              </g>
            )}
            {/* Ombre sous la poitrine et plis à la taille */}
            <path d={`M${100 - wa + 3} ${waistY - 3} Q100 ${waistY + 3} ${100 + wa - 3} ${waistY - 3}`} stroke={dark} strokeWidth={0.7} fill="none" opacity={0.6} />
            <path d={`M${100 - wa} ${waistY + 4} q6 3 10 0 M${100 + wa} ${waistY + 4} q-6 3 -10 0`} stroke={dark} strokeWidth={0.6} fill="none" opacity={0.6} />
            {girl && <path d={`M${100 - 15} ${shoulderY + 24} Q${100 - 8} ${shoulderY + 30} 100 ${shoulderY + 25} Q${100 + 8} ${shoulderY + 30} ${100 + 15} ${shoulderY + 24}`} stroke={dark} strokeWidth={0.7} fill="none" opacity={0.55} />}
          </g>
        </g>
        {/* Bas du haut */}
        {a.top !== 'debardeur' && <path d={`M${100 - hp + 1} ${hem - 1.5} Q100 ${hem + 1} ${100 + hp - 1} ${hem - 1.5}`} stroke={a.top === 'tshirt' ? dark : shade(a.topColor, -0.2)} strokeWidth={a.top === 'tshirt' ? 0.8 : 3.4} fill="none" />}
        {a.top === 'pull' && (
          <>
            <path d={`M90 ${shoulderY - 5} Q100 ${shoulderY + 4} 110 ${shoulderY - 5}`} stroke={shade(a.topColor, -0.2)} strokeWidth={3} fill="none" strokeLinecap="round" />
            <path d={`M${100 - sh + 2} ${shoulderY + 30} Q100 ${shoulderY + 33} ${100 + sh - 2} ${shoulderY + 30}`} stroke={url('accent')} strokeWidth={4} fill="none" />
          </>
        )}
        {a.top === 'tshirt' && <path d={`M91 ${shoulderY - 5} Q100 ${shoulderY + 5} 109 ${shoulderY - 5}`} stroke={shade(a.topColor, -0.25)} strokeWidth={1.8} fill="none" strokeLinecap="round" />}
        {a.top === 'debardeur' && (
          <>
            <path d={`M${100 - 11} ${shoulderY - 5} Q100 ${shoulderY + 12} ${100 + 11} ${shoulderY - 5}`} stroke={dark} strokeWidth={0.8} fill="none" />
            <path d={`M${100 - wa} ${hemY - 6} q4 3 9 1 M${100 + wa} ${hemY - 8} q-5 3 -9 1`} stroke={dark} strokeWidth={0.6} fill="none" />
          </>
        )}
        {a.top === 'sweat' && (
          <>
            {/* Capuche repliée autour du cou */}
            <path d={`M84 ${shoulderY - 3} Q100 ${shoulderY + 14} 116 ${shoulderY - 3} Q117 ${shoulderY - 12} 108 ${shoulderY - 9} Q100 ${shoulderY + 2} 92 ${shoulderY - 9} Q83 ${shoulderY - 12} 84 ${shoulderY - 3}Z`} fill={mix(a.topColor, '#8a8f99', 0.75)} stroke={INK} strokeWidth={0.4} strokeOpacity={0.4} />
            <path d={`M96.5 ${shoulderY + 6} L95.5 ${shoulderY + 22} M103.5 ${shoulderY + 6} L104.5 ${shoulderY + 22}`} stroke="#f4f4f6" strokeWidth={1.2} strokeLinecap="round" />
            <path d={`M95.5 ${shoulderY + 21} v2.5 M104.5 ${shoulderY + 21} v2.5`} stroke="#c9ccd8" strokeWidth={1.8} strokeLinecap="round" />
            {/* Poche ventrale */}
            <path d={`M${100 - wa + 4} ${hemY - 3} L${100 - wa + 8} ${waistY - 2} H${100 + wa - 8} L${100 + wa - 4} ${hemY - 3}`} stroke={shade(accent, -0.35)} strokeWidth={0.8} fill="none" />
          </>
        )}
        {a.top === 'veste' && (
          <>
            {/* Col montant et revers */}
            <path d={`M88 ${shoulderY - 9} L92 ${shoulderY - 6} L100 ${shoulderY + 30} L94 ${shoulderY + 30} L84 ${shoulderY + 4}Z`} fill={shade(a.topColor, -0.12)} stroke={dark} strokeWidth={0.5} />
            <path d={`M112 ${shoulderY - 9} L108 ${shoulderY - 6} L100 ${shoulderY + 30} L106 ${shoulderY + 30} L116 ${shoulderY + 4}Z`} fill={shade(a.topColor, -0.12)} stroke={dark} strokeWidth={0.5} />
            <path d={`M100 ${shoulderY + 30} V${hipY + 1}`} stroke={dark} strokeWidth={0.9} />
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={102.5} cy={shoulderY + 36 + i * ((hipY - shoulderY - 40) / 3)} r={1.1} fill="#d9c27a" stroke={shade('#d9c27a', -0.4)} strokeWidth={0.3} />
            ))}
            <path d={`M${100 - wa + 2} ${waistY + 8} h9 M${100 + wa - 2} ${waistY + 8} h-9`} stroke={dark} strokeWidth={0.8} />
          </>
        )}
      </>
    )
  }

  // ---- Bas (partie haute : hanches) ----
  const bottomBlock = () => {
    if (a.bottom === 'jupe') {
      const y1 = hipY + (kneeY - hipY) * 0.55
      return (
        <>
          <path d={`M${100 - wa - 1} ${waistY + 2} H${100 + wa + 1} L${100 + hp + 13} ${y1} Q100 ${y1 + 4} ${100 - hp - 13} ${y1}Z`} fill={url('bottom')} stroke={shade(a.bottomColor, -0.4)} strokeWidth={0.5} />
          {[-0.6, -0.2, 0.2, 0.6].map((f) => (
            <path key={f} d={`M${100 + f * wa} ${waistY + 6} L${100 + f * (hp + 13)} ${y1 + 1}`} stroke={shade(a.bottomColor, -0.3)} strokeWidth={0.6} />
          ))}
        </>
      )
    }
    return (
      <>
        <path
          d={`M${100 - wa - 1} ${waistY + 1} H${100 + wa + 1} Q${100 + hp + 1} ${waistY + (hipY - waistY) * 0.5} ${100 + hp + 0.5} ${hipY - 2} L${100 + hp - 1} ${hipY + 10} L${100 + hp * 0.2} ${hipY + 10} Q100 ${hipY + 5} ${100 - hp * 0.2} ${hipY + 10} L${100 - hp + 1} ${hipY + 10} L${100 - hp - 0.5} ${hipY - 2} Q${100 - hp - 1} ${waistY + (hipY - waistY) * 0.5} ${100 - wa - 1} ${waistY + 1}Z`}
          fill={url('bottom')}
        />
        <path d={`M100 ${hemY} V${hipY + 4}`} stroke={shade(a.bottomColor, -0.4)} strokeWidth={0.7} />
        <path d={`M${100 - hp + 3} ${hemY + 1} q5 6 10 6 M${100 + hp - 3} ${hemY + 1} q-5 6 -10 6`} stroke={shade(a.bottomColor, -0.4)} strokeWidth={0.6} fill="none" />
      </>
    )
  }

  // ---- Accessoires ----
  const beltY = waistY + (hipY - waistY) * 0.42
  const accessoryFront = () => {
    const c = url('acc')
    const dark = shade(a.accessoryColor, -0.4)
    switch (a.accessory) {
      case 'ceinture':
        return (
          <>
            <path d={`M${100 - hp} ${beltY - 2} Q100 ${beltY + 2} ${100 + hp} ${beltY - 2} L${100 + hp} ${beltY + 2.5} Q100 ${beltY + 6.5} ${100 - hp} ${beltY + 2.5}Z`} fill={c} stroke={dark} strokeWidth={0.5} />
            <path d={`M${100 - hp + 2} ${beltY + 3} Q100 ${beltY + 9} ${100 + hp - 4} ${beltY + 7}`} stroke={dark} strokeWidth={2.2} fill="none" />
            <rect x={95.5} y={beltY - 1} width={9} height={6.5} rx={1} fill="none" stroke="#c9ccd8" strokeWidth={1.3} />
            <rect x={100 + hp - 9} y={beltY + 4} width={9} height={10} rx={1.6} fill={c} stroke={dark} strokeWidth={0.5} />
          </>
        )
      case 'sac':
        return (
          <>
            {[-1, 1].map((s) => (
              <path
                key={s}
                d={`M${100 + s * 13} ${shoulderY - 6} Q${100 + s * (sh - 6)} ${shoulderY + 6} ${100 + s * (sh - 7)} ${waistY - 4}`}
                stroke={c}
                strokeWidth={4.2}
                fill="none"
                strokeLinecap="round"
              />
            ))}
            <path d={`M${100 - sh + 8} ${shoulderY + 24} H${100 + sh - 8}`} stroke={dark} strokeWidth={1.6} />
            <rect x={97} y={shoulderY + 22} width={6} height={4} rx={1} fill="#c9ccd8" />
          </>
        )
      case 'bandouliere':
        return (
          <>
            <path d={`M${100 - 14} ${shoulderY - 5} L${100 + hp - 2} ${beltY + 2}`} stroke={c} strokeWidth={3.6} strokeLinecap="round" />
            <rect x={100 + hp - 8} y={beltY - 2} width={13} height={11} rx={2.4} fill={c} stroke={dark} strokeWidth={0.6} />
            <path d={`M${100 + hp - 8} ${beltY + 2} h13`} stroke={dark} strokeWidth={0.7} />
          </>
        )
      default:
        return null
    }
  }

  const front = hairFront(a, url('hair'), shade(a.hairColor, -0.35), shade(a.hairColor, 0.3))

  return (
    <svg viewBox={viewBox} width={size} height={size} className={className} role="img" aria-label="Avatar du dresseur">
      <defs>
        {palette.map(([k, c]) => (
          <linearGradient key={k} id={uid + k} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={shade(c, 0.16)} />
            <stop offset="0.38" stopColor={c} />
            <stop offset="1" stopColor={shade(c, -0.28)} />
          </linearGradient>
        ))}
        <radialGradient id={uid + 'face'} cx="0.42" cy="0.38" r="0.72">
          <stop offset="0" stopColor={shade(skin, 0.1)} />
          <stop offset="0.6" stopColor={skin} />
          <stop offset="1" stopColor={shade(skin, -0.24)} />
        </radialGradient>
        <linearGradient id={uid + 'hairv'} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={shade(a.hairColor, 0.22)} />
          <stop offset="0.5" stopColor={a.hairColor} />
          <stop offset="1" stopColor={shade(a.hairColor, -0.3)} />
        </linearGradient>
        <filter id={ids.soft} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
        <clipPath id={ids.torso}>
          <path d={torso} />
        </clipPath>
        <clipPath id={ids.hem}>
          <rect x="0" y="0" width="200" height={a.top === 'veste' ? hipY + 2 : hemY} />
        </clipPath>
        <clipPath id={ids.tank}>
          <path
            d={`M${100 - 15} ${shoulderY - 7} L${100 - 11} ${shoulderY - 7} Q100 ${shoulderY + 12} ${100 + 11} ${shoulderY - 7} L${100 + 15} ${shoulderY - 7} Q${100 + sh - 8} ${shoulderY + 12} ${100 + sh - 5} ${shoulderY + 25} L${100 + sh + 8} ${hipY + 6} L${100 - sh - 8} ${hipY + 6} L${100 - sh + 5} ${shoulderY + 25} Q${100 - sh + 8} ${shoulderY + 12} ${100 - 15} ${shoulderY - 7}Z`}
          />
        </clipPath>
        <clipPath id={ids.hairclip}>
          <rect x="0" y="-13" width="200" height="300" />
        </clipPath>
      </defs>

      {crop === 'full' && <ellipse cx={100} cy={ankleY + 14} rx={hp + 20} ry={5} fill="#000" opacity={0.14} filter={url('soft')} />}

      {/* Derrière : cheveux longs, sac à dos */}
      <g transform={`translate(0 ${hy})`}>
        {hairBack(a, url('hairv'), shade(a.hairColor, -0.4))}
        {a.hat === 'envers' && <path d="M114 -31 Q129 -40 136 -30 Q126 -25 116 -24Z" fill={shade(a.hatColor, -0.25)} />}
      </g>
      {a.accessory === 'sac' && (
        <rect x={100 - sh + 6} y={shoulderY - 10} width={(sh - 6) * 2} height={waistY - shoulderY + 10} rx={10} fill={shade(a.accessoryColor, -0.25)} />
      )}

      {/* Jambes */}
      {leg(-1)}
      {leg(1)}

      {/* Cou et torse */}
      <path d={`M${93 - b * 1.5} ${chin - 8} L${92 - b * 2} ${shoulderY - 2} Q100 ${shoulderY + 3} ${108 + b * 2} ${shoulderY - 2} L${107 + b * 1.5} ${chin - 8}Z`} fill={url('skin')} />
      <ellipse cx={100} cy={chin - 1} rx={8.5} ry={3.6} fill="#000" opacity={0.22} filter={url('soft')} />
      <path d={torso} fill={url('skin')} />
      <path d={`M${100 - 10} ${shoulderY + 2} Q${100 - 4} ${shoulderY + 4} 100 ${shoulderY + 1} Q${100 + 4} ${shoulderY + 4} ${100 + 10} ${shoulderY + 2}`} stroke={skinDark} strokeWidth={0.6} fill="none" opacity={0.7} />
      {bottomBlock()}
      {topLayer()}
      {accessoryFront()}
      {arm(-1)}
      {arm(1)}

      {/* Tête */}
      <g transform={`translate(0 ${hy})`}>
        <ellipse cx={82} cy={1} rx={3} ry={5.2} fill={url('skin')} />
        <ellipse cx={118} cy={1} rx={3} ry={5.2} fill={skinDark} />
        <path d="M82 -6 C82 -31 118 -31 118 -6 C118 6 115.5 13.5 110.5 18.5 C106.5 22.5 103.5 24 100 24 C96.5 24 93.5 22.5 89.5 18.5 C84.5 13.5 82 6 82 -6Z" fill={url('face')} />
        {/* Pommettes et mâchoire */}
        <path d="M113 6 Q112 15 104 21" stroke={skinDark} strokeWidth={1.4} fill="none" opacity={0.35} filter={url('soft')} />
        <ellipse cx={89.5} cy={7.5} rx={3.4} ry={1.8} fill="#ff6b6b" opacity={0.14} />
        <ellipse cx={110.5} cy={7.5} rx={3.4} ry={1.8} fill="#ff6b6b" opacity={0.14} />
        {face(a, skinDark, uid)}
        {a.hat === 'aucun' ? front : <g clipPath={`url(#${ids.hairclip})`}>{front}</g>}
        {a.accessory === 'bandeau' && a.hat === 'aucun' && (
          <path d="M81.5 -13 Q100 -24 118.5 -13 L118.5 -9.5 Q100 -20.5 81.5 -9.5Z" fill={url('acc')} stroke={shade(a.accessoryColor, -0.4)} strokeWidth={0.4} />
        )}
        {hat(a, url('hat'))}
      </g>
    </svg>
  )
}

function face(a: Avatar, skinDark: string, uid: string) {
  const lip = mix(a.skin, '#b04a56', 0.45)
  const eyes = [93, 107].map((x) => {
    const s = x < 100 ? -1 : 1 // côté extérieur
    const inner = x - s * 3.8
    const outer = x + s * 3.7
    const big = a.eyes === 'grand' ? 1.25 : a.eyes === 'determine' ? 0.85 : 1
    const top = -2.4 * big
    const bot = 1.9 * big
    const almond = `M${inner} 0.4 Q${x - s * 0.8} ${top} ${outer} -0.3 Q${x + s * 0.6} ${bot} ${inner} 0.4Z`
    const clip = `${uid}eye${s}`
    const brow =
      a.eyes === 'determine'
        ? `M${x - s * 4.6} -3 Q${x} -5.6 ${x + s * 4.8} -6.6 Q${x} -4.4 ${x - s * 4.6} -2Z`
        : `M${x - s * 4.6} -4.2 Q${x} -6.9 ${x + s * 4.8} -5.4 Q${x} -5.6 ${x - s * 4.6} -3.1Z`
    let eye
    if (a.eyes === 'joyeux') {
      eye = <path d={`M${inner} 0.6 Q${x} -2.2 ${outer} 0.2`} stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    } else {
      eye = (
        <>
          <ellipse cx={x} cy={-2.6} rx={4.4} ry={1.6} fill={skinDark} opacity={0.22} />
          <path d={almond} fill="#f7f4f0" />
          <clipPath id={clip}>
            <path d={almond} />
          </clipPath>
          <g clipPath={`url(#${clip})`}>
            <circle cx={x + s * 0.2} cy={0} r={1.9 * big} fill={a.eyeColor} />
            <circle cx={x + s * 0.2} cy={0} r={1.9 * big} fill="none" stroke={shade(a.eyeColor, -0.45)} strokeWidth={0.4} />
            <circle cx={x + s * 0.2} cy={0} r={0.85 * big} fill="#121218" />
            <circle cx={x - 0.6} cy={-0.7} r={0.5} fill="#fff" />
            {a.eyes === 'endormi' && <path d={`M${x - 5} -4 H${x + 5} V-0.2 Q${x} 0.8 ${x - 5} -0.2Z`} fill={skinDark} />}
          </g>
          <path d={`M${inner - s * 0.3} 0.5 Q${x - s * 0.8} ${top - 0.2} ${outer + s * 0.3} -0.4`} stroke={INK} strokeWidth={a.lashes === 'aucun' ? 0.75 : 1.05} fill="none" strokeLinecap="round" />
          <path d={`M${x - 3} ${top - 1.1} Q${x} ${top - 2.2} ${x + 3} ${top - 1.2}`} stroke={skinDark} strokeWidth={0.45} fill="none" opacity={0.7} />
        </>
      )
    }
    const lashes =
      a.lashes === 'courts' ? (
        <path d={`M${outer} -0.4 l${s * 1.6} -1.3`} stroke={INK} strokeWidth={0.8} strokeLinecap="round" />
      ) : a.lashes === 'longs' ? (
        <path d={`M${outer} -0.4 l${s * 2.2} -1.6 M${x + s * 2.4} -1.8 l${s * 1.5} -1.9 M${x + s * 0.4} -2.4 l${s * 0.6} -2`} stroke={INK} strokeWidth={0.75} strokeLinecap="round" />
      ) : null
    return (
      <g key={x}>
        <path d={brow} fill={shade(a.hairColor, -0.25)} />
        {eye}
        {lashes}
      </g>
    )
  })

  const nose =
    a.nose === 'aucun' ? null : (
      <>
        <path d="M101.2 -1 Q102.6 5 102.8 8.5" stroke={skinDark} strokeWidth={0.9} fill="none" opacity={0.45} filter="none" />
        {a.nose === 'rond' ? (
          <ellipse cx={100.3} cy={8.6} rx={2.6} ry={1.8} fill={skinDark} opacity={0.35} />
        ) : a.nose === 'petit' ? (
          <path d="M97.8 9.2 Q99 10.4 100.2 9.8 Q101.4 10.4 102.6 9.2" stroke={skinDark} strokeWidth={0.8} fill="none" strokeLinecap="round" />
        ) : (
          <path d="M98.6 9.6 Q100.2 10.6 101.6 9.6" stroke={skinDark} strokeWidth={0.8} fill="none" strokeLinecap="round" />
        )}
        <circle cx={99.6} cy={7.8} r={0.7} fill="#fff" opacity={0.35} />
      </>
    )

  const upper = 'M95.6 14.3 Q97.6 12.7 100 13.5 Q102.4 12.7 104.4 14.3 Q100 15.1 95.6 14.3Z'
  const lower = 'M96 14.6 Q100 18.4 104 14.6 Q100 15.6 96 14.6Z'
  const mouth = {
    sourire: (
      <>
        <path d={lower} fill={shade(lip, 0.1)} />
        <path d={upper} fill={lip} />
        <path d="M95.2 13.8 Q100 16.4 104.8 13.8" stroke={shade(lip, -0.45)} strokeWidth={0.7} fill="none" strokeLinecap="round" />
      </>
    ),
    grand: (
      <>
        <path d="M95 13.6 Q100 14.4 105 13.6 Q104 19.6 100 19.6 Q96 19.6 95 13.6Z" fill="#5a1f26" />
        <path d="M96 14 Q100 14.7 104 14 L103.6 15.4 Q100 16 96.4 15.4Z" fill="#fff" />
        <path d="M95 13.6 Q100 14.4 105 13.6" stroke={lip} strokeWidth={1.1} fill="none" />
        <path d="M96.5 18.2 Q100 20.5 103.5 18.2" stroke={shade(lip, 0.1)} strokeWidth={1.1} fill="none" />
      </>
    ),
    neutre: (
      <>
        <path d={lower} fill={shade(lip, 0.1)} />
        <path d={upper} fill={lip} />
        <path d="M95.6 14.5 H104.4" stroke={shade(lip, -0.45)} strokeWidth={0.6} />
      </>
    ),
    o: <ellipse cx={100} cy={15.6} rx={1.9} ry={2.4} fill="#5a1f26" stroke={lip} strokeWidth={1} />,
    langue: (
      <>
        <path d={upper} fill={lip} />
        <path d="M98.4 14.8 Q100 19.5 101.8 14.8Z" fill="#e8798c" />
        <path d="M95.2 14 Q100 15.6 104.8 14" stroke={shade(lip, -0.45)} strokeWidth={0.7} fill="none" />
      </>
    ),
    chat: (
      <>
        <path d={lower} fill={shade(lip, 0.1)} />
        <path d={upper} fill={lip} />
        <path d="M95.6 14.6 Q99 15.4 104.6 13.2" stroke={shade(lip, -0.45)} strokeWidth={0.7} fill="none" strokeLinecap="round" />
      </>
    ),
  }[a.mouth]

  return (
    <>
      {eyes}
      {nose}
      {mouth}
      <path d="M97.5 21.5 Q100 22.6 102.5 21.5" stroke="#fff" strokeWidth={0.8} opacity={0.18} fill="none" />
    </>
  )
}

// ---- Cheveux (repère : centre du visage à x=100, yeux à y=0) ----

const COURT = 'M81 -2 C79 -24 90 -33 100 -33 C111 -33 121 -24 119 -2 C118 -9 116 -14 112 -16.5 C106 -12.5 96 -12.5 90 -16.5 C86 -13 83 -8 81 -2Z'

function strands(dark: string, light: string) {
  return (
    <>
      <path d="M90 -29 Q96 -24 94 -16 M101 -32 Q104 -24 101 -14 M110 -29 Q113 -22 112 -16" stroke={dark} strokeWidth={0.6} fill="none" opacity={0.6} />
      <path d="M88 -26 Q96 -32 106 -31" stroke={light} strokeWidth={1.4} fill="none" opacity={0.55} strokeLinecap="round" />
    </>
  )
}

function hairFront(a: Avatar, c: string, dark: string, light: string) {
  switch (a.hair) {
    case 'piquant':
      return (
        <g>
          <path d="M81 0 L79 -14 L83 -16 L81 -26 L89 -25 L92 -36 L99 -29 L106 -38 L109 -28 L117 -31 L116 -21 L121 -18 L119 0 C117 -10 112 -15 105 -15.5 L101 -11 L98 -16 C90 -15.5 84 -10 81 0Z" fill={c} />
          <path d="M86 -22 L92 -30 M97 -20 L103 -33 M108 -22 L113 -28" stroke={light} strokeWidth={1.2} opacity={0.5} strokeLinecap="round" />
          <path d="M84 -12 L88 -19 M112 -12 L116 -18 M101 -12 L101 -18" stroke={dark} strokeWidth={0.7} opacity={0.7} />
        </g>
      )
    case 'long':
    case 'couettes':
    case 'queue':
      return (
        <g>
          <path d="M81 6 C78 -25 90 -34 100 -34 C111 -34 122 -25 119 6 C118 -6 116 -12 112 -16 C106 -10 96 -10 88 -16 C84 -10 82 -2 81 6Z" fill={c} />
          {a.hair === 'long' && <path d="M81 6 Q80 20 83 34 L86 34 Q84 18 86 2Z M119 6 Q120 20 117 34 L114 34 Q116 18 114 2Z" fill={c} />}
          {strands(dark, light)}
        </g>
      )
    case 'boucle':
      return (
        <g fill={c}>
          <path d={COURT} />
          {[188, 206, 224, 242, 260, 278, 296, 314, 332, 350].map((deg) => {
            const r = (deg * Math.PI) / 180
            return <circle key={deg} cx={100 + 19 * Math.cos(r)} cy={-8 + 21 * Math.sin(r)} r={5.6} />
          })}
          <path d="M88 -24 Q96 -30 106 -29" stroke={light} strokeWidth={1.4} fill="none" opacity={0.5} />
        </g>
      )
    case 'rase':
      return <path d={COURT} fill={c} opacity={0.4} />
    case 'chauve':
      return <path d="M88 -24 Q96 -29 106 -28" stroke="#fff" strokeWidth={2} opacity={0.15} fill="none" strokeLinecap="round" />
    default:
      return (
        <g>
          <path d={COURT} fill={c} />
          {strands(dark, light)}
        </g>
      )
  }
}

function hairBack(a: Avatar, c: string, dark: string) {
  switch (a.hair) {
    case 'long':
      return (
        <g>
          <path d="M81 -6 C81 -34 119 -34 119 -6 L124 34 Q123 50 116 58 Q100 52 84 58 Q77 50 76 34Z" fill={c} />
          <path d="M86 20 Q85 40 88 54 M114 20 Q115 40 112 54 M100 30 V52" stroke={dark} strokeWidth={0.6} opacity={0.6} fill="none" />
        </g>
      )
    case 'queue':
      return (
        <g>
          <path d="M113 -20 C130 -20 133 8 129 36 C127 50 121 58 117 54 C123 38 125 8 111 -8Z" fill={c} />
          <path d="M120 0 Q125 20 121 46" stroke={dark} strokeWidth={0.6} fill="none" opacity={0.6} />
          <rect x={113} y={-14} width={4} height={5} rx={1.5} fill={dark} transform="rotate(-20 115 -12)" />
        </g>
      )
    case 'couettes':
      return (
        <g fill={c}>
          <path d="M80 -6 C70 0 68 26 74 42 C78 44 81 30 82 6Z" />
          <path d="M120 -6 C130 0 132 26 126 42 C122 44 119 30 118 6Z" />
          <circle cx={80} cy={-4} r={2.4} fill="#ff5c8a" />
          <circle cx={120} cy={-4} r={2.4} fill="#ff5c8a" />
        </g>
      )
    case 'chignon':
      return a.hat === 'aucun' ? <circle cx={100} cy={-34} r={9} fill={c} /> : null
    default:
      return null
  }
}

function hat(a: Avatar, c: string) {
  const dark = shade(a.hatColor, -0.3)
  switch (a.hat) {
    case 'casquette':
      return (
        <>
          <path d="M80.5 -13 C81 -31 91 -37 100 -37 C109 -37 119 -31 119.5 -13Z" fill={c} stroke={dark} strokeWidth={0.5} />
          <path d="M100 -36 V-14 M90 -34 Q88 -24 87 -14 M110 -34 Q112 -24 113 -14" stroke={dark} strokeWidth={0.6} fill="none" opacity={0.7} />
          <circle cx={100} cy={-36.5} r={1.6} fill={dark} />
          <path d="M78 -14 Q100 -9 122 -14 Q126 -11.5 122 -9.5 Q100 -3.5 78 -9.5 Q74 -11.5 78 -14Z" fill={dark} />
          <path d="M80 -12 Q100 -7.5 120 -12" stroke={shade(a.hatColor, 0.2)} strokeWidth={0.6} fill="none" />
        </>
      )
    case 'envers':
      return (
        <>
          <path d="M80 -13 C80 -34 91 -40 100 -40 C109 -40 120 -34 120 -13Z" fill={c} stroke={dark} strokeWidth={0.5} />
          <path d="M80 -14 Q100 -17 120 -14 L120 -11 Q100 -14 80 -11Z" fill={dark} />
          <path d="M94 -13 Q100 -20 106 -13" stroke={dark} strokeWidth={1.6} fill={shade(a.hatColor, 0.3)} />
          <circle cx={100} cy={-39.5} r={1.6} fill={dark} />
        </>
      )
    case 'bonnet':
      return (
        <>
          <circle cx={100} cy={-43} r={5} fill={shade(a.hatColor, 0.4)} />
          <path d="M80 -12 C79 -37 90 -43 100 -43 C110 -43 121 -37 120 -12Z" fill={c} />
          {[86, 93, 100, 107, 114].map((x) => (
            <path key={x} d={`M${x} -39 Q${x + (x - 100) * 0.08} -28 ${x + (x - 100) * 0.05} -20`} stroke={dark} strokeWidth={0.5} fill="none" opacity={0.5} />
          ))}
          <rect x={79} y={-20} width={42} height={9} rx={4.5} fill={dark} />
          {[83, 88, 93, 98, 103, 108, 113, 117].map((x) => (
            <path key={x} d={`M${x} -19 V-12`} stroke={shade(a.hatColor, -0.5)} strokeWidth={0.6} opacity={0.5} />
          ))}
        </>
      )
    default:
      return null
  }
}
