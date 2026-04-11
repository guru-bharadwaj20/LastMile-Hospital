# PROMPT 3 — Layer 3: Failure Simulation + Polish + Demo Mode

## Context
You are finishing **LastMile** — a hospital network triage visualizer. Layer 1 (UI) and Layer 2 (simulation engine) are complete. The app runs, particles animate, alerts fire, the gauge moves. It looks and feels alive.

Your job now is to build **Layer 3: Node Failure Simulation, the Comparison Screen, Demo Mode, and final polish.** This is what takes it from "working" to "wins the hackathon."

Do NOT touch the SDN files (`static_topo.py`, `static_controller.py`, `regression_test.py`).

---

## Part 1 — Node Failure and Recovery Simulation

### New component: `src/components/NodeFailurePanel.jsx`

A section in the right sidebar below the alert buttons titled **"INFRASTRUCTURE FAILURE"** in red uppercase.

Contains:
- A list of all 7 department nodes (not Server Room)
- Each row: department name + green "ONLINE" badge + [KILL NODE] button
- When killed: badge turns red "OFFLINE", button changes to [RESTORE NODE]
- Killing a node triggers `actions.toggleNodeFailure(name)` from the simulation

### What happens when a node is killed:
1. That department's circle on the hospital map goes dark (grey, no pulse)
2. Its SVG edge line to Server Room goes dashed and dim
3. All traffic streams from that department stop (particles removed)
4. Event log entry: `[TIME] ⚠ NODE FAILURE  Radiology offline — stream suspended — 0 packets routable`
5. If killed node was ICU or ER: a special warning banner appears at top of map: "⚠ CRITICAL NODE OFFLINE — P1 traffic from [dept] unroutable"
6. Node count in header updates: e.g., "NODES: 7/8"

### What happens when a node is restored:
1. Department circle pulses back to life — brief bright flash animation then settles
2. Edge line re-lights
3. Streams resume gradually (particles restart over 2 seconds)
4. Event log: `[TIME] ✓ NODE RESTORED  Radiology back online — streams resuming`
5. Warning banner dismisses with fade animation
6. Node count updates back

---

## Part 2 — The Comparison Screen (The Demo Killer Feature)

### New component: `src/components/ComparisonView.jsx`

Accessible via a button in the header: **[⚡ SHOW COMPARISON]**

This overlays the main view with a split-screen showing:

```
┌─────────────────────────┬─────────────────────────┐
│   WITHOUT LastMile      │    WITH LastMile         │
│                         │                          │
│   [dumb network icon]   │   [smart network icon]   │
│                         │                          │
│   Network Load: 89%     │   Network Load: 89%      │
│                         │                          │
│   Cardiac alert:        │   Cardiac alert:         │
│   ████████░░░░  340ms   │   ██  11ms               │
│                         │                          │
│   ICU Vitals:           │   ICU Vitals:            │
│   ████  220ms           │   ██  28ms               │
│                         │                          │
│   Admin upload:         │   Admin upload:          │
│   ██  180ms             │   ████████  340ms        │
│                         │                          │
│   Dropped packets: 34%  │   Dropped packets: 0%    │
│   (critical traffic)    │   (critical traffic)     │
│                         │                          │
└─────────────────────────┴─────────────────────────┘
              [CLOSE COMPARISON]
```

**Visual treatment:**
- Left side: slightly desaturated, dim, old-school feel
- Right side: bright, sharp, your brand colors
- The bar charts animate in on open (Framer Motion stagger)
- The ms numbers count up from 0 (number animation) — dramatic effect
- A label at the bottom: *"At 89% network load, LastMile delivers cardiac alerts 30x faster"*
- The multiplier ("30x") is calculated live from the simulation's last alert data

**When to auto-show it:**
After a "Cardiac Arrest" alert fires and delivers, a small button pulsing in the event log entry says: `[See why this matters →]`. Clicking it opens ComparisonView pre-filled with that alert's actual data.

---

## Part 3 — Demo Mode

### New component: `src/components/DemoController.jsx`

A floating pill button in bottom-right corner: **[▶ RUN DEMO]**

When clicked, runs a scripted sequence automatically — perfect for when you're presenting and want hands-free drama:

