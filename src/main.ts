/**
 * main.ts — application bootstrap & PWA registration.
 */

import './styles/main.css';
import { VisionRPSApp } from './app/App';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new VisionRPSApp().init());
} else {
  new VisionRPSApp().init();
}

// Progressive Web App: Service Worker registration
if ('serviceWorker' in navigator && (import.meta.env.PROD || window.location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker active, scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  });
}

// Progressive Web App: Install prompt handling
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  const installBtn = document.getElementById('btn-pwa-install');
  if (installBtn) {
    installBtn.classList.remove('hidden');
    installBtn.addEventListener(
      'click',
      async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          console.log('[PWA] App installation accepted');
        }
        deferredPrompt = null;
        installBtn.classList.add('hidden');
      },
      { once: true }
    );
  }
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] Vision RPS installed successfully');
  const installBtn = document.getElementById('btn-pwa-install');
  if (installBtn) {
    installBtn.classList.add('hidden');
  }
});
