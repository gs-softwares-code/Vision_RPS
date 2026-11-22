/**
 * main.ts — application bootstrap.
 */

import './styles/main.css';
import { VisionRPSApp } from './app/App';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new VisionRPSApp().init());
} else {
  new VisionRPSApp().init();
}
