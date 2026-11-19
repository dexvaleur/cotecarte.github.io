import { useId } from 'react'
import { type Avatar, shade } from '../lib/avatar'

/**
 * Dessin du dresseur, de face, en SVG.
 * La taille et l'épaisseur changent les proportions ; les pieds restent toujours posés au sol.
 * crop="head" ne montre que la tête (pour les petites icônes et les choix de visage).
 */
export function AvatarView({ a, crop = 'full', size, className = '' }: { a: Avatar; crop?: 'full' | 'head'; size?: number; className?: string }) {
  const clip = useId()
  const tw = 50 + a.build * 34 // largeur du torse
  const th = 58 + a.height * 14 // hauteur du torse
  const lh = 50 + a.height * 40 // longueur des jambes
  const aw = 15 + a.build * 7 // largeur des bras
  const y0 = 110 // épaules
  const hipY = y0 + th
  const footY = hipY + lh
  const dy = 292 - (footY + 8) // on pose les pieds au sol
  const girl = a.gender === 'girl'
  const skinDark = shade(a.skin, -0.18)
  const lw = tw * 0.36 // largeur d'une jambe
  const legL = 100 - 3 - lw
  const legR = 103
  const sleeve = a.top === 'tshirt' ? 0.38 : a.top === 'debardeur' ? 0 : 1
  const viewBox = crop === 'head' ? `52 ${16 + dy} 96 96` : '0 0 200 300'

  const torso = girl
    ? `M${100 - tw / 2} ${y0 + 14} Q${100 - tw / 2} ${y0} ${100 - tw / 2 + 14} ${y0} H${100 + tw / 2 - 14} Q${100 + tw / 2} ${y0} ${100 + tw / 2} ${y0 + 14} L${100 + tw / 2 - 5} ${y0 + th * 0.62} L${100 + tw / 2} ${hipY} H${100 - tw / 2} L${100 - tw / 2 + 5} ${y0 + th * 0.62} Z`
    : `M${100 - tw / 2} ${y0 + 14} Q${100 - tw / 2} ${y0} ${100 - tw / 2 + 14} ${y0} H${100 + tw / 2 - 14} Q${100 + tw / 2} ${y0} ${100 + tw / 2} ${y0 + 14} V${hipY} H${100 - tw / 2} Z`

  const arm = (side: -1 | 1) => {
    const x = side < 0 ? 100 - tw / 2 - aw + 4 : 100 + tw / 2 - 4
    const h = th + 6
    const cx = x + aw / 2
    const hr = aw / 2 + 2
    return (
      <g transform={`rotate(${side * -9} ${cx} ${y0 + 8})`}>
        <rect x={x} y={y0 + 2} width={aw} height={h} rx={aw / 2} fill={a.skin} />
        {sleeve > 0 && <rect x={x} y={y0 + 2} width={aw} height={h * sleeve} rx={aw / 2} fill={a.topColor} />}
        {sleeve === 1 && <rect x={x} y={y0 + h - 6} width={aw} height={7} rx={3} fill={shade(a.topColor, -0.2)} />}
        {a.gloves === 'aucun' ? (
          <circle cx={cx} cy={y0 + 4 + h} r={hr} fill={a.skin} />
        ) : (
          <>
            <circle cx={cx} cy={y0 + 4 + h} r={hr} fill={a.glovesColor} />
            {a.gloves === 'mitaines' && <ellipse cx={cx} cy={y0 + 4 + h + hr * 0.5} rx={hr * 0.75} ry={hr * 0.5} fill={a.skin} />}
            <rect x={cx - hr} y={y0 + h - 4} width={hr * 2} height={5} rx={2.5} fill={shade(a.glovesColor, -0.2)} />
          </>
        )}
      </g>
    )
  }

  const shoe = (x: number) =>
    a.shoes === 'bottes' ? (
      <g key={x}>
        <rect x={x - 3} y={footY - 22} width={lw + 6} height={30} rx={5} fill={a.shoesColor} />
        <rect x={x - 3} y={footY + 4} width={lw + 6} height={4} rx={2} fill={shade(a.shoesColor, -0.35)} />
      </g>
    ) : (
      <g key={x}>
        <rect x={x - 3} y={footY - 6} width={lw + 6} height={14} rx={6} fill={a.shoesColor} stroke={shade(a.shoesColor, -0.25)} strokeWidth={1} />
        <rect x={x - 3} y={footY + 4} width={lw + 6} height={4} rx={2} fill="#f4f4f6" />
      </g>
    )

  const bottomEnd = a.bottom === 'short' ? hipY + lh * 0.38 : a.bottom === 'jupe' ? hipY + lh * 0.42 : footY

  // Cheveux de devant : coupés sous le chapeau s'il y en a un.
  const front = hairFront(a)

  return (
    <svg viewBox={viewBox} width={size} height={size} className={className} role="img" aria-label="Avatar du dresseur">
      <defs>
        <clipPath id={clip}>
          <rect x="0" y="54" width="200" height="300" />
        </clipPath>
      </defs>
      <g transform={`translate(0 ${dy})`}>
        {/* Cheveux de derrière */}
        {hairBack(a)}
        {a.hat === 'envers' && <path d="M126 34 Q150 24 160 38 Q146 44 132 44Z" fill={shade(a.hatColor, -0.2)} />}

        {/* Jambes et bas */}
        <rect x={legL} y={hipY - 6} width={lw} height={lh + 6} rx={6} fill={a.skin} />
        <rect x={legR} y={hipY - 6} width={lw} height={lh + 6} rx={6} fill={a.skin} />
        {a.bottom === 'jupe' ? (
          <path d={`M${100 - tw / 2 + 2} ${hipY - 10} H${100 + tw / 2 - 2} L${100 + tw / 2 + 10} ${bottomEnd} H${100 - tw / 2 - 10} Z`} fill={a.bottomColor} />
        ) : (
          <>
            <rect x={100 - tw / 2 + 3} y={hipY - 10} width={tw - 6} height={22} rx={6} fill={a.bottomColor} />
            <rect x={legL} y={hipY - 6} width={lw} height={bottomEnd - hipY + 6} rx={5} fill={a.bottomColor} />
            <rect x={legR} y={hipY - 6} width={lw} height={bottomEnd - hipY + 6} rx={5} fill={a.bottomColor} />
            <path d={`M100 ${hipY + 4} V${hipY + 18}`} stroke={shade(a.bottomColor, -0.25)} strokeWidth={1.5} />
          </>
        )}
        {shoe(legL)}
        {shoe(legR)}

        {/* Bras, cou, torse */}
        {arm(-1)}
        {arm(1)}
        <rect x={92} y={96} width={16} height={y0 - 90} rx={5} fill={skinDark} />
        <path d={torso} fill={a.topColor} />
        {a.top === 'tshirt' && <path d={`M90 ${y0} Q100 ${y0 + 12} 110 ${y0}Z`} fill={skinDark} />}
        {a.top === 'debardeur' && (
          <path d={`M${100 - tw / 2 + 12} ${y0 + 1} Q100 ${y0 + 22} ${100 + tw / 2 - 12} ${y0 + 1}Z`} fill={a.skin} />
        )}
        {a.top === 'pull' && (
          <>
            <path d={`M88 ${y0 + 1} Q100 ${y0 + 10} 112 ${y0 + 1}`} stroke={shade(a.topColor, -0.25)} strokeWidth={5} fill="none" strokeLinecap="round" />
            <rect x={100 - tw / 2 + 1} y={y0 + th * 0.42} width={tw - 2} height={8} fill={shade(a.topColor, 0.35)} />
            <rect x={100 - tw / 2} y={hipY - 6} width={tw} height={6} fill={shade(a.topColor, -0.2)} />
          </>
        )}
        {a.top === 'sweat' && (
          <>
            <path d={`M82 ${y0 + 2} Q100 ${y0 + 22} 118 ${y0 + 2} Q118 ${y0 - 6} 100 ${y0 - 4} Q82 ${y0 - 6} 82 ${y0 + 2}Z`} fill={shade(a.topColor, -0.22)} />
            <path d={`M95 ${y0 + 10} V${y0 + 26} M105 ${y0 + 10} V${y0 + 26}`} stroke="#f4f4f6" strokeWidth={2} strokeLinecap="round" />
            <rect x={100 - tw * 0.3} y={y0 + th * 0.55} width={tw * 0.6} height={th * 0.28} rx={6} fill={shade(a.topColor, -0.12)} />
          </>
        )}

        {/* Tête */}
        <ellipse cx={64} cy={76} rx={6} ry={9} fill={skinDark} />
        <ellipse cx={136} cy={76} rx={6} ry={9} fill={skinDark} />
        <circle cx={100} cy={70} r={36} fill={a.skin} />
        <ellipse cx={80} cy={86} rx={5.5} ry={3} fill="#ff6b6b" opacity={0.28} />
        <ellipse cx={120} cy={86} rx={5.5} ry={3} fill="#ff6b6b" opacity={0.28} />
        {face(a, skinDark)}

        {a.hat === 'aucun' ? front : <g clipPath={`url(#${clip})`}>{front}</g>}
        {hat(a)}
      </g>
    </svg>
  )
}

