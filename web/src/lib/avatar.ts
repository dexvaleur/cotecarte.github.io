/**
 * Avatar du dresseur : tous les réglages du personnage, les choix possibles,
 * les palettes de couleurs et deux styles de départ (garçon, fille).
 */

export interface Avatar {
  gender: 'boy' | 'girl'
  height: number // 0 = petit, 1 = grand
  build: number // 0 = fin, 1 = costaud
  skin: string
  hair: HairStyle
  hairColor: string
  hat: HatStyle
  hatColor: string
  eyes: EyeStyle
  eyeColor: string
  lashes: LashStyle
  nose: NoseStyle
  mouth: MouthStyle
  top: TopStyle
  topColor: string
  bottom: BottomStyle
  bottomColor: string
  shoes: ShoeStyle
  shoesColor: string
  gloves: GloveStyle
  glovesColor: string
  accentColor: string // couleur des détails : bandes, liserés, empiècements
  accessory: AccessoryStyle
  accessoryColor: string
}

export const HAIR = { court: 'Court', piquant: 'Piquant', long: 'Long', queue: 'Queue de cheval', couettes: 'Couettes', chignon: 'Chignon', boucle: 'Bouclé', rase: 'Rasé', chauve: 'Sans cheveux' } as const
export const HATS = { aucun: 'Aucun', casquette: 'Casquette', envers: 'Casquette à l’envers', bonnet: 'Bonnet' } as const
export const EYES = { rond: 'Ronds', grand: 'Grands', joyeux: 'Joyeux', determine: 'Déterminés', endormi: 'Endormis' } as const
export const LASHES = { aucun: 'Aucun', courts: 'Courts', longs: 'Longs' } as const
export const NOSES = { point: 'Petit point', petit: 'Petit', rond: 'Rond', aucun: 'Aucun' } as const
export const MOUTHS = { sourire: 'Sourire', grand: 'Grand sourire', neutre: 'Neutre', o: 'Étonné', langue: 'Langue', chat: 'Malicieux' } as const
export const TOPS = { tshirt: 'T-shirt', debardeur: 'Débardeur', pull: 'Pull', sweat: 'Sweat à capuche', veste: 'Veste' } as const
export const BOTTOMS = { pantalon: 'Pantalon', short: 'Short', jupe: 'Jupe' } as const
export const SHOES = { baskets: 'Baskets', bottes: 'Bottes' } as const
export const GLOVES = { aucun: 'Aucun', gants: 'Gants', mitaines: 'Mitaines' } as const
export const ACCESSORIES = { aucun: 'Aucun', sac: 'Sac à dos', ceinture: 'Ceinture', bandouliere: 'Bandoulière', bandeau: 'Bandeau' } as const

export type HairStyle = keyof typeof HAIR
export type HatStyle = keyof typeof HATS
export type EyeStyle = keyof typeof EYES
export type LashStyle = keyof typeof LASHES
export type NoseStyle = keyof typeof NOSES
export type MouthStyle = keyof typeof MOUTHS
export type TopStyle = keyof typeof TOPS
export type BottomStyle = keyof typeof BOTTOMS
export type ShoeStyle = keyof typeof SHOES
export type GloveStyle = keyof typeof GLOVES
export type AccessoryStyle = keyof typeof ACCESSORIES

export const SKIN_COLORS = ['#fde3cf', '#f6d0b1', '#f1c27d', '#e0ac69', '#c68642', '#a86b3c', '#8d5524', '#6b3e1f', '#4a2a14', '#2d1a0e', '#9ad0ff', '#b6f2a8', '#d8b4ff', '#ffb3c6']
export const HAIR_COLORS = ['#1b1b22', '#3b2416', '#6b4226', '#a0672f', '#e6c35c', '#f3e6b0', '#c4502a', '#d42f43', '#d9d9e0', '#2f6fde', '#3aa84a', '#ff7eb6', '#8b5cf6']
export const EYE_COLORS = ['#2b2b3a', '#5a3a1e', '#8a6a2b', '#2f8ff0', '#3aa84a', '#7d8a99', '#d42f43', '#8b5cf6']
export const CLOTH_COLORS = ['#e3343f', '#ff8a3d', '#ffd23f', '#3bb35a', '#1f8a70', '#2f8ff0', '#2f4fbf', '#2b3557', '#8b5cf6', '#d14ea8', '#ffffff', '#c9ccd8', '#4a4a55', '#1b1b22', '#8d5524', '#e8d6b0']

