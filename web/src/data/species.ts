// Noms des 1025 Pokémon en français et en anglais (paquet « pokemon », licence MIT).
// Sert à corriger les noms mal lus par l'OCR (« EFlonizanre » → « Florizarre »).
import en from 'pokemon/data/en.json'
import fr from 'pokemon/data/fr.json'

export const SPECIES: string[] = [...new Set([...fr, ...en])]
