import { useId } from 'react'
import { type Avatar, shade } from '../lib/avatar'

/**
 * Dessin du dresseur, de face, en SVG : proportions réalistes (≈ 7 têtes de haut),
 * lumière venant de la gauche pour donner du volume.
 * La taille et l'épaisseur changent les proportions ; les pieds restent posés au sol.
 * crop : « full » = en pied, « bust » = portrait jusqu'aux épaules, « head » = la tête seule.
 */
export function AvatarView({ a, crop = 'full', size, className = '' }: { a: Avatar; crop?: 'full' | 'bust' | 'head'; size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const g = (k: string) => `url(#${uid}${k})`
  const girl = a.gender === 'girl'
  const b = a.build

  // Repères verticaux
  const H = 330 + a.height * 50
  const headTop = 392 - H
  const hy = headTop + 27 // centre du visage
  const chin = hy + 27
  const u = H / 7
  const shoulderY = chin + 12
  const waistY = headTop + 3 * u
  const hipY = headTop + 3.55 * u
  const kneeY = headTop + 5.25 * u
  const ankleY = 380

  // Largeurs (demi-largeurs) et épaisseur des membres
  const sh = (girl ? 25 : 29) + b * 14
  const wa = (girl ? 15 : 19) + b * 13
  const hp = (girl ? 22 : 20) + b * 13
  const ua = 5.5 + b * 3
  const fa = 4.5 + b * 2.5
  const th = 8 + b * 5
  const ca = 6 + b * 3.5

  const skinDark = shade(a.skin, -0.2)
  const sleeve = a.top === 'tshirt' ? 0.55 : a.top === 'debardeur' ? 0 : 1

  const viewBox =
    crop === 'head'
      ? `66 ${hy - 44} 68 68`
      : crop === 'bust'
        ? `42 ${headTop - 18} 116 ${shoulderY + 48 - (headTop - 18)}`
        : '0 0 200 400'

  const torso = `M91 ${shoulderY - 6} Q${100 - sh + 6} ${shoulderY - 4} ${100 - sh} ${shoulderY + 6} Q${100 - sh - 1} ${shoulderY + 14} ${100 - sh + 3} ${shoulderY + 24} Q${100 - wa - 2} ${(shoulderY + waistY) / 2 + 8} ${100 - wa} ${waistY} L${100 - hp} ${hipY} H${100 + hp} L${100 + wa} ${waistY} Q${100 + wa + 2} ${(shoulderY + waistY) / 2 + 8} ${100 + sh - 3} ${shoulderY + 24} Q${100 + sh + 1} ${shoulderY + 14} ${100 + sh} ${shoulderY + 6} Q${100 + sh - 6} ${shoulderY - 4} 109 ${shoulderY - 6} Z`

  const line = (x1: number, y1: number, x2: number, y2: number, w: number, stroke: string, key?: string) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
  )
  const lerp = (p: number, q: number, t: number) => p + (q - p) * t

  const arm = (s: -1 | 1) => {
    const S = [100 + s * (sh - 5), shoulderY + 8]
    const E = [100 + s * (sh + 3 + b * 2), shoulderY + 1.3 * u]
    const W = [100 + s * (sh + 1), hipY + 0.45 * u]
    const top = g('top')
    const hx = W[0]
    const hyy = W[1] + 8
    const hr = 6 + b * 1.5
    return (
      <g key={s}>
        {line(S[0], S[1], E[0], E[1], ua * 2, g('skin'))}
        {line(E[0], E[1], W[0], W[1], fa * 2, g('skin'))}
        {sleeve > 0 && line(S[0], S[1], lerp(S[0], E[0], sleeve), lerp(S[1], E[1], sleeve), ua * 2 + 2.5, top)}
        {sleeve === 1 && (
          <>
            {line(E[0], E[1], W[0], W[1] - 2, fa * 2 + 2.5, top)}
            {line(lerp(E[0], W[0], 0.85), lerp(E[1], W[1], 0.85), W[0], W[1] - 2, fa * 2 + 3, shade(a.topColor, -0.25))}
          </>
        )}
        {a.gloves === 'aucun' ? (
          <ellipse cx={hx} cy={hyy} rx={hr} ry={hr + 2} fill={g('skin')} />
        ) : (
          <>
            <ellipse cx={hx} cy={hyy} rx={hr} ry={hr + 2} fill={g('gloves')} />
            {a.gloves === 'mitaines' && <ellipse cx={hx} cy={hyy + hr * 0.75} rx={hr * 0.8} ry={hr * 0.55} fill={g('skin')} />}
            {line(hx - hr + 1, W[1] + 1, hx + hr - 1, W[1] + 1, 4, shade(a.glovesColor, -0.25))}
          </>
        )}
      </g>
    )
  }

  const legPts = (s: -1 | 1) => ({
    H: [100 + s * hp * 0.5, hipY - 4],
    K: [100 + s * hp * 0.42, kneeY],
    A: [100 + s * hp * 0.4, ankleY],
  })

  const leg = (s: -1 | 1) => {
    const { H: Hj, K, A } = legPts(s)
    const bc = g('bottom')
    const shortEnd = 0.55
    return (
      <g key={s}>
        {line(Hj[0], Hj[1], K[0], K[1], th * 2, g('skin'))}
        {line(K[0], K[1], A[0], A[1], ca * 2, g('skin'))}
        {a.bottom === 'pantalon' && (
          <>
            {line(Hj[0], Hj[1], K[0], K[1], th * 2 + 2, bc)}
            {line(K[0], K[1], A[0], A[1] - 4, ca * 2 + 3, bc)}
          </>
        )}
        {a.bottom === 'short' && line(Hj[0], Hj[1], lerp(Hj[0], K[0], shortEnd), lerp(Hj[1], K[1], shortEnd), th * 2 + 3, bc)}
        {shoe(A, s)}
      </g>
    )
  }

  const shoe = (A: number[], s: number) => {
    const w = ca + 4
    const c = g('shoes')
    if (a.shoes === 'bottes') {
      const top = lerp(ankleY, kneeY, 0.5)
      return (
        <g>
          <rect x={A[0] - ca - 2} y={top} width={(ca + 2) * 2} height={ankleY - top + 6} rx={5} fill={c} />
          <path d={`M${A[0] - w} ${ankleY - 2} Q${A[0] - w} ${ankleY + 9} ${A[0] + s * 2} ${ankleY + 9} Q${A[0] + w} ${ankleY + 9} ${A[0] + w} ${ankleY - 2}Z`} fill={c} />
          <rect x={A[0] - w} y={ankleY + 7} width={w * 2} height={4} rx={2} fill={shade(a.shoesColor, -0.45)} />
        </g>
      )
    }
    return (
      <g>
        <path d={`M${A[0] - w} ${ankleY + 6} Q${A[0] - w} ${ankleY - 6} ${A[0]} ${ankleY - 7} Q${A[0] + w} ${ankleY - 6} ${A[0] + w} ${ankleY + 6}Z`} fill={c} />
        <path d={`M${A[0] - 3} ${ankleY - 3} L${A[0] + 3} ${ankleY - 3} M${A[0] - 3} ${ankleY + 1} L${A[0] + 3} ${ankleY + 1}`} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.85} />
        <rect x={A[0] - w - 0.5} y={ankleY + 5} width={w * 2 + 1} height={5} rx={2.5} fill="#f4f4f6" />
      </g>
    )
  }

  // Cheveux de devant : coupés sous le chapeau s'il y en a un.
  const front = hairFront(a, g('hair'))

  const colors: [string, string][] = [
    ['skin', a.skin],
    ['hair', a.hairColor],
    ['hat', a.hatColor],
    ['top', a.topColor],
    ['bottom', a.bottomColor],
    ['shoes', a.shoesColor],
    ['gloves', a.glovesColor],
  ]

  return (
    <svg viewBox={viewBox} width={size} height={size} className={className} role="img" aria-label="Avatar du dresseur">
      <defs>
        {colors.map(([k, c]) => (
          <linearGradient key={k} id={uid + k} gradientUnits="userSpaceOnUse" x1="55" y1="0" x2="145" y2="0">
            <stop offset="0" stopColor={shade(c, 0.14)} />
            <stop offset="0.5" stopColor={c} />
            <stop offset="1" stopColor={shade(c, -0.18)} />
          </linearGradient>
        ))}
        <clipPath id={uid + 'clip'}>
          <rect x="0" y="-10" width="200" height="200" />
        </clipPath>
      </defs>

      {/* Ombre au sol */}
      {crop === 'full' && <ellipse cx={100} cy={ankleY + 12} rx={hp + 16} ry={5} fill="#000" opacity={0.12} />}

      {/* Cheveux de derrière */}
      <g transform={`translate(0 ${hy})`}>
        {hairBack(a, shade(a.hairColor, -0.12))}
        {a.hat === 'envers' && <path d="M116 -26 Q134 -36 141 -25 Q131 -20 120 -18Z" fill={shade(a.hatColor, -0.25)} />}
      </g>

      {/* Jambes, bas, chaussures */}
      {leg(-1)}
      {leg(1)}
      {a.bottom === 'jupe' ? (
        <path d={`M${100 - wa} ${waistY} H${100 + wa} L${100 + hp + 12} ${hipY + 0.75 * u} Q100 ${hipY + 0.8 * u} ${100 - hp - 12} ${hipY + 0.75 * u} Z`} fill={g('bottom')} />
      ) : (
        <path
          d={`M${100 - wa + 1} ${waistY} H${100 + wa - 1} L${100 + hp} ${hipY} Q${100 + hp} ${hipY + 14} ${100 + hp * 0.5} ${hipY + 16} L100 ${hipY + 12} L${100 - hp * 0.5} ${hipY + 16} Q${100 - hp} ${hipY + 14} ${100 - hp} ${hipY} Z`}
          fill={g('bottom')}
        />
      )}

      {/* Cou, torse, bras */}
      <rect x={93 - b * 1.5} y={chin - 8} width={14 + b * 3} height={shoulderY - chin + 6} rx={5} fill={skinDark} />
      <path d={torso} fill={g('top')} />
      {topDetails(a, shoulderY, waistY, hipY, sh, wa, hp, skinDark, g('skin'))}
      {arm(-1)}
      {arm(1)}

      {/* Tête */}
      <g transform={`translate(0 ${hy})`}>
        <ellipse cx={78} cy={3} rx={3.5} ry={5.5} fill={skinDark} />
        <ellipse cx={122} cy={3} rx={3.5} ry={5.5} fill={skinDark} />
        <path d="M78 -4 C78 -31 122 -31 122 -4 C122 14 112 26 100 27 C88 26 78 14 78 -4Z" fill={g('skin')} />
        <ellipse cx={88} cy={10} rx={3.2} ry={1.8} fill="#ff6b6b" opacity={0.22} />
        <ellipse cx={112} cy={10} rx={3.2} ry={1.8} fill="#ff6b6b" opacity={0.22} />
        {face(a, skinDark)}
        {a.hat === 'aucun' ? front : <g clipPath={`url(#${uid}clip)`}>{front}</g>}
        {hat(a, g('hat'))}
      </g>
    </svg>
  )
}

