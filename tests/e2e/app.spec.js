import { test, expect } from '@playwright/test';

// Mock the webcam with a canvas stream so the full pipeline runs without
// physical hardware. Note: this proves the pipeline *initializes* and
// renders; it does not generate real hand gestures.
// Navigate via the sidebar (Phase 2 shell).
async function goTo(page, view) {
  await page.click(`[data-nav="${view}"]`);
}

async function mockCamera(page) {
  await page.addInitScript(() => {
    const mediaDevices = navigator.mediaDevices ||
      (function define() {
        Object.defineProperty(navigator, 'mediaDevices', { value: {} });
        return navigator.mediaDevices;
      })();

    mediaDevices.enumerateDevices = async () => [
      { kind: 'videoinput', deviceId: 'mock-cam', label: 'Mock Camera', groupId: 'g' },
    ];

    mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      let t = 0;
      const stream = canvas.captureStream(20);
      const paint = () => {
        t += 1;
        ctx.fillStyle = '#101a33';
        ctx.fillRect(0, 0, 320, 240);
        ctx.fillStyle = `hsl(${(t * 3) % 360}, 70%, 60%)`;
        ctx.beginPath();
        ctx.arc(160 + Math.cos(t / 10) * 60, 120 + Math.sin(t / 8) * 50, 26, 0, Math.PI * 2);
        ctx.fill();
        requestAnimationFrame(paint);
      };
      paint();
      return stream;
    };
  });
}

test('application loads without critical console errors', async ({ page }) => {
  await mockCamera(page);

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');

  await expect(page.locator('.brand h1')).toHaveText('Vision RPS');
  await expect(page.locator('#system-status')).toHaveText('Idle');
  await expect(page.locator('#camera-status')).toHaveText('Camera off');
  await expect(page.locator('#btn-enable')).toBeEnabled();

  const critical = errors.filter(
    (e) => !/The AudioContext was not allowed to start|NotAllowedError|autoplay/i.test(e),
  );
  expect(critical).toEqual([]);
});

test('initializes camera and vision pipeline with mocked stream', async ({ page, context }) => {
  await mockCamera(page);
  await context.grantPermissions(['camera']);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await page.click('#btn-enable');

  // Vision engine must reach "ready" (GPU preferred, CPU fallback allowed).
  await expect(page.locator('#system-status')).toContainText('System ready', { timeout: 120_000 });

  // Mocked track label is arbitrary; assert the camera reported live size.
  await expect(page.locator('#camera-status')).not.toHaveText('Camera off', { timeout: 15_000 });
  await expect(page.locator('#camera-status')).toContainText('×');
  await expect(page.locator('#btn-enable')).toBeDisabled();
  await expect(page.locator('#btn-disable')).toBeEnabled();
  await expect(page.locator('#overlay')).toBeVisible();

  // Settings live in the Settings view (sidebar).
  await goTo(page, 'settings');
  await page.fill('#conf-stability', '4');
  await expect(page.locator('#conf-stability-out')).toHaveText('4');
  await page.check('#conf-sound');
  await expect(page.locator('#conf-sound')).toBeChecked();

  // Reset lives in the Play view; returning also resumes vision.
  await goTo(page, 'play');
  await page.click('#btn-reset-stats');
  await expect(page.locator('#stat-player')).toHaveText('0');

  expect(pageErrors).toEqual([]);
});

test('settings persist across reload', async ({ page }) => {
  await mockCamera(page);
  await page.goto('/');
  await goTo(page, 'settings');
  await page.check('#conf-sound');
  await page.fill('#conf-confidence', '70');

  await page.reload();
  await goTo(page, 'settings');
  await expect(page.locator('#conf-sound')).toBeChecked();
  await expect(page.locator('#conf-confidence')).toHaveValue('70');
  await expect(page.locator('#conf-confidence-out')).toHaveText('70%');
});
