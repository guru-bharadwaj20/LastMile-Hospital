# LastMile-Hospital

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