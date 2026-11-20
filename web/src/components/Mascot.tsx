import type { Mood } from '../lib/tour'

/**
 * Dexy, la mascotte de DexValeur : une petite carte vivante avec une étoile sur la tête.
 * Dessin original (pas un Pokémon). Son humeur change ses yeux, sa bouche et ses bras.
 */
export function Mascot({ mood = 'hello', className = '' }: { mood?: Mood; className?: string }) {
  const happyEyes = mood === 'happy'
  const lookUp = mood === 'think'
  return (
    <svg viewBox="0 0 120 130" className={className} role="img" aria-label="Dexy, la mascotte">
      <defs>
        <linearGradient id="dexy-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c6cff" />
          <stop offset="1" stopColor="#b24cf5" />
        </linearGradient>
      </defs>

      {/* Ombre */}
      <ellipse cx="60" cy="124" rx="28" ry="4" fill="#000" opacity=".25" />

      {/* Pieds */}
      <ellipse cx="47" cy="117" rx="9" ry="5" fill="#4a3bd6" />
      <ellipse cx="73" cy="117" rx="9" ry="5" fill="#4a3bd6" />

      {/* Bras gauche (pour nous) */}
      {mood === 'hello' ? (
        <g className="origin-[26px_70px] motion-safe:animate-[dexy-wave_1.2s_ease-in-out_infinite]">
          <path d="M28 70 Q12 58 14 40" stroke="#6a5af0" strokeWidth="8" strokeLinecap="round" fill="none" />
          <circle cx="14" cy="38" r="6" fill="#fff" />
        </g>
      ) : (
        <>
          <path d="M28 72 Q16 80 18 92" stroke="#6a5af0" strokeWidth="8" strokeLinecap="round" fill="none" />
          <circle cx="18" cy="94" r="6" fill="#fff" />
        </>
      )}

      {/* Bras droit */}
      {mood === 'point' ? (
        <>
          <path d="M92 70 Q106 60 110 46" stroke="#6a5af0" strokeWidth="8" strokeLinecap="round" fill="none" />
          <circle cx="110" cy="43" r="6" fill="#fff" />
        </>
      ) : mood === 'think' ? (
        <>
          <path d="M92 76 Q86 92 74 90" stroke="#6a5af0" strokeWidth="8" strokeLinecap="round" fill="none" />
          <circle cx="72" cy="89" r="6" fill="#fff" />
        </>
      ) : mood === 'happy' ? (
        <>
          <path d="M92 70 Q108 58 104 40" stroke="#6a5af0" strokeWidth="8" strokeLinecap="round" fill="none" />
          <circle cx="104" cy="38" r="6" fill="#fff" />
        </>
      ) : (
        <>
          <path d="M92 72 Q104 80 102 92" stroke="#6a5af0" strokeWidth="8" strokeLinecap="round" fill="none" />
          <circle cx="102" cy="94" r="6" fill="#fff" />
        </>
      )}

      {/* Antenne et étoile */}
      <path d="M60 22 Q58 14 62 8" stroke="#6a5af0" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path
        d="M62 -2 l3.2 6.6 7.2 1 -5.2 5 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.2 -5 7.2 -1z"
        transform="translate(0 2)"
        fill="#ffc83d"
        stroke="#e0a400"
        strokeWidth="1"
      />

      {/* Corps : une carte arrondie */}
      <rect x="26" y="22" width="68" height="94" rx="14" fill="url(#dexy-body)" />
      <rect x="31" y="27" width="58" height="84" rx="10" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2" />
      {/* Petit reflet */}
      <path d="M36 34 Q40 30 48 30" stroke="#fff" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Yeux */}
      {happyEyes ? (
        <>
          <path d="M40 58 Q46 50 52 58" stroke="#161936" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M68 58 Q74 50 80 58" stroke="#161936" strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <ellipse cx="46" cy="57" rx="8" ry="10" fill="#fff" />
          <ellipse cx="74" cy="57" rx="8" ry="10" fill="#fff" />
          <circle cx={lookUp ? 48 : 47} cy={lookUp ? 53 : 59} r="5" fill="#161936" />
          <circle cx={lookUp ? 76 : 75} cy={lookUp ? 53 : 59} r="5" fill="#161936" />
          <circle cx={lookUp ? 50 : 49} cy={lookUp ? 51 : 57} r="1.8" fill="#fff" />
          <circle cx={lookUp ? 78 : 77} cy={lookUp ? 51 : 57} r="1.8" fill="#fff" />
        </>
      )}

      {/* Joues */}
      <ellipse cx="38" cy="72" rx="5" ry="3.2" fill="#ff8fb1" opacity=".85" />
      <ellipse cx="82" cy="72" rx="5" ry="3.2" fill="#ff8fb1" opacity=".85" />

      {/* Bouche */}
      {mood === 'think' ? (
        <path d="M54 78 Q60 75 66 78" stroke="#161936" strokeWidth="3" strokeLinecap="round" fill="none" />
      ) : mood === 'happy' || mood === 'hello' ? (
        <path d="M50 72 Q60 86 70 72 Z" fill="#161936" stroke="#161936" strokeWidth="2" strokeLinejoin="round" />
      ) : (
        <path d="M52 74 Q60 82 68 74" stroke="#161936" strokeWidth="3" strokeLinecap="round" fill="none" />
      )}

      {/* Petit symbole « € » sur le ventre, clin d'œil à la cote des cartes */}
      <circle cx="60" cy="97" r="8" fill="#fff" fillOpacity=".9" />
      <text x="60" y="101.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#5b4cf5" fontFamily="system-ui, sans-serif">
        €
      </text>
    </svg>
  )
}
