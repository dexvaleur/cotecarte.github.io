/**
 * Informations légales. L'email de contact est défini au moment de la compilation
 * (variable VITE_CONTACT_EMAIL sur GitHub), pour ne pas l'écrire dans le code.
 */
export const CONTACT_EMAIL: string | undefined = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || undefined

/** Date de la dernière mise à jour des textes légaux. */
export const LEGAL_UPDATED = '2026-11-19'

export const LEGAL_PAGES = [
  { id: 'mentions', label: 'Mentions légales' },
  { id: 'confidentialite', label: 'Confidentialité' },
  { id: 'cgu', label: 'Conditions' },
] as const

export type LegalPageId = (typeof LEGAL_PAGES)[number]['id']
