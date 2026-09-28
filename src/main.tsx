import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initPwaInstall } from './services/pwaInstallService';

// Instalação pelo navegador (PWA) + armazenamento persistente dos dados offline
initPwaInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
