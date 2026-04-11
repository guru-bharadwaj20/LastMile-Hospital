# LastMile — Hospital Network Triage System

> *"Hospitals triage patients by urgency. LastMile triages packets the same way."*

---

## The Problem

Every hospital runs a single shared network carrying wildly different types of traffic simultaneously — cardiac arrest alerts, ventilator alarms, ICU vitals, X-ray image transfers, pharmacy orders, administrative file uploads, and staff WiFi. On a conventional network, all of this traffic is treated equally. A life-critical cardiac alert can get stuck behind a radiology image upload during peak hours.

At 90% network congestion, a standard hospital network delivers a cardiac arrest alert in approximately **340–470ms**. In emergency medicine, that delay is clinically significant. The difference between a nurse receiving an alert in 11ms versus 400ms can determine whether intervention happens in time.

LastMile solves this by making the hospital network behave like a hospital — prioritizing traffic exactly the way clinicians triage patients. Critical alerts always get through first, at full speed, regardless of what else is on the network.

---

## How SDN Makes This Possible

Traditional networks are decentralized — each switch makes its own forwarding decision with no global awareness. No single component has the authority to say "right now, give everything to this one packet."

**Software-Defined Networking (SDN)** changes this fundamentally. A central controller maintains full visibility of the entire network topology and can reprogram every switch in real time via OpenFlow flow rules. This is the architectural capability that makes LastMile possible.

This project is built directly on top of an SDN static routing implementation using **Mininet** and **Ryu Controller**. That project demonstrated the core mechanism: a controller that installs flow rules on Open vSwitch instances to deterministically control packet paths. LastMile takes that same mechanism and gives it a clinical purpose — instead of routing H1→H3 along a fixed path, the controller routes `CARDIAC_ALERT → PRIORITY_QUEUE_1` and `STAFF_NETFLIX → PRIORITY_QUEUE_5`, in real time, adapting to network load.

| SDN Project Concept | LastMile Application |
|---|---|
| Controller installs flow rules on switches | Priority engine programs traffic lanes per alert type |
| Static path: H1 → S1 → S2 → S3 → H3 | Dynamic lane: Cardiac alert → guaranteed fast path |
| Flow deletion simulates link failure | Node kill simulates department network failure |
| Flow reinstall = path recovery | Node restore = stream resumption with self-healing |
| Regression test: paths unchanged after reinstall | Recovery test: P1 delivery time unchanged after failure |

In a production deployment, the LastMile simulation engine would be replaced by direct API calls to the Ryu controller, which would install actual OpenFlow rules on OVS switches — enforcing these priorities at the hardware level across the hospital network infrastructure.

---

## Triage Priority Model

| Priority | Label | Traffic Type | Behavior Under Load |
|---|---|---|---|
| P1 | Critical | Cardiac alerts, Code Blue, crash cart | Guaranteed delivery, preempts all other traffic |
| P2 | Urgent | ICU vitals, ventilator alarms, surgery monitoring | High priority, minimal delay |
| P3 | Moderate | Lab results, imaging metadata, pharmacy orders | Standard priority |
| P4 | Low | Administrative uploads, EMR sync, reports | Throttled under stress |
| P5 | Background | Staff WiFi, visitor internet, software updates | First dropped under congestion |

---

## Performance Results

| Condition | Network Load | Without LastMile | With LastMile | Improvement |
|---|---|---|---|---|
| Cardiac arrest alert | 45% | ~180ms | ~10ms | ~18x faster |
| Cardiac arrest alert | 89% | ~420ms | ~11ms | ~38x faster |
| Ventilator alarm | 88% | ~417ms | ~13ms | ~32x faster |
| Crash cart alert | 74% | ~466ms | ~10ms | ~46x faster |
| P5 staff WiFi (stressed) | 89% | Delivered | Dropped | Correctly deprioritized |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LastMile System                          │
│                                                             │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────┐  │
│  │  Hospital   │    │  Priority Engine  │    │  Live     │  │
│  │  Departments│───▶│  (Simulation /    │───▶│  Dashboard│  │
│  │  (Nodes)    │    │  SDN Controller)  │    │  (React)  │  │
│  └─────────────┘    └──────────────────┘    └───────────┘  │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  Traffic streams      Flow rule engine      WebSocket sync  │
│  per department       P1–P5 classification  Real-time UI    │
└─────────────────────────────────────────────────────────────┘

Simulation Layer (current):     JavaScript engine in browser
Production Layer (deployment):  Ryu Controller → OpenFlow → OVS switches
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18 | Component framework |
| Vite | 8.0 | Build tool and dev server |
| D3.js | v7 | SVG particle animations and network graph |
| Framer Motion | latest | UI transitions and alert animations |
| Tailwind CSS | v3 | Layout and utility styling |
| Lucide React | latest | Icons |