export const BOY: Avatar = {
  gender: 'boy',
  height: 0.5,
  build: 0.5,
  skin: '#f1c27d',
  hair: 'piquant',
  hairColor: '#1b1b22',
  hat: 'aucun',
  hatColor: '#e3343f',
  eyes: 'rond',
  eyeColor: '#5a3a1e',
  lashes: 'aucun',
  nose: 'petit',
  mouth: 'sourire',
  top: 'sweat',
  topColor: '#e3343f',
  bottom: 'pantalon',
  bottomColor: '#1f2433',
  shoes: 'baskets',
  shoesColor: '#2b2f3a',
  gloves: 'mitaines',
  glovesColor: '#1b1b22',
  accentColor: '#ffffff',
  accessory: 'aucun',
  accessoryColor: '#3bb35a',
}

export const GIRL: Avatar = {
  ...BOY,
  gender: 'girl',
  height: 0.4,
  build: 0.35,
  hair: 'queue',
  hairColor: '#3b2416',
  hat: 'aucun',
  hatColor: '#ffffff',
  eyes: 'rond',
  eyeColor: '#5a3a1e',
  lashes: 'courts',
  top: 'debardeur',
  topColor: '#5b6470',
  bottom: 'pantalon',
  bottomColor: '#6b5a48',
  shoes: 'bottes',
  shoesColor: '#3b2a20',
  gloves: 'aucun',
  accessory: 'ceinture',
  accessoryColor: '#5a3a22',
}

/** Change le genre : on reprend la coiffure et les cils du style de départ, le reste est gardé. */
export function withGender(a: Avatar, gender: Avatar['gender']): Avatar {
  const base = gender === 'boy' ? BOY : GIRL
  return { ...a, gender, hair: base.hair, lashes: base.lashes }
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]

/** Un dresseur au hasard. */
export function randomAvatar(): Avatar {
  return {
    gender: pick(['boy', 'girl'] as const),
    height: Math.round(Math.random() * 10) / 10,
    build: Math.round(Math.random() * 10) / 10,
    skin: pick(SKIN_COLORS.slice(0, 10)),
    hair: pick(Object.keys(HAIR) as HairStyle[]),
    hairColor: pick(HAIR_COLORS),
    hat: pick(Object.keys(HATS) as HatStyle[]),
    hatColor: pick(CLOTH_COLORS),
    eyes: pick(Object.keys(EYES) as EyeStyle[]),
    eyeColor: pick(EYE_COLORS),
    lashes: pick(Object.keys(LASHES) as LashStyle[]),
    nose: pick(Object.keys(NOSES) as NoseStyle[]),
    mouth: pick(Object.keys(MOUTHS) as MouthStyle[]),
    top: pick(Object.keys(TOPS) as TopStyle[]),
    topColor: pick(CLOTH_COLORS),
    bottom: pick(Object.keys(BOTTOMS) as BottomStyle[]),
    bottomColor: pick(CLOTH_COLORS),
    shoes: pick(Object.keys(SHOES) as ShoeStyle[]),
    shoesColor: pick(CLOTH_COLORS),
    gloves: pick(Object.keys(GLOVES) as GloveStyle[]),
    glovesColor: pick(CLOTH_COLORS),
    accentColor: pick(CLOTH_COLORS),
    accessory: pick(Object.keys(ACCESSORIES) as AccessoryStyle[]),
    accessoryColor: pick(CLOTH_COLORS),
  }
}

/** Complète un avatar venu du stockage ou du serveur (anciennes versions, valeurs inconnues). */
export function normalizeAvatar(raw: unknown): Avatar {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const base = a.gender === 'girl' ? GIRL : BOY
  const out = { ...base } as Record<string, unknown>
  const lists: Record<string, object> = { hair: HAIR, hat: HATS, eyes: EYES, lashes: LASHES, nose: NOSES, mouth: MOUTHS, top: TOPS, bottom: BOTTOMS, shoes: SHOES, gloves: GLOVES, accessory: ACCESSORIES }
  for (const k of Object.keys(base)) {
    const v = a[k]
    if (k === 'gender') continue
    if (k === 'height' || k === 'build') {
      if (typeof v === 'number' && v >= 0 && v <= 1) out[k] = v
    } else if (k in lists) {
      if (typeof v === 'string' && v in lists[k]) out[k] = v
    } else if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) out[k] = v
  }
  return out as unknown as Avatar
}

/** Assombrit (amt < 0) ou éclaircit (amt > 0) une couleur « #rrggbb ». */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}

/** Mélange deux couleurs « #rrggbb » (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16)
  const y = parseInt(b.slice(1), 16)
  const c = (sh: number) => Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t)
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)
}
