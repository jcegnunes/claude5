import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import { initPwaInstall } from './services/pwaInstallService';
import { initLocalStore } from './services/localStore';
import { MANAGED_STORAGE_KEYS } from './services/storageKeys';

// Instalação pelo navegador (PWA) + armazenamento persistente dos dados offline
initPwaInstall();

// Os dados do aparelho (IndexedDB) precisam estar carregados antes de o app
// ser importado: o motor de sincronização lê o armazenamento ao iniciar.
initLocalStore(MANAGED_STORAGE_KEYS)
  .catch(err => console.error('[Armazenamento] Falha ao iniciar:', err))
  .then(() => import('./App.tsx'))
  .then(({ default: App }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
