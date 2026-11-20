import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { AppShell } from "./components/AppShell";
import { CardScreen } from "./screens/CardScreen";
import { BinderScreen, NewBinderScreen } from "./screens/Binders";
import { SearchScreen } from "./screens/SearchScreen";
import { SetScreen } from "./screens/SetScreen";
import { load, save } from "./lib/storage";
import { sectionFor, startTour, tourSeen } from "./lib/tour";
import { Onboarding } from "./screens/Onboarding";
import { CollectionScreen } from "./screens/CollectionScreen";
import { GlossaryScreen } from "./screens/GlossaryScreen";
import { LegalScreen } from "./screens/LegalScreen";
import { PacksScreen } from "./screens/PacksScreen";
import { AvatarEditorScreen, ProfileScreen } from "./screens/ProfileScreen";
import { ScannerScreen } from "./screens/ScannerScreen";
import { SellScreen } from "./screens/SellScreen";
import { ListingScreen } from "./screens/ListingScreen";
import { ListingFormScreen } from "./screens/ListingFormScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StatsScreen } from "./screens/StatsScreen";

export default function App() {
  // Au premier lancement : 3 écrans d'explication + choix du compte, puis Dexy fait visiter l'appli.
  const [onboarded, setOnboarded] = useState(() => load("onboarded", false));
  // Pas de visite si on arrive par un lien vers une annonce ou une carte : on laisse la personne la voir.
  const { pathname } = useLocation();
  useEffect(() => {
    if (!onboarded) return;
    const s = sectionFor(pathname);
    if (!tourSeen("all") && (pathname === "/" || (s && s !== "carte"))) {
      const t = setTimeout(() => startTour("all"), 400);
      return () => clearTimeout(t);
    }
    // Uniquement à l'ouverture de l'appli (ou juste après l'onboarding).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarded]);

  if (!onboarded) {
    return (
      <Onboarding
        onDone={() => {
          save("onboarded", true);
          setOnboarded(true);
        }}
      />
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/scanner" replace />} />
        <Route path="scanner" element={<ScannerScreen />} />
        <Route path="collection" element={<CollectionScreen />} />
        <Route path="packs" element={<PacksScreen />} />
        <Route path="actus" element={<Navigate to="/packs" replace />} />
        <Route path="vendre" element={<SellScreen />} />
        <Route path="vendre/nouvelle" element={<ListingFormScreen />} />
        <Route path="vendre/annonce/:id" element={<ListingScreen />} />
        <Route
          path="vendre/annonce/:id/modifier"
          element={<ListingFormScreen />}
        />
        <Route path="vendre/chat/:id" element={<ChatScreen />} />
        <Route
          path="reglages"
          element={
            <SettingsScreen onReplayOnboarding={() => startTour("all")} />
          }
        />
        <Route path="profil" element={<ProfileScreen />} />
        <Route path="profil/avatar" element={<AvatarEditorScreen />} />
        <Route path="glossaire" element={<GlossaryScreen />} />
        <Route path="stats" element={<StatsScreen />} />
        <Route path="classeurs/nouveau" element={<NewBinderScreen />} />
        <Route path="classeurs/:id" element={<BinderScreen />} />
        <Route path="legal/:page?" element={<LegalScreen />} />
        <Route path="recherche" element={<SearchScreen />} />
        <Route path="carte/:id" element={<CardScreen />} />
        <Route path="collection/extension/:setId" element={<SetScreen />} />
        <Route path="*" element={<Navigate to="/scanner" replace />} />
      </Route>
    </Routes>
  );
}
