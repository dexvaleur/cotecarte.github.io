import type { ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { Card, ScreenTitle } from '../components/ui'
import { formatDate } from '../lib/format'
import { CONTACT_EMAIL, LEGAL_PAGES, LEGAL_UPDATED, type LegalPageId } from '../lib/legal'

/** Mentions légales, politique de confidentialité et conditions d'utilisation. */
export function LegalScreen() {
  const { page } = useParams()
  const current = LEGAL_PAGES.find((p) => p.id === page)
  if (!current) return <Navigate to="/legal/mentions" replace />

  return (
    <>
      <ScreenTitle title="Infos légales" subtitle={`Mis à jour le ${formatDate(LEGAL_UPDATED)}`} />
      <nav aria-label="Pages légales" className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
        {LEGAL_PAGES.map((p) => (
          <Link
            key={p.id}
            to={`/legal/${p.id}`}
            replace
            aria-current={p.id === current.id ? 'page' : undefined}
            className={`rounded-xl py-2 text-center text-sm font-semibold ${p.id === current.id ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <Card className="legal space-y-3 text-sm leading-relaxed">{PAGES[current.id]}</Card>
    </>
  )
}

/** Liens vers les pages légales, à mettre en bas des écrans. */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-muted ${className}`}>
      {LEGAL_PAGES.map((p, i) => (
        <span key={p.id}>
          {i > 0 && ' · '}
          <Link to={`/legal/${p.id}`} className="underline">
            {p.label}
          </Link>
        </span>
      ))}
    </p>
  )
}

function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary underline">
      {CONTACT_EMAIL}
    </a>
  ) : (
    <b>l’adresse de contact de l’éditeur (en cours d’ajout)</b>
  )
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-base font-extrabold">{children}</h2>
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
      {children}
    </a>
  )
}

const PAGES: Record<LegalPageId, ReactNode> = {
  mentions: (
    <>
      <H>Éditeur</H>
      <p>
        DexValeur est une application gratuite éditée par un particulier, à titre non professionnel et sans but
        commercial. Conformément à l’article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004 (LCEN), l’éditeur a choisi
        de rester anonyme ; ses coordonnées ont été communiquées à l’hébergeur.
      </p>
      <p>
        Contact : <Contact />
      </p>

      <H>Hébergement</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b>Application</b> : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis —{' '}
          <Ext href="https://github.com">github.com</Ext>
        </li>
        <li>
          <b>Serveur</b> : Render Services, Inc., 525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis —{' '}
          <Ext href="https://render.com">render.com</Ext>
        </li>
        <li>
          <b>Base de données</b> : Neon, Inc. — <Ext href="https://neon.tech">neon.tech</Ext>
        </li>
      </ul>

      <H>Marques et images</H>
      <p>
        DexValeur est une application de fan, <b>non officielle</b>. Elle n’est ni produite, ni approuvée, ni
        sponsorisée par Nintendo, Creatures Inc., GAME FREAK inc. ou The Pokémon Company.
      </p>
      <p>
        Pokémon et les noms des personnages sont des marques de Nintendo, Creatures Inc. et GAME FREAK inc. © Nintendo,
        Creatures, GAME FREAK, The Pokémon Company. Les illustrations des cartes appartiennent à leurs ayants droit et
        ne sont affichées que pour identifier les cartes.
      </p>
      <p>
        Si tu es titulaire de droits et qu’un contenu te pose problème, écris à <Contact /> : il sera retiré rapidement.
      </p>

      <H>Sources des données</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Fiches et images des cartes : <Ext href="https://tcgdex.dev">TCGdex</Ext> et{' '}
          <Ext href="https://pokemontcg.io">Pokémon TCG API</Ext>.
        </li>
        <li>Prix : moyennes publiques Cardmarket, fournies par TCGdex. Ils sont indicatifs.</li>
        <li>
          Articles : flux public de <Ext href="https://www.pokebip.com">Pokébip</Ext> (titre, résumé et lien vers
          l’article original).
        </li>
      </ul>
    </>
  ),

  confidentialite: (
    <>
      <p>
        On collecte le <b>strict minimum</b>. Sans compte, rien ne quitte ton téléphone à part les recherches de cartes.
      </p>

      <H>Responsable du traitement</H>
      <p>
        L’éditeur de DexValeur (voir Mentions légales). Contact : <Contact />
      </p>

      <H>Ce qui reste sur ton téléphone</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b>Les photos du scanner</b> : elles sont analysées directement sur ton téléphone. Elles ne sont jamais
          envoyées sur notre serveur. Les « scans ratés » ne sont partagés que si tu appuies toi-même sur « Partager ».
        </li>
        <li>Ta collection, ta wishlist, tes classeurs, ton profil (pseudo, avatar), tes photos de cartes et tes réglages (thème, etc.).</li>
      </ul>
      <p>
        Ces données sont rangées dans le stockage de l’appli sur ton appareil (pas de cookie publicitaire). Ce stockage
        est nécessaire au fonctionnement de l’appli : aucun consentement n’est demandé pour cela. Tu peux tout effacer
        en supprimant les données du site dans ton navigateur.
      </p>

      <H>Statistiques de visite (sans cookie)</H>
      <p>
        Pour savoir combien de personnes utilisent l’appli, elle envoie à notre serveur un simple signal anonyme quand tu
        l’ouvres ou que tu scannes une carte. Le serveur ne fait qu’additionner des compteurs par jour (nombre de
        visiteurs, d’ouvertures et de scans) : <b>aucune adresse IP, aucun identifiant, aucun cookie</b> n’est
        enregistré pour ces statistiques, et elles ne sont partagées avec personne.
      </p>
      <p>
        Pour ne compter chaque visiteur qu’une fois par jour, l’appli garde seulement sur ton téléphone la date de sa
        dernière visite. Cette mesure d’audience respecte les conditions de la CNIL pour être dispensée de consentement.
        Tu peux quand même la désactiver à tout moment dans <b>Réglages → Statistiques de visite anonymes</b>.
      </p>

      <H>Si tu crées un compte</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b>Ton adresse email</b> : pour t’envoyer le code de connexion. Pas de mot de passe, pas de newsletter, pas de
          pub.
        </li>
        <li>
          <b>Ta collection et ta wishlist</b> (cartes, état, quantité, prix d’achat si tu l’indiques) : pour les
          sauvegarder et les retrouver sur tous tes appareils.
        </li>
        <li>
          <b>Ton profil</b> (pseudo et réglages de ton avatar) : pour le retrouver sur tous tes appareils. Il n’est
          visible par personne d’autre que toi.
        </li>
        <li>
          <b>Données techniques</b> : la date d’acceptation des conditions, des empreintes chiffrées des codes et des
          sessions (jamais les codes eux-mêmes), et les journaux du serveur (adresse IP, date) gardés quelques jours
          pour la sécurité.
        </li>
      </ul>
      <p>
        <b>Pourquoi (base légale)</b> : l’exécution du service que tu demandes en créant ton compte (article 6.1.b du
        RGPD) et la sécurité du service (intérêt légitime, article 6.1.f).
      </p>

      <H>Combien de temps</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>Codes de connexion : effacés au bout de 24 heures.</li>
        <li>Sessions : 180 jours maximum, ou jusqu’à ta déconnexion.</li>
        <li>Compte et collection : jusqu’à ce que tu supprimes ton compte.</li>
      </ul>

      <H>Qui y a accès</H>
      <p>Personne d’autre que l’éditeur. Tes données ne sont jamais vendues. Elles passent par ces prestataires :</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Render (serveur) et Neon (base de données) : stockage.</li>
        <li>Brevo (Sendinblue SAS, France) : envoi de l’email avec ton code.</li>
        <li>GitHub : hébergement de l’appli.</li>
      </ul>
      <p>
        Certains sont situés aux États-Unis. Ces transferts sont encadrés par le cadre de protection des données
        UE–États-Unis (Data Privacy Framework) et/ou les clauses contractuelles types de la Commission européenne.
      </p>
      <p>
        Pour afficher les images et les fiches, ton téléphone contacte aussi directement TCGdex, Pokémon TCG API et
        Pokébip, qui voient alors ton adresse IP (comme pour tout site web). Aucune donnée de compte ne leur est
        transmise.
      </p>

      <H>Âge minimum</H>
      <p>
        Il faut avoir <b>15 ans ou plus</b> pour créer un compte (article 45 de la loi Informatique et Libertés). Avant
        15 ans, tu peux utiliser l’appli sans compte, ou demander à un parent de créer le compte.
      </p>

      <H>Tes droits</H>
      <p>
        Tu peux accéder à tes données, les corriger, les supprimer, les récupérer ou t’opposer à leur traitement. Le
        plus simple, directement dans <b>Réglages → Compte</b> :
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>« Télécharger mes données » : un fichier avec tout ce qui est enregistré.</li>
        <li>« Supprimer mon compte » : tout est effacé du serveur, immédiatement et définitivement.</li>
      </ul>
      <p>
        Pour toute autre demande : <Contact />. Réponse sous un mois maximum. Si tu n’es pas satisfait, tu peux saisir
        la CNIL : <Ext href="https://www.cnil.fr/fr/plaintes">cnil.fr</Ext>.
      </p>

      <H>Sécurité</H>
      <p>
        Connexions chiffrées (HTTPS), codes à usage unique valables 15 minutes, nombre d’essais limité, et seules des
        empreintes chiffrées des codes et des sessions sont gardées.
      </p>
    </>
  ),

  cgu: (
    <>
      <H>1. Le service</H>
      <p>
        DexValeur aide à identifier ses cartes Pokémon, suivre sa collection et connaître leur valeur estimée. Il est
        gratuit, sans publicité, et utilisable sans compte. Utiliser l’appli vaut acceptation de ces conditions.
      </p>

      <H>2. Le compte</H>
      <p>
        Le compte est réservé aux personnes de <b>15 ans ou plus</b>. Tu es responsable de l’accès à ton adresse email.
        Tu peux supprimer ton compte à tout moment dans Réglages.
      </p>

      <H>3. Prix et informations</H>
      <p>
        Les prix affichés sont des <b>estimations</b> calculées à partir de moyennes publiques (Cardmarket). Ils
        changent tout le temps et peuvent être faux. La reconnaissance par le scanner peut aussi se tromper. Vérifie
        toujours avant d’acheter, de vendre ou d’échanger une carte : DexValeur ne peut pas être tenu responsable d’une
        décision prise à partir de ces informations.
      </p>

      <H>4. Bonne utilisation</H>
      <p>
        Pas d’utilisation automatisée massive, pas de tentative d’accéder aux comptes des autres ou de perturber le
        service. En cas d’abus, l’accès peut être bloqué.
      </p>

      <H>5. Disponibilité</H>
      <p>
        Le service est fourni « tel quel », par un particulier, sans garantie de disponibilité. Il peut être
        interrompu, modifié ou arrêté. En cas d’arrêt définitif, les utilisateurs pourront récupérer leurs données
        (« Télécharger mes données ») avant la fermeture.
      </p>

      <H>6. Propriété</H>
      <p>
        Les marques et images Pokémon appartiennent à leurs propriétaires (voir Mentions légales). Les photos que tu
        ajoutes restent à toi et sont gardées sur ton téléphone.
      </p>

      <H>7. Changements et droit applicable</H>
      <p>
        Ces conditions peuvent évoluer : la date de mise à jour est indiquée en haut. Elles sont soumises au droit
        français. Contact : <Contact />
      </p>
    </>
  ),
}
