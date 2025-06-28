import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Enregistrer le service worker pour PWA
serviceWorkerRegistration.register({
  onSuccess: (registration) => {
    console.log('Service Worker enregistré avec succès:', registration);
  },
  onUpdate: (registration) => {
    console.log('Nouvelle version disponible');
    // Ici vous pouvez afficher une notification à l'utilisateur
    if (window.confirm('Une nouvelle version est disponible. Voulez-vous la charger ?')) {
      window.location.reload();
    }
  },
});

// Mesurer les performances web
const reportWebVitals = (onPerfEntry?: any) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

// Exporter pour utilisation externe
export { reportWebVitals }; 