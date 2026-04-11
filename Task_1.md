Layer 1: React App Scaffold + Hospital Floor UI

## Context
You are building a hackathon demo called **"LastMile"** — a hospital network triage visualizer. The concept: hospitals have one network carrying everything from cardiac arrest alerts to staff YouTube. This system prioritizes network traffic exactly like doctors triage patients — critical alerts always get through, entertainment gets dropped first.

This is **Option C** — a fully self-contained simulation. No real Mininet or SDN hardware is involved. All network behavior is simulated in JavaScript/Python. The goal is a stunning, demo-ready React app that runs on a local dev server.

The existing project folder already contains SDN-related files:
- `static_topo.py` — Mininet topology
- `static_controller.py` — Ryu controller
- `regression_test.py` — regression tests
- `README.md`

Do NOT touch or modify any of these files.

---

## Your Job in This Prompt
Set up the complete React app structure and build **Layer 1: The Hospital Floor UI** — the visual foundation that everything else plugs into.

---

## Tech Stack
- **React 18** with Vite (use `npm create vite@latest` with react template)
- **D3.js v7** for animated SVG network flows
- **Framer Motion** for UI animations and transitions
- **Tailwind CSS** for layout and utility styling
- **Lucide React** for icons
- No UI component library — build everything custom

---

## Project Structure to Create
```
lastmile/
├── public/
├── src/
│   ├── components/
│   │   ├── HospitalMap.jsx         # SVG hospital floor plan
│   │   ├── TrafficStream.jsx       # Animated D3 particle flows
│   │   ├── NetworkLoadMeter.jsx    # Live load gauge
│   │   ├── AlertPanel.jsx          # Right sidebar alerts
│   │   ├── EventLog.jsx            # Bottom scrolling log
│   │   └── PriorityLegend.jsx      # Color/priority legend
│   ├── simulation/
│   │   └── networkState.js         # Simulation state (build in Layer 2)
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── index.html
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## Design Direction — CRITICAL, follow exactly

**Aesthetic:** Dark medical/industrial. Think mission control meets ICU monitoring room. NOT generic dashboard blue.

**Color Palette (use as CSS variables in App.css):**
```css
--bg-primary: #0a0e14        /* near-black with blue tint */
--bg-secondary: #111827      /* card backgrounds */
--bg-panel: #0d1117          /* sidebar panels */
--border: #1f2937            /* subtle borders */
--text-primary: #f0f4f8      /* main text */
--text-muted: #6b7280        /* secondary text */
--text-dim: #374151          /* very dim labels */

/* Priority colors — these are the core visual language */
--p1-critical: #ff2d2d       /* cardiac red — glows */
--p1-glow: rgba(255,45,45,0.4)
--p2-urgent: #ff6b2d         /* orange */
--p3-moderate: #fbbf24       /* amber */
--p4-low: #34d399            /* green */
--p5-background: #4b5563     /* grey */
--p5-dim: #1f2937

/* Accent */
--accent-blue: #38bdf8
--accent-pulse: rgba(56,189,248,0.15)
```

**Typography:**
- Display/headings: `"Rajdhani"` from Google Fonts — military/technical feel
- Body/data: `"JetBrains Mono"` from Google Fonts — monospace, clinical
- Load both in index.html via Google Fonts link

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  HEADER: "LastMile" logo + network status bar       │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│   HOSPITAL MAP       │   ALERT PANEL (right)        │
│   (SVG floor plan    │   - Triage level buttons     │
│   with D3 flows)     │   - Active alerts list       │
│                      │   - Priority config          │
│                      │                              │
├──────────────────────┴──────────────────────────────┤
│  EVENT LOG — scrolling real-time log (bottom)       │
└─────────────────────────────────────────────────────┘
```

---

## HospitalMap.jsx — Build This Exactly

The hospital floor plan is an **SVG** drawn programmatically. No image files.

### Departments to draw (SVG rectangles with labels):
```
ICU          — top left,     red-tinted border,   label "ICU"
Emergency    — top center,   orange-tinted border, label "ER"  
Surgery      — top right,    orange border,        label "SURGERY"
Radiology    — middle left,  yellow border,        label "RADIOLOGY"
Pharmacy     — middle right, green border,         label "PHARMACY"
Admin        — bottom left,  grey border,          label "ADMIN"
Staff Lounge — bottom right, grey border,          label "STAFF"
Server Room  — center,       blue border,          label "SERVER" — this is the hub
```