function topDetails(a: Avatar, sy: number, wy: number, hy: number, sh: number, wa: number, hp: number, skinDark: string, skin: string) {
  const dark = shade(a.topColor, -0.25)
  switch (a.top) {
    case 'tshirt':
      return (
        <>
          <path d={`M92 ${sy - 6} Q100 ${sy + 5} 108 ${sy - 6}Z`} fill={skinDark} />
          <path d={`M${100 - hp + 1} ${hy - 3} H${100 + hp - 1}`} stroke={dark} strokeWidth={1.5} opacity={0.6} />
        </>
      )
    case 'debardeur':
      return (
        <>
          {[-1, 1].map((s) => (
            <path
              key={s}
              d={`M${100 + s * (sh - 11)} ${sy - 4} Q${100 + s * sh} ${sy - 2} ${100 + s * (sh + 1)} ${sy + 8} L${100 + s * (sh - 2)} ${sy + 25} Q${100 + s * (sh - 13)} ${sy + 14} ${100 + s * (sh - 11)} ${sy - 4}Z`}
              fill={skin}
            />
          ))}
          <path d={`M90 ${sy - 6} Q100 ${sy + 10} 110 ${sy - 6}Z`} fill={skinDark} />
        </>
      )
    case 'pull':
      return (
        <>
          <path d={`M91 ${sy - 6} Q100 ${sy + 4} 109 ${sy - 6}`} stroke={dark} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          <path d={`M${100 - wa - 4} ${(sy + wy) / 2 + 2} H${100 + wa + 4}`} stroke={shade(a.topColor, 0.35)} strokeWidth={5} />
          <path d={`M${100 - hp + 1} ${hy - 3} H${100 + hp - 1}`} stroke={dark} strokeWidth={5} />
        </>
      )
    case 'sweat':
      return (
        <>
          <path d={`M85 ${sy - 4} Q100 ${sy + 13} 115 ${sy - 4} Q115 ${sy - 12} 100 ${sy - 10} Q85 ${sy - 12} 85 ${sy - 4}Z`} fill={dark} />
          <path d={`M96 ${sy + 4} V${sy + 18} M104 ${sy + 4} V${sy + 18}`} stroke="#f4f4f6" strokeWidth={1.6} strokeLinecap="round" />
          <path d={`M${100 - wa + 3} ${wy - 4} H${100 + wa - 3} L${100 + wa} ${hy - 8} H${100 - wa} Z`} fill={shade(a.topColor, -0.12)} />
          <path d={`M${100 - hp + 1} ${hy - 3} H${100 + hp - 1}`} stroke={dark} strokeWidth={5} />
        </>
      )
  }
}