```javascript
const DEMO_SCRIPT = [
  { delay: 0,     action: "reset",          label: "Network reset to baseline" },
  { delay: 2000,  action: "stress",         label: "Simulating shift change traffic spike" },
  { delay: 5000,  action: "alert_cardiac",  label: "Cardiac arrest — ICU Bed 4" },
  { delay: 7000,  action: "comparison",     label: "Showing comparison" },
  { delay: 12000, action: "closeComparison",label: "Closing comparison" },
  { delay: 13000, action: "killNode",       node: "Radiology", label: "Simulating node failure" },
  { delay: 16000, action: "alert_ventilator", label: "Ventilator alarm during failure" },
  { delay: 19000, action: "restoreNode",    node: "Radiology", label: "Restoring failed node" },
  { delay: 22000, action: "reset",          label: "Network stabilizing" },
]
```

**Demo mode UI:**
- While running: a progress bar at the top of the screen showing demo timeline
- Each step shows a floating caption (bottom center) describing what's happening — like a documentary subtitle
- Caption fades in/out with each step
- [⏹ STOP DEMO] button appears while running
- After complete: "Demo complete — try it yourself" message fades in

This is the feature that lets you step back from the laptop and just narrate while the demo runs itself.

---

## Part 4 — Polish Pass

Go through every component and apply these fixes:

### Animations
- All state changes should animate, never instant-snap
  - Load meter: CSS `transition: width 0.6s ease`
  - Node going offline: 0.3s fade to grey
  - New log entries: slide in from left, 0.2s
  - Alert badges: scale from 0 with spring (Framer Motion)
  - Particles: already animated, check they restart cleanly after reset

### The "alive" feeling
- Add a subtle scanline texture overlay to the entire app (CSS `repeating-linear-gradient` very low opacity — 2–3%)
- Add very subtle CRT-style vignette (radial gradient overlay, dark at edges)
- Header clock should tick every second (already built, just confirm it works)
- Node pulse animation: use `@keyframes` — slow breathe (scale 1.0 → 1.15 → 1.0, 2s loop)
- Network load meter should have a slight "jitter" — random ±1% oscillation every 500ms to feel like real data

### Typography
- Confirm Rajdhani is applied to: header, all section titles, all button labels, all priority badges, department labels on map
- Confirm JetBrains Mono is applied to: all numbers, timestamps, ms values, event log, load percentage

### Color consistency audit
- Every P1 element: `var(--p1-critical)` — no hardcoded reds anywhere
- Every dropped packet indicator: strikethrough + `var(--text-dim)`
- Every "delivered" indicator: `var(--p4-low)` green checkmark

### Mobile — not required, but fix one thing
- If window width < 1024px: show a centered message "LastMile is optimized for desktop presentation. Please open on a laptop."

---

## Part 5 — README Update

Add a new section to the existing `README.md` (after the existing content, do not modify existing content):

```markdown
---

## LastMile — Hospital Network Triage Visualizer

A hackathon demo built on top of the SDN static routing project.
Simulates hospital network triage — prioritizing critical medical traffic
exactly like doctors triage patients.

### Running the Demo

```bash
cd lastmile
npm install
npm run dev
```

Open http://localhost:5173

### Demo Guide

1. Click **[▶ RUN DEMO]** for automated presentation mode
2. Or manually:
   - Click **[SIMULATE NETWORK STRESS]** — watch P4/P5 traffic degrade
   - Click **[CARDIAC ARREST — ICU Bed 4]** — watch P1 cut through instantly
   - Click **[SHOW COMPARISON]** — see the 30x difference
   - Click **[KILL NODE]** on Radiology — watch failure and recovery

### How it connects to the SDN project

The priority logic mirrors the OpenFlow flow rules in `static_controller.py`.
In a real deployment, the simulation engine would call the Ryu controller API
to install actual flow rules on OVS switches — replacing the JavaScript
simulation with real network enforcement.
```

---

## Final Deliverables Checklist

- [ ] Node kill/restore works with full visual feedback
- [ ] ComparisonView opens with animated bars and live multiplier
- [ ] "See why this matters" button appears after alert fires
- [ ] Demo mode runs full scripted sequence hands-free
- [ ] Demo captions visible and timed correctly
- [ ] Scanline + vignette overlay applied
- [ ] Node pulse animation running
- [ ] All fonts consistent (Rajdhani + JetBrains Mono)
- [ ] No hardcoded colors — all CSS variables
- [ ] No console errors
- [ ] App starts cleanly with `npm run dev`
- [ ] README updated

---

## The Final Check — The Hackathon Simulation

Imagine you just walked up to the judging table. You have 4 minutes.

1. Open the app. Does it look like serious infrastructure software? Not a school project?
2. Click RUN DEMO. Does it run itself without you touching anything?
3. Does the cardiac arrest moment make the judge look up from their phone?
4. Does the comparison screen make the "30x faster" number land clearly?
5. Does the node failure feel dramatic and the recovery feel satisfying?
