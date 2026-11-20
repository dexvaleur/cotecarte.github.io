import { useSyncExternalStore } from 'react'
import { load, save } from './storage'

/**
 * Le guide de Dexy, la mascotte : l'écran devient foncé, sauf le bouton expliqué.
 * Chaque élément expliqué porte un attribut data-tour="…" dans le code des écrans.
 */

export type Mood = 'hello' | 'point' | 'think' | 'happy'
export type Section = 'scanner' | 'collection' | 'packs' | 'vendre' | 'profil' | 'carte'

export interface Step {
  /** Écran à ouvrir avant d'afficher l'étape. */
  route?: string
  /** Valeur de data-tour de l'élément à mettre en lumière. Sans cible : bulle au centre. */
  target?: string
  title: string
  text: string
  /** Texte affiché si l'élément n'est pas à l'écran (ex. collection encore vide). */
  alt?: string
  mood?: Mood
}

const SECTIONS: Record<Section, { route?: string; steps: Step[] }> = {
  scanner: {
    route: '/scanner',
    steps: [
      {
        target: 'scan-button',
        title: 'Le bouton Scanner',
        text: 'Touche ici pour ouvrir la caméra. Pose ta carte bien à plat, entière dans le cadre : je la reconnais toute seule et je te donne son nom, sa rareté et son prix.',
        mood: 'point',
      },
      {
        target: 'scan-lang',
        title: 'La langue de tes cartes',
        text: 'Français, anglais, japonais… Choisis la langue écrite sur tes cartes. En « Automatique », je devine toute seule.',
      },
      {
        target: 'scan-other',
        title: 'Pas de caméra sous la main ?',
        text: '« Galerie » : choisis une photo déjà prise. « Rechercher » : tape le nom de la carte pour la trouver.',
      },
      {
        target: 'scan-tips',
        title: 'Les règles d’un scan réussi',
        text: 'Pas de reflet, carte sortie de sa protection, bonne lumière et numéro bien net en bas. Si un reflet gêne, la caméra te prévient en orange.',
        mood: 'think',
      },
      {
        target: 'header-glossary',
        title: 'Le glossaire',
        text: 'Holo, Reverse, Full Art… Un mot que tu ne connais pas ? Toutes les définitions sont ici.',
      },
      {
        target: 'header-help',
        title: 'Besoin d’aide ?',
        text: 'Touche ce point d’interrogation sur n’importe quel écran : je reviens t’expliquer l’écran où tu es.',
        mood: 'happy',
      },
      {
        target: 'header-settings',
        title: 'Les réglages',
        text: 'Mode sombre, revoir ce guide en entier, mentions légales : tout est là.',
      },
    ],
  },
  collection: {
    route: '/collection',
    steps: [
      {
        target: 'tab-collection',
        title: 'L’onglet Collection',
        text: 'Chaque carte que tu ajoutes après un scan arrive ici.',
        mood: 'point',
      },
      {
        target: 'col-value',
        title: 'La valeur de ta collection',
        text: 'Le total de ce que valent tes cartes au prix du marché, avec une courbe pour voir si ça monte ou si ça baisse.',
        alt: 'Ta collection est encore vide. Dès que tu ajoutes des cartes, tu verras ici leur valeur totale et une courbe qui montre si ça monte ou si ça baisse.',
      },
      {
        target: 'col-tabs',
        title: '4 façons de ranger',
        text: 'Cartes : toutes tes cartes. Extensions : ta progression série par série. Classeurs : range-les comme dans un vrai classeur. Wishlist : les cartes que tu rêves d’avoir.',
      },
      {
        target: 'col-account',
        title: 'Sauvegarde ta collection',
        text: 'Crée un compte gratuit avec ton e-mail : ta collection est sauvegardée et tu la retrouves sur ton téléphone, ta tablette ou ton ordi.',
        alt: 'Pense à créer un compte gratuit (avec ton e-mail) dans l’onglet Collection : ta collection est sauvegardée et tu la retrouves sur tous tes appareils.',
        mood: 'think',
      },
    ],
  },
  packs: {
    route: '/packs',
    steps: [
      {
        target: 'tab-packs',
        title: 'L’onglet Packs',
        text: 'Ici, je t’aide à choisir quoi acheter et je te montre les nouveautés.',
        mood: 'point',
      },
      {
        target: 'packs-products',
        title: 'Booster, coffret, display…',
        text: 'Touche cette case pour savoir ce que contient chaque produit et combien il coûte en général.',
      },
      {
        target: 'packs-goal',
        title: 'Ton objectif',
        text: 'Le plaisir d’ouvrir, une carte précise ou compléter une extension ? Choisis, et je te dis quoi acheter.',
      },
      {
        target: 'packs-where',
        title: 'Où acheter ?',
        text: 'Boutiques, grands magasins, cartes à l’unité ou entre particuliers : les avantages et les pièges de chaque endroit.',
      },
      {
        target: 'packs-sets',
        title: 'Extensions récentes',
        text: 'Les dernières séries sorties, avec mon avis : beaucoup ou peu de grosses cartes à trouver.',
      },
      {
        target: 'packs-movers',
        title: 'Prix de la semaine',
        text: 'Les cartes qui ont le plus monté ou baissé cette semaine. « Tu l’as » s’affiche si elle est dans ta collection.',
        alt: 'Tout en bas de cet onglet : les prix de la semaine (les cartes qui montent et qui baissent), les derniers articles et les sites à suivre.',
      },
      {
        target: 'packs-news',
        title: 'Articles et sources',
        text: 'Les dernières actus sur les cartes, et les sites sérieux pour suivre les sorties.',
      },
    ],
  },
  vendre: {
    route: '/vendre',
    steps: [
      {
        target: 'tab-vendre',
        title: 'L’onglet Vendre',
        text: 'Le coin des membres pour vendre et échanger leurs cartes. Un point rouge ici = un nouveau message pour toi.',
        mood: 'point',
      },
      {
        target: 'sell-tabs',
        title: 'Annonces, Mes annonces, Messages',
        text: 'Annonces : celles de tout le monde. Mes annonces : les tiennes (en ligne ou vendues). Messages : tes discussions avec les autres membres.',
      },
      {
        target: 'sell-search',
        title: 'Chercher une carte',
        text: 'Tape un nom ou un #hashtag, ou touche une étiquette pour filtrer les annonces.',
      },
      {
        target: 'sell-new',
        title: 'Vendre une carte',
        text: 'Ajoute 1 à 5 photos, un prix, des #hashtags et une petite description. Les membres intéressés t’écrivent directement dans le chat.',
        mood: 'happy',
      },
      {
        title: 'Reste prudent',
        text: 'Ne donne jamais ton code de connexion ni tes coordonnées bancaires dans le chat. Préfère la remise en main propre dans un lieu public, ou un envoi suivi.',
        mood: 'think',
      },
    ],
  },
  profil: {
    route: '/profil',
    steps: [
      {
        target: 'tab-profil',
        title: 'L’onglet Profil',
        text: 'Ton coin à toi : ton personnage et tes chiffres.',
        mood: 'point',
      },
      {
        target: 'profile-avatar',
        title: 'Ton avatar',
        text: 'Touche « Mon avatar » pour créer ton personnage de dresseur : coiffure, tenue, couleurs…',
      },
      {
        target: 'profile-pseudo',
        title: 'Ton pseudo',
        text: 'Le crayon sert à le changer. Les autres membres le voient sur tes annonces et dans le chat.',
      },
      {
        target: 'profile-stats',
        title: 'Mes chiffres',
        text: 'Nombre de cartes, valeur totale, extensions, classeurs, wishlist : ta collection en un coup d’œil.',
      },
    ],
  },
  carte: {
    steps: [
      {
        target: 'card-price',
        title: 'Le prix du marché',
        text: 'Ce que vaut cette carte en très bon état (Near Mint), d’après les ventes sur Cardmarket. La flèche montre si le prix monte ou baisse.',
        mood: 'point',
      },
      {
        target: 'card-rarity',
        title: 'La rareté',
        text: 'De 1 à 5 barres : plus il y en a, plus la carte est difficile à trouver dans un booster.',
      },
      {
        target: 'card-prices',
        title: 'Le détail des prix',
        text: 'La courbe du prix jour après jour, et les prix moyens en Europe (Cardmarket) et aux États-Unis (TCGplayer).',
      },
      {
        target: 'card-condition',
        title: 'L’état de ta carte',
        text: 'Une carte abîmée vaut moins cher. Réponds à 4 questions (coins, bords, rayures…) et je t’estime le prix de la tienne.',
        mood: 'think',
      },
      {
        target: 'card-actions',
        title: 'Ajouter, aimer, vendre',
        text: '« Ajouter à ma collection » la range chez toi. Le cœur la met dans ta wishlist. L’étiquette crée une annonce pour la vendre.',
        mood: 'happy',
      },
    ],
  },
}