const INK = '#2b2b3a'

function face(a: Avatar, skinDark: string) {
  const eyes = [91, 109].map((x, i) => {
    const s = i === 0 ? -1 : 1
    let eye
    switch (a.eyes) {
      case 'grand':
        eye = (
          <>
            <ellipse cx={x} cy={1} rx={5.4} ry={4.4} fill="#fff" />
            <circle cx={x} cy={1.2} r={3.4} fill={a.eyeColor} />
            <circle cx={x} cy={1.2} r={1.6} fill="#15151f" />
            <circle cx={x - 1.2} cy={-0.2} r={1.1} fill="#fff" />
            <path d={`M${x - 5.6} 0.4 Q${x} -4.6 ${x + 5.6} 0`} stroke={INK} strokeWidth={1.5} fill="none" strokeLinecap="round" />
          </>
        )
        break
      case 'joyeux':
        eye = <path d={`M${x - 4.5} 2.5 Q${x} -2.5 ${x + 4.5} 2.5`} stroke={INK} strokeWidth={1.7} fill="none" strokeLinecap="round" />
        break
      case 'determine':
        eye = (
          <>
            <path d={`M${x - 4.8} 1.5 Q${x} -2.2 ${x + 4.8} 0.8 Q${x} 4.2 ${x - 4.8} 1.5Z`} fill="#fff" />
            <circle cx={x} cy={1.2} r={2.3} fill={a.eyeColor} />
            <circle cx={x} cy={1.2} r={1.1} fill="#15151f" />
            <path d={`M${x - 5} 1.2 Q${x} -2.6 ${x + 5} 0.4`} stroke={INK} strokeWidth={1.5} fill="none" strokeLinecap="round" />
          </>
        )
        break
      case 'endormi':
        eye = (
          <>
            <ellipse cx={x} cy={2} rx={4.4} ry={1.9} fill="#fff" />
            <circle cx={x} cy={2.6} r={1.8} fill={a.eyeColor} />
            <path d={`M${x - 5} 1.4 Q${x} -0.6 ${x + 5} 1.4`} stroke={INK} strokeWidth={1.7} fill="none" strokeLinecap="round" />
          </>
        )
        break
      default:
        eye = (
          <>
            <ellipse cx={x} cy={1} rx={4.6} ry={3.4} fill="#fff" />
            <circle cx={x} cy={1.2} r={2.7} fill={a.eyeColor} />
            <circle cx={x} cy={1.2} r={1.3} fill="#15151f" />
            <circle cx={x - 1} cy={0.2} r={0.8} fill="#fff" />
            <path d={`M${x - 5} 0.6 Q${x} -3.6 ${x + 5} 0.2`} stroke={INK} strokeWidth={1.3} fill="none" strokeLinecap="round" />
          </>
        )
    }
    const xo = x + s * 4.8
    const lashes =
      a.lashes === 'courts' ? (
        <path d={`M${xo} 0 l${s * 2.2} -1.6`} stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
      ) : a.lashes === 'longs' ? (
        <path d={`M${xo} 0.2 l${s * 2.8} -1.8 M${x + s * 3} -1.8 l${s * 2} -2.4 M${x} -2.6 l${s * 0.8} -2.6`} stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
      ) : null
    const browColor = shade(a.hairColor, -0.25)
    const brow =
      a.eyes === 'determine' ? (
        <path d={s < 0 ? `M${x - 5} -7.5 L${x + 4.5} -4.5` : `M${x + 5} -7.5 L${x - 4.5} -4.5`} stroke={browColor} strokeWidth={1.8} strokeLinecap="round" />
      ) : (
        <path d={`M${x - 4.5} -5.5 Q${x} -8 ${x + 4.5} -6`} stroke={browColor} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      )
    return (
      <g key={x}>
        {brow}
        {eye}
        {lashes}
      </g>
    )
  })

  const nose = {
    point: <circle cx={100} cy={9} r={0.9} fill={skinDark} />,
    petit: <path d="M99 5 Q101.8 9 99.6 9.6" stroke={skinDark} strokeWidth={1.1} fill="none" strokeLinecap="round" />,
    rond: <ellipse cx={100} cy={9} rx={2.2} ry={1.5} fill={skinDark} opacity={0.75} />,
    aucun: null,
  }[a.nose]

  const lip = '#8a3434'
  const mouth = {
    sourire: <path d="M95.5 14.5 Q100 18.5 104.5 14.5" stroke={lip} strokeWidth={1.4} fill="none" strokeLinecap="round" />,
    grand: (
      <>
        <path d="M94.5 14 H105.5 Q104.5 20.5 100 20.5 Q95.5 20.5 94.5 14Z" fill={lip} />
        <rect x={96} y={14} width={8} height={1.8} rx={0.8} fill="#fff" />
        <ellipse cx={100} cy={18.6} rx={2.4} ry={1.2} fill="#ff7f9c" />
      </>
    ),
    neutre: <path d="M96.5 15.5 H103.5" stroke={lip} strokeWidth={1.4} strokeLinecap="round" />,
    o: <ellipse cx={100} cy={16} rx={2} ry={2.6} fill={lip} />,
    langue: (
      <>
        <path d="M98.6 15.6 Q100 20.5 102.4 15.6Z" fill="#ff7f9c" />
        <path d="M95.5 14.5 Q100 18 104.5 14.5" stroke={lip} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      </>
    ),
    chat: <path d="M95.5 14.5 Q97.8 17.5 100 15 Q102.2 17.5 104.5 14.5" stroke={lip} strokeWidth={1.3} fill="none" strokeLinecap="round" />,
  }[a.mouth]

  return (
    <>
      {eyes}
      {nose}
      {mouth}
    </>
  )
}

