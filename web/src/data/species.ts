// Noms des 1025 Pokémon (paquet « pokemon », licence MIT) : français, anglais, allemand et espagnol.
// (Les cartes italiennes et portugaises utilisent les noms anglais.)
// Sert à corriger les noms mal lus par l'OCR (« EFlonizanre » → « Florizarre »).
import de from 'pokemon/data/de.json'
import en from 'pokemon/data/en.json'
import es from 'pokemon/data/es.json'
import fr from 'pokemon/data/fr.json'

export const SPECIES: string[] = [...new Set([...fr, ...en, ...de, ...es])]

// Les listes sont dans l'ordre du Pokédex : même position = même Pokémon.
const INDEX = new Map<string, number>()
for (const list of [fr, en, de, es]) list.forEach((name, i) => INDEX.has(name) || INDEX.set(name, i))

/** « Glurak » (allemand) → { fr: « Dracaufeu », en: « Charizard » } : pour chercher la carte dans la base. */
export function speciesNames(name: string): { fr: string; en: string } | null {
  const i = INDEX.get(name)
  return i === undefined ? null : { fr: fr[i], en: en[i] }
}