### SDN Backend (underlying infrastructure)
| Technology | Purpose |
|---|---|
| Python 3.11 | Controller and topology scripting |
| Ryu SDN Framework | OpenFlow controller |
| Mininet | Network emulation |
| Open vSwitch (OVS) | Software switch with OpenFlow 1.3 support |
| OpenFlow 1.3 | Switch-controller communication protocol |

### Design System
| Element | Choice |
|---|---|
| Display font | Rajdhani — military/technical character |
| Monospace font | JetBrains Mono — clinical data readability |
| Theme | Dark medical/industrial — mission control aesthetic |
| Color language | Priority-coded: red (P1) → orange → amber → green → grey (P5) |

---

## Where This Is Applicable

### Immediate Use Cases
- **Government and private hospitals** with shared network infrastructure and no traffic prioritization
- **ICUs and emergency departments** where alert latency directly affects clinical outcomes
- **Rural telemedicine kiosks** (e.g., eSanjeevani) where bandwidth is limited and doctor consultation traffic competes with administrative traffic
- **Surgical suites** requiring guaranteed monitoring data transmission during procedures

### Broader Applications
- Any environment where multiple traffic classes share a constrained network and priority matters: air traffic control, disaster relief coordination, military field communications, industrial SCADA systems

---

## Running the Demo

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
cd lastmile
npm install
npm run dev
```

Opens on Localhost

### For Production Build (no server required)

```bash
npm run build
```

Open `dist/index.html` directly in any browser — no Node.js or server needed.

---

## Demo Guide

### Automated Demo Mode
Click **[▶ RUN DEMO]** in the bottom-right corner. The system runs a fully scripted sequence — network stress, cardiac alert, comparison view, node failure, and recovery — hands-free. Designed for live presentations.

### Manual Exploration

| Action | What to observe |
|---|---|
| Click **SIMULATE NETWORK STRESS** | Load climbs to 85–92%, P4/P5 particles slow and drop |
| Click **CARDIAC ARREST — ICU Bed 4** | P1 particle shoots through instantly, ~11ms delivery logged |
| Click **SHOW COMPARISON** | Side-by-side: ~11ms with LastMile vs ~400ms without |
| Click **KILL NODE** on any department | Node goes dark, streams suspend, header count updates |
| Click **RESTORE NODE** | Node pulses back, streams resume, self-healing confirmed |
| Scroll right panel down | Priority Configuration — change P2 to P1 and observe behavior shift |

---

## SDN Foundation — Technical Reference

The Mininet topology underlying this project:

```
H1 (10.0.0.1) --|         |-- H3 (10.0.0.3)
                S1 -- S2 -- S3
H2 (10.0.0.2) --|         |-- H4 (10.0.0.4)
```

The `static_controller.py` Ryu controller installs OpenFlow 1.3 flow rules that deterministically route traffic between hosts. This same controller architecture, extended with priority queuing and dynamic rule installation, is what LastMile would use in a real hospital deployment — replacing the JavaScript simulation engine with actual OVS queue configuration and flow rule management via the Ryu REST API.

### Running the SDN Layer

```bash
# Terminal 1 — Start Ryu controller
source ~/ryu-env/bin/activate
ryu-manager static_controller.py

# Terminal 2 — Start Mininet topology
sudo mn --custom static_topo.py --topo statictopo \
  --controller remote,port=6633 \
  --switch ovsk,protocols=OpenFlow13

# Verify flow tables
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s2
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s3
```

### SDN Performance Benchmarks

| Test | Result |
|---|---|
| Ping latency H1→H3 | min=0.099ms, avg=0.237ms, max=0.629ms |
| Ping latency H1→H4 | min=0.069ms, avg=0.184ms, max=0.432ms |
| iperf throughput H1→H3 | 4.64 Gbits/sec |
| iperf throughput H2→H4 | 4.24 Gbits/sec |
| Packet loss (normal) | 0% |
| Packet loss (flow deleted) | 100% |
| Regression test | ALL PASSED |

---

## References

1. [Mininet Overview](https://mininet.org/overview/)
2. [Ryu SDN Framework](https://ryu-sdn.org/)
3. [OpenFlow Specification](https://opennetworking.org/sdn-resources/openflow/)
4. [Open vSwitch](https://www.openvswitch.org/)
5. [React](https://react.dev/)
6. [D3.js](https://d3js.org/)
7. [Vite](https://vitejs.dev/)

## Made with ♡ by Guru R Bharadwaj