const COURT = 'M77 2 C74 -24 88 -32 100 -32 C114 -32 126 -24 123 2 C120 -8 116 -13 110 -15 C104 -9 94 -9 88 -13 C84 -9 80 -5 77 2Z'

function hairFront(a: Avatar, c: string) {
  switch (a.hair) {
    case 'piquant':
      return <path d="M77 4 L74 -12 L80 -14 L78 -26 L88 -24 L92 -36 L101 -28 L110 -37 L113 -26 L122 -28 L121 -16 L127 -12 L123 4 C120 -8 112 -13 102 -12 C92 -14 82 -8 77 4Z" fill={c} />
    case 'long':
    case 'couettes':
      return <path d="M77 10 C73 -22 88 -32 100 -32 C115 -32 128 -22 123 10 C121 -4 118 -10 113 -14 C104 -6 92 -6 84 -12 C80 -6 78 2 77 10Z" fill={c} />
    case 'boucle':
      return (
        <g fill={c}>
          <path d={COURT} />
          {[195, 215, 235, 255, 275, 295, 315, 335].map((deg) => {
            const r = (deg * Math.PI) / 180
            return <circle key={deg} cx={100 + 22 * Math.cos(r)} cy={-6 + 22 * Math.sin(r)} r={7} />
          })}
        </g>
      )
    case 'rase':
      return <path d={COURT} fill={c} opacity={0.45} />
    case 'chauve':
      return null
    default:
      return <path d={COURT} fill={c} />
  }
}

