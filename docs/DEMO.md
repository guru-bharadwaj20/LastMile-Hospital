# Demo Capture

The screenshots in the README are generated, not hand-taken. A one-off screen
recording rots the moment the UI changes and nobody can regenerate it;
`npm run demo:capture` drives the real app through a fixed storyboard and
writes the whole set in about thirty seconds.

```bash
cd lastmile
npm ci
npm run demo:capture      # writes ../docs/media/
```

Playwright must have a browser available. If this is a fresh clone:

```bash
npx playwright install chromium
```

## Storyboard

| # | File | Beat | What it demonstrates |
|---|---|---|---|
| 1 | `01-normal.png` | Steady state | Baseline traffic, ~45% load, particles flowing along every department link |
| 2 | `02-stressed.png` | Under stress | Load climbs to ~88%, P4/P5 particle counts halved, bulk streams injected |
| 3 | `03-alert.png` | Cardiac arrest | Critical mode: P4/P5 suspended, glowing P1 particle in flight, alert delivered in single-digit ms |
| 4 | `04-comparison.png` | With vs without | Side-by-side latency, the multiplier, and the disclaimer that the figures are modelled |
| 5 | `05-node-failure.png` | ICU offline | Node goes dark, its streams suspend, critical-node banner appears |
| 6 | `06-restored.png` | Recovery | Node back online, streams resume, status returns to stressed |
| 7 | `07-mobile.png` | Responsive | Full layout at 390px wide — the meter becomes a horizontal strip and panels stack |

`demo.webm` is the whole run as video.

## Timing is load-bearing

Two beats are timing-sensitive, and getting them wrong produces a screenshot
that looks fine but shows the wrong thing:

- **The alert** holds the network in critical mode for only 800 ms
  (`TIMING.alertHoldMs`). A screenshot itself costs a couple of hundred
  milliseconds, so the capture fires almost immediately after the click. Wait
  much longer and the still shows the steady state with no alert in flight.
- **The comparison dialog** animates its bars and count-ups for roughly
  2.5 seconds. Capturing early gives half-drawn bars and numbers still
  counting up from zero.

## Producing the README GIF

The video is WebM, which GitHub will not render inline in a README. Converting
needs `ffmpeg`:

```bash
cd docs/media

# Palette first, or the gradients in the dark theme band badly.
ffmpeg -i demo.webm -vf "fps=12,scale=900:-1:flags=lanczos,palettegen" -y palette.png
ffmpeg -i demo.webm -i palette.png \
  -lavfi "fps=12,scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse" \
  -y demo.gif
```

12 fps at 900px keeps the result under a few megabytes while staying readable.
Expect roughly 3–5 MB for the full run; trim with `-ss` and `-t` if you want
just the alert sequence.

## Repository weight

The stills are committed because they are what the README displays.
`demo.webm` is **not** — it is 4 MB, regenerable in one command, and would be
re-added on every capture. It is listed in `.gitignore`.

If you generate `demo.gif` and want it in the README, commit it deliberately
and keep an eye on the size; a repository that takes a minute to clone because
of one animation is a poor trade.

## Adjusting

Everything is in [`lastmile/scripts/capture-demo.mjs`](../lastmile/scripts/capture-demo.mjs).

- `VIEWPORT` — capture size, currently 1440×900
- `deviceScaleFactor: 2` — retina stills; drop to 1 to roughly quarter the file sizes
- `BEATS` — the storyboard table above; add an entry and a `shoot()` call to extend it

The script drives the app through its accessible roles and names — the same
queries the test suite uses — so a change that breaks the capture usually
means a real regression in the UI's labelling, not just a broken script.