const ORDER: Section[] = ['scanner', 'collection', 'packs', 'vendre', 'profil']

const INTRO: Step = {
  route: '/scanner',
  title: 'Salut, moi c’est Dexy !',
  text: 'Je vais te faire visiter DexValeur en 1 minute. Je mets en lumière chaque bouton et je t’explique à quoi il sert. Tu peux passer quand tu veux.',
  mood: 'hello',
}

const OUTRO: Step = {
  route: '/scanner',
  target: 'scan-button',
  title: 'À toi de jouer !',
  text: 'Scanne ta première carte. La première fois que tu ouvriras la fiche d’une carte, je reviendrai t’expliquer ses infos.',
  mood: 'happy',
}

function sectionSteps(s: Section): Step[] {
  const { route, steps } = SECTIONS[s]
  return steps.map((st) => ({ route, ...st }))
}

/** Toutes les étapes de la visite complète (premier lancement, ou « Revoir le guide »). */
export function fullTour(): Step[] {
  return [INTRO, ...ORDER.flatMap(sectionSteps), OUTRO]
}

/** L'écran correspondant à une adresse, pour le bouton « ? ». */
export function sectionFor(pathname: string): Section | null {
  if (pathname.startsWith('/carte/')) return 'carte'
  const s = pathname.split('/')[1]
  if (s === 'vendre') return pathname === '/vendre' ? 'vendre' : null
  return (ORDER as string[]).includes(s) ? (s as Section) : null
}

