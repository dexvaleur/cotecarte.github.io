import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Cloud,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { AccountPanel } from "../components/AccountPanel";
import { Mascot } from "../components/Mascot";
import { API_URL, useSession } from "../lib/api";
import { GLOSSARY } from "../data/glossary";

// Les 5 mots les plus utiles pour débuter, montrés sur le 3ᵉ écran.
const STARTER_TERMS = [
  "Holo",
  "Reverse (Reverse Holo)",
  "Full Art",
  "Secret Rare",
  "Near Mint (NM)",
];

/**
 * Onboarding montré au premier lancement : 3 écrans d'explication,
 * puis le choix « Créer mon compte » ou « Continuer en invité » (s'il y a un serveur).
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const pages = API_URL ? 4 : 3;
  const account = step === 3;
  const last = step === pages - 1;

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-xl flex-col px-5">
      <div className="flex h-14 items-center justify-end">
        {step < 3 && (
          <button
            onClick={() => (API_URL ? setStep(3) : onDone())}
            className="rounded-full px-3 py-2 font-semibold text-muted hover:bg-surface-2"
          >
            Passer
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center">
        {step === 0 && <Welcome />}
        {step === 1 && <HowToScan />}
        {step === 2 && <MiniGlossary />}
        {account && <AccountChoice onDone={onDone} />}
      </div>

      <div className="py-6">
        <div
          className="mb-5 flex justify-center gap-2"
          aria-label={`Étape ${step + 1} sur ${pages}`}
        >
          {Array.from({ length: pages }, (_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-2 bg-line"}`}
            />
          ))}
        </div>
        {!account && (
          <button
            onClick={() => (last ? onDone() : setStep(step + 1))}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-bold text-primary-ink active:scale-[.98]"
          >
            {last ? "C'est parti !" : "Suivant"} <ArrowRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

function Welcome() {
  return (
    <div className="text-center">
      <img
        src="./favicon.svg"
        alt=""
        className="mx-auto mb-6 h-28 w-28 drop-shadow-xl"
      />
      <h1 className="text-3xl font-extrabold tracking-tight">
        Bienvenue sur DexValeur
      </h1>
      <p className="mt-3 text-lg text-muted">
        Scanne une carte Pokémon et découvre tout de suite ce qu'elle est, sa
        rareté et combien elle vaut.
      </p>
      <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left">
        <li>📷 Scanne tes cartes</li>
        <li>🗂️ Suis la valeur de ta collection</li>
        <li>🎁 Choisis les bons boosters</li>
        <li>💰 Revends au juste prix</li>
      </ul>
    </div>
  );
}

function HowToScan() {
  const tips = [
    {
      Icon: Camera,
      title: "Cadre bien la carte",
      text: "Pose-la à plat et place-la entièrement dans le cadre.",
    },
    {
      Icon: Sun,
      title: "De la lumière, sans reflet",
      text: "Évite le flash sur les cartes brillantes : penche un peu la carte.",
    },
    {
      Icon: Sparkles,
      title: "On lit le bas de la carte",
      text: "Le nom et le numéro (ex. 025/165) servent à la reconnaître.",
    },
  ];
  return (
    <div>
      <h1 className="text-center text-3xl font-extrabold tracking-tight">
        Comment scanner
      </h1>
      <p className="mt-2 text-center text-muted">
        3 réflexes pour un scan réussi du premier coup.
      </p>
      <ul className="mt-6 space-y-3">
        {tips.map(({ Icon, title, text }) => (
          <li
            key={title}
            className="flex gap-4 rounded-3xl border border-line bg-surface p-4"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Icon size={24} />
            </span>
            <span>
              <span className="block font-bold">{title}</span>
              <span className="text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniGlossary() {
  const terms = GLOSSARY.filter((g) => STARTER_TERMS.includes(g.term));
  return (
    <div>
      <h1 className="text-center text-3xl font-extrabold tracking-tight">
        Les mots à connaître
      </h1>
      <p className="mt-2 text-center text-muted">
        Le glossaire complet reste accessible via l'icône 📖 en haut.
      </p>
      <dl className="mt-6 space-y-2">
        {terms.map((t) => (
          <div
            key={t.term}
            className="rounded-2xl border border-line bg-surface px-4 py-3"
          >
            <dt className="font-bold text-primary">{t.term}</dt>
            <dd className="text-sm">{t.short}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Dernier écran : créer un compte (sauvegarde) ou continuer en invité. */
function AccountChoice({ onDone }: { onDone: () => void }) {
  const session = useSession();
  const [creating, setCreating] = useState(false);

  if (session) {
    return (
      <div className="text-center">
        <Mascot mood="happy" className="mx-auto h-32 w-32" />
        <h1 className="mt-2 flex items-center justify-center gap-2 text-2xl font-extrabold tracking-tight">
          <CheckCircle2 className="text-good" size={30} /> C’est bon, tu es connecté !
        </h1>
        <p className="mt-2 text-muted">
          Ta collection sera sauvegardée automatiquement, et tu la retrouveras
          sur tous tes appareils.
        </p>
        <button
          onClick={onDone}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-bold text-primary-ink active:scale-[.98]"
        >
          C’est parti ! <ArrowRight size={20} />
        </button>
      </div>
    );
  }

  if (creating) {
    return (
      <div>
        <h1 className="text-center text-3xl font-extrabold tracking-tight">
          Créer mon compte
        </h1>
        <p className="mt-2 mb-5 text-center text-muted">
          Gratuit, sans mot de passe : on t’envoie un code par e-mail.
        </p>
        <div className="rounded-3xl border border-line bg-surface p-4">
          <AccountPanel />
        </div>
        <button
          onClick={() => setCreating(false)}
          className="mt-4 w-full py-2 font-semibold text-muted"
        >
          ← Retour
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Mascot mood="hello" className="mx-auto h-32 w-32" />
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">On y va ?</h1>
      <p className="mt-2 text-muted">
        Crée ton compte pour ne jamais perdre ta collection, ou découvre l’appli
        tout de suite.
      </p>
      <div className="mt-6 grid gap-3 text-left">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-4 rounded-3xl text-left bg-primary p-4 text-primary-ink active:scale-[.98]"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20">
            <Cloud size={24} />
          </span>
          <span>
            <span className="block text-lg font-bold">Créer mon compte</span>
            <span className="text-sm opacity-90">
              Collection sauvegardée, vente entre membres, sur tous tes
              appareils.
            </span>
          </span>
        </button>
        <button
          onClick={onDone}
          className="flex items-center gap-4 rounded-3xl text-left border border-line bg-surface p-4 active:scale-[.98]"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted">
            <UserRound size={24} />
          </span>
          <span>
            <span className="block text-lg font-bold">Continuer en invité</span>
            <span className="text-sm text-muted">
              Tout reste sur ce téléphone. Tu pourras créer ton compte plus tard
              dans Collection.
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
