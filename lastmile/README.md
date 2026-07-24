# LastMile Dashboard

React visualization for the LastMile Hospital Network Triage System. For project context, the SDN layer, and measured results, see the [root README](../README.md).

## Quick start

```bash
npm install
npm run dev
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over `src/` |

## Layout

```
src/
├── App.jsx                     Top level layout, header, sidebar accordions
├── App.css                     Design tokens and all component styling
├── main.jsx                    React root
├── simulation/
│   └── networkState.js         Simulation engine and the useNetworkSimulation hook
└── components/
    ├── HospitalMap.jsx         SVG floor plan, department rooms, network edges
    ├── TrafficStream.jsx       D3 particle animation layered over the map
    ├── NetworkLoadMeter.jsx    Vertical load gauge and bandwidth share bars
    ├── AlertPanel.jsx          Emergency console, active alerts, priority config
    ├── NodeFailurePanel.jsx    Per department kill/restore controls
    ├── EventLog.jsx            Scrolling network event feed
    ├── PriorityLegend.jsx      P1–P5 colour key
    └── ComparisonView.jsx      With/without triage overlay
```

## How the simulation works

All state lives in a single object owned by `useNetworkSimulation()`. There is no backend and no network I/O.

Three timers drive it:

| Timer | Interval | Effect |
|---|---|---|
| Load oscillator | 500 ms | Moves `networkLoad` toward a mode dependent target and recomputes bandwidth share |
| Baseline log generator | 3–6 s | Emits a delivery event for a randomly chosen active stream |
| Congestion drop checker | 1 s | In stressed or critical mode, probabilistically drops P5 packets |

`mode` is one of `normal`, `stressed`, `critical`, or `failure`, and determines the load target, the bandwidth split, and which streams are suspended.

The latency numbers shown in the UI come from `calculateDeliveryTime()`. **These are illustrative model constants, not measurements** — see the Simulation Parameters section of the root README.

## Styling

No CSS framework. `App.css` defines CSS custom properties for the colour system (`--p1-critical` through `--p5-background`) and all component classes. Both fonts are loaded from Google Fonts in `index.html`.