// ---- État partagé du guide ------------------------------------------------------

export interface TourState {
  steps: Step[]
  index: number
  /** Clé mémorisée quand le guide se termine (pour ne pas le remontrer). */
  key: string
}

let state: TourState | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function useTour(): TourState | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function startTour(what: 'all' | Section) {
  state = what === 'all' ? { steps: fullTour(), index: 0, key: 'all' } : { steps: sectionSteps(what), index: 0, key: what }
  emit()
}

export function goToStep(index: number) {
  if (!state) return
  if (index >= state.steps.length) return endTour()
  state = { ...state, index: Math.max(0, index) }
  emit()
}

export function endTour() {
  if (!state) return
  markSeen(state.key)
  // La visite complète montre déjà les onglets : on ne les remontre pas un par un.
  if (state.key === 'all') ORDER.forEach(markSeen)
  state = null
  emit()
}

export function tourSeen(key: string): boolean {
  return load<string[]>('tourSeen', []).includes(key)
}

function markSeen(key: string) {
  const seen = load<string[]>('tourSeen', [])
  if (!seen.includes(key)) save('tourSeen', [...seen, key])
}

/** Lance la fiche-carte expliquée une seule fois, si aucun autre guide n'est ouvert. */
export function maybeStartCardTour() {
  if (state || tourSeen('carte')) return
  startTour('carte')
}
