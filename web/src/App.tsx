import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { CardScreen } from './screens/CardScreen'
import { SearchScreen } from './screens/SearchScreen'
import { SetScreen } from './screens/SetScreen'
import { load, save } from './lib/storage'
import { CollectionScreen } from './screens/CollectionScreen'
import { GlossaryScreen } from './screens/GlossaryScreen'
import { NewsScreen } from './screens/NewsScreen'
import { Onboarding } from './screens/Onboarding'
import { PacksScreen } from './screens/PacksScreen'
import { ScannerScreen } from './screens/ScannerScreen'
import { SellScreen } from './screens/SellScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export default function App() {
  // Au premier lancement, on montre l'onboarding. Ensuite on s'en souvient.
  const [onboarded, setOnboarded] = useState(() => load('onboarded', false))

  if (!onboarded) {
    return (
      <Onboarding
        onDone={() => {
          save('onboarded', true)
          setOnboarded(true)
        }}
      />
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/scanner" replace />} />
        <Route path="scanner" element={<ScannerScreen />} />
        <Route path="collection" element={<CollectionScreen />} />
        <Route path="packs" element={<PacksScreen />} />
        <Route path="actus" element={<NewsScreen />} />
        <Route path="vendre" element={<SellScreen />} />
        <Route path="reglages" element={<SettingsScreen onReplayOnboarding={() => setOnboarded(false)} />} />
        <Route path="glossaire" element={<GlossaryScreen />} />
        <Route path="recherche" element={<SearchScreen />} />
        <Route path="carte/:id" element={<CardScreen />} />
        <Route path="collection/extension/:setId" element={<SetScreen />} />
        <Route path="*" element={<Navigate to="/scanner" replace />} />
      </Route>
    </Routes>
  )
}