const INK = '#2b2b3a'

function face(a: Avatar, skinDark: string) {
  const eyes = [86, 114].map((x, i) => {
    const s = i === 0 ? -1 : 1
    let eye
    switch (a.eyes) {
      case 'grand':
        eye = (
          <>
            <ellipse cx={x} cy={74} rx={6} ry={8} fill={a.eyeColor} />
            <ellipse cx={x} cy={75} rx={3} ry={4.5} fill="#15151f" />
            <circle cx={x - 2} cy={71} r={2.2} fill="#fff" />
            <circle cx={x + 2} cy={78} r={1} fill="#fff" />
          </>
        )
        break
      case 'joyeux':
        eye = <path d={`M${x - 6} 77 Q${x} 68 ${x + 6} 77`} stroke={INK} strokeWidth={2.8} fill="none" strokeLinecap="round" />
        break
      case 'determine':
        eye = (
          <>
            <path d={`M${x - 7} 75 Q${x} 68 ${x + 7} 74 Q${x} 81 ${x - 7} 75Z`} fill={a.eyeColor} />
            <circle cx={x} cy={74.5} r={2.6} fill="#15151f" />
            <circle cx={x - 1.5} cy={72.5} r={1.1} fill="#fff" />
            <path d={s < 0 ? `M${x - 8} 63 L${x + 7} 67` : `M${x + 8} 63 L${x - 7} 67`} stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          </>
        )
        break
      case 'endormi':
        eye = <path d={`M${x - 6} 74 Q${x} 79 ${x + 6} 74`} stroke={INK} strokeWidth={2.6} fill="none" strokeLinecap="round" />
        break
      default:
        eye = (
          <>
            <ellipse cx={x} cy={74} rx={4.5} ry={6} fill={a.eyeColor} />
            <circle cx={x - 1.5} cy={71.5} r={1.6} fill="#fff" />
          </>
        )
    }
    const xo = x + s * 5
    const lashes =
      a.lashes === 'courts' ? (
        <path d={`M${xo} 70 L${xo + s * 4} 67`} stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      ) : a.lashes === 'longs' ? (
        <path
          d={`M${x + s * 1} 67 L${x + s * 2} 62.5 M${xo} 69 L${xo + s * 4.5} 65.5 M${x + s * 6.5} 72 L${x + s * 11} 70`}
          stroke={INK}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : null
    const brow =
      a.eyes !== 'determine' ? (
        <path d={`M${x - 6} 63 Q${x} 59.5 ${x + 6} 63`} stroke={shade(a.hairColor, -0.2)} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      ) : null
    return (
      <g key={x}>
        {brow}
        {eye}
        {lashes}
      </g>
    )
  })

  const nose = {
    point: <circle cx={100} cy={83} r={1.6} fill={skinDark} />,
    petit: <path d="M98 80 Q101 84 102.5 82.5" stroke={skinDark} strokeWidth={2} fill="none" strokeLinecap="round" />,
    rond: <ellipse cx={100} cy={83} rx={3.6} ry={2.6} fill={skinDark} />,
    aucun: null,
  }[a.nose]

  const lip = '#7a2b2b'
  const mouth = {
    sourire: <path d="M92 90 Q100 97 108 90" stroke={lip} strokeWidth={2.4} fill="none" strokeLinecap="round" />,
    grand: (
      <>
        <path d="M90 89 H110 Q108 101 100 101 Q92 101 90 89Z" fill={lip} />
        <rect x={93} y={89} width={14} height={3} rx={1.2} fill="#fff" />
        <ellipse cx={100} cy={98} rx={4.5} ry={2.4} fill="#ff7f9c" />
      </>
    ),
    neutre: <path d="M94 92 H106" stroke={lip} strokeWidth={2.4} strokeLinecap="round" />,
    o: <ellipse cx={100} cy={93} rx={3.6} ry={4.6} fill={lip} />,
    langue: (
      <>
        <path d="M98 92 Q100 100 104 92Z" fill="#ff7f9c" />
        <path d="M92 90 Q100 96 108 90" stroke={lip} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </>
    ),
    chat: <path d="M92 90 Q96 95 100 91 Q104 95 108 90" stroke={lip} strokeWidth={2.2} fill="none" strokeLinecap="round" />,
  }[a.mouth]

  return (
    <>
      {eyes}
      {nose}
      {mouth}
    </>
  )
}

const COURT = 'M63 72 C60 42 78 31 100 31 C122 31 140 42 137 72 C132 60 126 54 118 52 C112 60 98 62 90 56 C84 62 72 66 63 72Z'

function hairFront(a: Avatar) {
  const c = a.hairColor
  switch (a.hair) {
    case 'piquant':
      return <path d="M63 74 L58 52 L72 52 L68 34 L86 42 L92 24 L104 38 L116 26 L119 43 L135 37 L132 53 L144 54 L137 74 C130 58 118 52 104 55 C88 52 72 60 63 74Z" fill={c} />
    case 'long':
    case 'couettes':
      return <path d="M63 82 C58 44 78 30 100 30 C124 30 142 44 137 82 C134 64 128 56 120 52 C108 62 88 64 74 58 C68 64 65 72 63 82Z" fill={c} />
    case 'boucle':
      return (
        <g fill={c}>
          <path d={COURT} />
          {[200, 222, 244, 266, 288, 310, 332].map((deg) => {
            const r = (deg * Math.PI) / 180
            return <circle key={deg} cx={100 + 35 * Math.cos(r)} cy={68 + 35 * Math.sin(r)} r={11} />
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

function hairBack(a: Avatar) {
  const c = a.hairColor
  switch (a.hair) {
    case 'long':
      return <path d="M64 60 C64 30 136 30 136 60 L143 142 Q100 152 57 142Z" fill={shade(c, -0.12)} />
    case 'queue':
      return <path d="M124 42 C152 36 162 70 152 102 C148 114 140 118 138 112 C146 92 142 66 122 56Z" fill={shade(c, -0.08)} />
    case 'couettes':
      return (
        <g fill={shade(c, -0.08)}>
          <ellipse cx={56} cy={92} rx={12} ry={24} transform="rotate(15 56 92)" />
          <ellipse cx={144} cy={92} rx={12} ry={24} transform="rotate(-15 144 92)" />
          <circle cx={63} cy={68} r={4} fill="#ff5c8a" />
          <circle cx={137} cy={68} r={4} fill="#ff5c8a" />
        </g>
      )
    case 'chignon':
      return a.hat === 'aucun' ? <circle cx={100} cy={30} r={15} fill={shade(c, -0.08)} /> : null
    default:
      return null
  }
}

function hat(a: Avatar) {
  const c = a.hatColor
  const dark = shade(c, -0.22)
  switch (a.hat) {
    case 'casquette':
      return (
        <>
          <path d="M62 56 C62 30 80 22 100 22 C120 22 138 30 138 56Z" fill={c} />
          <path d="M100 24 V55" stroke={dark} strokeWidth={1.5} opacity={0.5} />
          <circle cx={100} cy={23} r={3} fill={dark} />
          <path d="M57 52 Q100 60 143 52 Q149 55 144 58 Q100 68 56 58 Q51 55 57 52Z" fill={dark} />
        </>
      )
    case 'envers':
      return (
        <>
          <path d="M62 57 C62 30 80 22 100 22 C120 22 138 30 138 57Z" fill={c} />
          <path d="M60 56 Q100 50 140 56 L140 59 Q100 53 60 59Z" fill={dark} />
          <path d="M89 56 Q100 45 111 56" stroke={dark} strokeWidth={3} fill={shade(c, 0.3)} />
          <circle cx={100} cy={23} r={3} fill={dark} />
        </>
      )
    case 'bonnet':
      return (
        <>
          <circle cx={100} cy={16} r={9} fill={shade(c, 0.45)} />
          <path d="M62 58 C60 26 80 18 100 18 C120 18 140 26 138 58Z" fill={c} />
          <rect x={59} y={46} width={82} height={13} rx={6.5} fill={dark} />
          {[70, 82, 94, 106, 118, 130].map((x) => (
            <path key={x} d={`M${x} 48 V57`} stroke={shade(c, -0.4)} strokeWidth={1.4} opacity={0.5} />
          ))}
        </>
      )
    default:
      return null
  }
}