### Network nodes:
- Each department has a **circular node** (r=10) at its center
- Server Room node is larger (r=16), always glowing blue
- Nodes pulse slowly when active (CSS animation)
- Nodes turn grey and stop pulsing when "dead" (for failure simulation later)

### Network edges:
- SVG `<line>` elements connecting each department to the Server Room
- Lines have a subtle dark color by default
- Lines light up in the traffic color when data flows through them

### Animated traffic particles (TrafficStream.jsx):
- Use D3.js to animate small colored circles moving along the SVG edges
- Each particle represents a "packet" traveling from department to server
- Particle color = priority color (red for P1, orange for P2, etc.)
- Speed varies by priority: P1 particles move fastest
- Multiple particles per stream, staggered timing
- Under network stress: P4/P5 particles slow down and disappear
- P1 alert particles: larger, brighter, leave a brief trail/glow

---

## NetworkLoadMeter.jsx

A vertical or arc gauge on the left side showing 0–100% network load.

- 0–60%: gauge fills green
- 60–80%: transitions to amber
- 80–100%: red, with a subtle pulsing glow effect
- Shows exact percentage in JetBrains Mono font, large
- Label: "NETWORK LOAD" in Rajdhani, uppercase, letter-spaced
- Below it: show breakdown bars for each priority tier's current bandwidth share

---

## AlertPanel.jsx (right sidebar)

Three sections:

**Section 1 — Manual Trigger Buttons (for demo)**
Large clickable buttons to simulate events:
```
[🔴 CARDIAC ARREST — ICU Bed 4]     ← biggest, most dramatic
[🟠 VENTILATOR ALARM — ICU Bed 7]
[🟡 CRASH CART — Surgery Block B]
[⚫ SIMULATE NETWORK STRESS]         ← floods network with P4/P5 traffic
[🔄 RESET NETWORK]
```

Buttons should look like actual emergency console buttons — not generic UI. Use border, glow on hover, uppercase Rajdhani font.

**Section 2 — Active Alerts**
A live list of currently active alerts. Each item shows:
- Priority badge (colored pill)
- Alert description
- Time elapsed since fired
- Delivery time in ms (e.g., "Delivered in 11ms")

**Section 3 — Priority Config**
A simple table showing each traffic type and its current priority level (P1–P5). Each row has a small colored dot. This is read-only in Layer 1, interactive in Layer 2.

---

## EventLog.jsx (bottom bar)

A horizontally scrolling or auto-scrolling vertical log. Each entry:
```
[14:32:07]  🔴 CRITICAL   Cardiac alert ICU Bed 4 → Server    11ms    ✓ DELIVERED
[14:32:06]  ⚫ BACKGROUND  Staff-Lounge WiFi → Server           —     ✗ DROPPED (congestion)
[14:32:05]  🟢 LOW        Admin report upload → Server         340ms   ✓ DELIVERED
```

- Monospace font (JetBrains Mono)
- New entries appear at top, push old ones down
- Critical entries have a brief red flash animation on entry
- Dropped entries show in dim grey with strikethrough on delivery time

---

## Header

```
LastMile                    [● NETWORK ACTIVE]  [14:32:07]  [NODES: 8/8]
Hospital Network Triage System
```

- "LastMile" in large Rajdhani bold
- Tagline in small muted monospace
- Status indicators on right — green dot + "NETWORK ACTIVE" text
- Live clock ticking in JetBrains Mono
- Node count (e.g., 8/8 — will show 7/8 when a node fails)

---

## What to NOT Build in This Prompt
- No simulation logic yet (that's Layer 2)
- No backend/WebSocket yet (that's Layer 3)
- All data should be **hardcoded mock state** for now
  - Network load: fixed at 45%
  - 3 mock events in the log
  - All nodes active
  - No particles moving yet (static SVG is fine)
- The buttons should exist but `onClick` can just `console.log` for now

---

## Deliverables
1. Full working React + Vite app that starts with `npm run dev`
2. All components created with proper file structure
3. Hospital floor SVG visible and styled correctly
4. Color system applied consistently via CSS variables
5. Fonts loaded and applied
6. Layout responsive to a 1440px wide screen (hackathon laptop screen)
7. No errors in console

---

## Final Check Before Done
- Open the app. Does it look like a serious medical network monitoring system?
- Is the dark theme consistent everywhere?
- Are the priority colors visible and distinct?
- Does the layout feel like mission control, not a generic dashboard?
- Is the font pairing (Rajdhani + JetBrains Mono) applied correctly?

If anything looks generic or "AI slop" — fix it before finishing.