function hairBack(a: Avatar, c: string) {
  switch (a.hair) {
    case 'long':
      return <path d="M78 -6 C78 -32 122 -32 122 -6 L127 52 Q100 60 73 52Z" fill={c} />
    case 'queue':
      return <path d="M116 -20 C134 -22 138 4 132 30 C130 38 125 40 124 36 C130 16 128 -4 114 -10Z" fill={c} />
    case 'couettes':
      return (
        <g fill={c}>
          <ellipse cx={73} cy={20} rx={7} ry={18} transform="rotate(12 73 20)" />
          <ellipse cx={127} cy={20} rx={7} ry={18} transform="rotate(-12 127 20)" />
          <circle cx={77} cy={4} r={2.6} fill="#ff5c8a" />
          <circle cx={123} cy={4} r={2.6} fill="#ff5c8a" />
        </g>
      )
    case 'chignon':
      return a.hat === 'aucun' ? <circle cx={100} cy={-31} r={10} fill={c} /> : null
    default:
      return null
  }
}

function hat(a: Avatar, c: string) {
  const dark = shade(a.hatColor, -0.25)
  switch (a.hat) {
    case 'casquette':
      return (
        <>
          <path d="M76 -10 C76 -32 88 -37 100 -37 C112 -37 124 -32 124 -10Z" fill={c} />
          <path d="M100 -36 V-11" stroke={dark} strokeWidth={1} opacity={0.5} />
          <path d="M90 -30 Q100 -33 110 -30 L110 -20 Q100 -22 90 -20Z" fill="#fff" opacity={0.9} />
          <circle cx={100} cy={-36} r={2} fill={dark} />
          <path d="M74 -12 Q100 -6 126 -12 Q131 -9 127 -7 Q100 0 73 -7 Q69 -9 74 -12Z" fill={dark} />
        </>
      )
    case 'envers':
      return (
        <>
          <path d="M76 -10 C76 -32 88 -37 100 -37 C112 -37 124 -32 124 -10Z" fill={c} />
          <path d="M76 -11 Q100 -15 124 -11 L124 -8 Q100 -12 76 -8Z" fill={dark} />
          <path d="M93 -10 Q100 -18 107 -10" stroke={dark} strokeWidth={2} fill={shade(a.hatColor, 0.3)} />
          <circle cx={100} cy={-36} r={2} fill={dark} />
        </>
      )
    case 'bonnet':
      return (
        <>
          <circle cx={100} cy={-41} r={6} fill={shade(a.hatColor, 0.45)} />
          <path d="M76 -8 C75 -34 88 -40 100 -40 C112 -40 125 -34 124 -8Z" fill={c} />
          <rect x={75} y={-16} width={50} height={10} rx={5} fill={dark} />
          {[82, 90, 98, 106, 114].map((x) => (
            <path key={x} d={`M${x + 2} -15 V-7`} stroke={shade(a.hatColor, -0.45)} strokeWidth={1} opacity={0.5} />
          ))}
        </>
      )
    default:
      return null
  }
}
