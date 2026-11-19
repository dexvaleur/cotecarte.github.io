/**
 * Identifiants des cartes asiatiques : ces cartes ont leurs propres extensions et numéros,
 * et leurs identifiants TCGdex peuvent se répéter d'une langue à l'autre (« SV6 » existe en
 * japonais et en coréen). On les préfixe donc par la langue : « ja:SV2a-006 ».
 * Les cartes françaises, anglaises, allemandes… gardent l'identifiant international (« sv03.5-006 »).
 */
export const ASIAN_LANGS = ['ja', 'ko', 'zh-tw', 'zh-cn', 'th', 'id'] as const
export type AsianLang = (typeof ASIAN_LANGS)[number]

export function splitCardId(id: string): { lang: AsianLang | null; raw: string } {
  const i = id.indexOf(':')
  if (i > 0) {
    const lang = id.slice(0, i) as AsianLang
    if (ASIAN_LANGS.includes(lang)) return { lang, raw: id.slice(i + 1) }
  }
  return { lang: null, raw: id }
}

/** « ja:SV2a-006 » pour une carte asiatique, l'identifiant tel quel sinon. */
export function withLang(lang: string, raw: string): string {
  return (ASIAN_LANGS as readonly string[]).includes(lang) ? `${lang}:${raw}` : raw
}

/** Nom des langues, pour l'affichage. */
export const LANG_NAMES: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  ja: 'japonais',
  ko: 'coréen',
  'zh-tw': 'chinois traditionnel',
  'zh-cn': 'chinois simplifié',
  th: 'thaï',
  id: 'indonésien',
}
