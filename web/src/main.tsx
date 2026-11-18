import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App.tsx'
import './index.css'

// Point d'entrée : React affiche <App /> dans la div #root de index.html.
// HashRouter met la page dans l'URL après un « # » (ex. /#/collection) :
// ça fonctionne sur n'importe quel hébergement statique, y compris GitHub Pages.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
