/**
 * capture-demo.mjs — Drive the dashboard through the demo sequence and
 * capture it.
 *
 * Produces a numbered set of screenshots and a video of the whole run, so the
 * README's visuals are reproducible rather than a one-off screen recording
 * that nobody can regenerate after the UI changes.
 *
 *   npm run build
 *   npm run demo:capture
 *
 * Output lands in ../docs/media/. The video is WebM, which GitHub will not
 * render inline; see docs/DEMO.md for the one ffmpeg command that turns it
 * into a GIF.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, rm, readdir, rename } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../docs/media');

const VIEWPORT = { width: 1440, height: 900 };

/** Storyboard. Each beat is captured as a numbered screenshot. */
const BEATS = [
  { name: '01-normal', caption: 'Steady state — baseline traffic, ~45% load' },
  { name: '02-stressed', caption: 'Network under stress — P4/P5 degraded' },
  { name: '03-alert', caption: 'Cardiac arrest fired — P1 preempts everything' },
  { name: '04-comparison', caption: 'With vs without triage' },
  { name: '05-node-failure', caption: 'ICU node killed — critical traffic unroutable' },
  { name: '06-restored', caption: 'ICU restored — streams resume' },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, index, label) {
  const beat = BEATS[index];
  await page.screenshot({ path: resolve(outDir, `${beat.name}.png`) });
  console.log(`  ${beat.name}.png  — ${label ?? beat.caption}`);
}

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // Serve the app from Vite in preview-like mode so the capture exercises the
  // same code the deployed build runs.
  const server = await createServer({
    root: resolve(here, '..'),
    server: { port: 5199, strictPort: true },
    logLevel: 'error',
  });
  await server.listen();
  const url = 'http://localhost:5199/';
  console.log(`Serving ${url}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2, // retina-quality stills
    recordVideo: { dir: outDir, size: VIEWPORT },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();

  try {
    console.log('Capturing:');
    await page.goto(url, { waitUntil: 'networkidle' });

    // Let the load oscillator settle and particles start flowing.
    await wait(3500);
    await shoot(page, 0);

    // ── Stress ────────────────────────────────────────────────
    await page.getByRole('button', { name: /Simulate Network Stress/i }).click();
    await wait(4000);
    await shoot(page, 1);

    // ── P1 alert ──────────────────────────────────────────────
    // Open Active Alerts first, so the still shows the delivered latency
    // rather than a collapsed panel.
    await page.getByRole('button', { name: /Active Alerts/i }).click();
    await wait(400);

    await page.getByRole('button', { name: /Cardiac Arrest/i }).click();
    // The alert holds the network in critical mode for 800ms. Screenshotting
    // costs a couple of hundred milliseconds on its own, so this fires almost
    // immediately or the moment is gone and the still shows the steady state.
    await wait(180);
    await shoot(page, 2);
    await wait(1500);

    // ── Comparison ────────────────────────────────────────────
    await page.getByRole('button', { name: /SHOW COMPARISON/i }).click();
    await page.getByRole('dialog').waitFor();
    await wait(2800); // let the bars and counters finish animating
    await shoot(page, 3);
    await page.keyboard.press('Escape');
    await wait(800);

    // ── Node failure ──────────────────────────────────────────
    await page.getByRole('button', { name: /Infrastructure Access/i }).click();
    await wait(500);
    await page.getByRole('button', { name: /take offline ICU node/i }).click();
    await wait(2500);
    await shoot(page, 4);

    // ── Recovery ──────────────────────────────────────────────
    await page.getByRole('button', { name: /restore ICU node/i }).click();
    await wait(2500);
    await shoot(page, 5);

    // ── Mobile still, to show the layout adapts ───────────────
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(1500);
    await page.screenshot({ path: resolve(outDir, '07-mobile.png'), fullPage: true });
    console.log('  07-mobile.png — Responsive layout at 390px');
  } finally {
    await context.close(); // flushes the video
    await browser.close();
    await server.close();
  }

  // Playwright names videos with a random id; give it a predictable one.
  const files = await readdir(outDir);
  const video = files.find((f) => f.endsWith('.webm'));
  if (video) {
    await rename(resolve(outDir, video), resolve(outDir, 'demo.webm'));
    console.log('  demo.webm     — full run');
  }

  console.log(`\nWrote ${outDir}`);
  console.log('To produce the README GIF, see docs/DEMO.md');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
