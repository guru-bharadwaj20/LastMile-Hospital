# LastMile SDN Layer

Two controllers share one topology and one derived forwarding table:

| Controller | What it does | Use it for |
|---|---|---|
| `static_controller.py` | Deterministic IPv4 forwarding, no QoS | Routing correctness, the original ping/iperf evidence |
| `qos_controller.py` | The same forwarding, plus `OFPActionSetQueue` per traffic class | Priority enforcement and benchmarking |

## Priority Enforcement (QoS)

The triage model is enforced in the data plane, not just drawn in a browser.
Each class binds a DSCP codepoint to an Open vSwitch HTB queue:

| Class | Queue | DSCP | Guaranteed | Ceiling | HTB band | Traffic |
|---|---|---|---|---|---|---|
| P1 | q0 | EF (46) | 35% | 100% | 0 | Cardiac arrest, Code Blue, crash cart |
| P2 | q1 | AF41 (34) | 25% | 80% | 1 | ICU vitals, ventilator alarms, surgical monitoring |
| P3 | q2 | AF31 (26) | 20% | 60% | 2 | Lab results, imaging metadata, pharmacy orders |
| P4 | q3 | AF21 (18) | 12% | 40% | 3 | Administrative uploads, EMR sync, reports |
| P5 | q4 | BE (0) | 8% | 25% | 4 | Staff WiFi, visitor internet, software updates |

Guarantees total 100%, so every class keeps a floor even on a saturated link.
Only P1 may burst to the full link; everything else is capped so it cannot
crowd out clinical traffic.

**Classification is by DSCP** because it has to survive the trip from the
sending host to the switch. Six bits in the IP header, understood by every
switch, and settable by an endpoint with `ping -Q`, `iperf3 --dscp`, or
`setsockopt(IP_TOS)`. The cost is that classification is only as trustworthy
as the endpoints — see the threat model in [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

### Rule layout

Per switch, highest OpenFlow priority first:

```
110  in_port + ipv4_dst + ip_dscp  ->  SetQueue(n), Output(port)
100  in_port + ipv4_dst            ->  SetQueue(q4), Output(port)
  0  table-miss                    ->  Controller
```

Unmarked traffic still forwards correctly, but lands in the best-effort queue
rather than inheriting a clinical guarantee. Fail-open on reachability,
fail-safe on priority.

`OFPActionSetQueue` is emitted before `OFPActionOutput`: actions in an
`APPLY_ACTIONS` list run in order, so the queue must be selected before the
packet reaches the port.

### Running the QoS layer

```bash
# Terminal 1 — controller
source ~/ryu-env/bin/activate
ryu-manager --ofp-tcp-listen-port 6633 SDN_files/qos_controller.py

# Terminal 2 — rate-limited topology (queues do nothing on an uncapped link)
sudo mn --custom SDN_files/static_topo.py --topo qostopo \
  --controller remote,port=6633 --switch ovsk,protocols=OpenFlow13

# Terminal 3 — create the queues OpenFlow selects
sudo python3 SDN_files/setup_qos.py apply
sudo python3 SDN_files/setup_qos.py show
```

Preview the exact `ovs-vsctl` commands without touching anything:

```bash
python3 SDN_files/setup_qos.py apply --dry-run
python3 SDN_files/qos.py                # print the policy table
```

Then mark traffic to select a class. Note `ping -Q` takes a full ToS byte,
which is the DSCP value shifted left by two:

```bash
mininet> h1 ping -Q 184 -c 20 10.0.0.3      # 46 << 2, EF, P1
mininet> h2 iperf3 -c 10.0.0.4 --dscp 0 -t 30   # best effort background load
```

Tear down with `sudo python3 SDN_files/setup_qos.py clear`, which also
destroys the orphaned `qos` and `queue` records that would otherwise
accumulate across restarts.

---

## Static Routing (foundation)

## Problem Statement
Implement static routing paths using controller-installed flow rules in an SDN environment using Mininet and Ryu controller. The controller manually installs OpenFlow flow rules on each switch to define fixed routing paths between hosts, demonstrating controller-switch interaction and network behavior observation.

## Objectives
- Define static routing paths across a 3-switch topology
- Install flow rules manually via SDN controller (Ryu)
- Validate packet delivery using ping and iperf
- Document routing behavior using flow tables and Wireshark
- Regression test: Ensure paths remain unchanged after rule reinstall

## Topology
```
H1 (10.0.0.1) --|         |-- H3 (10.0.0.3)
				S1 -- S2 -- S3
H2 (10.0.0.2) --|         |-- H4 (10.0.0.4)
```

- 3 OpenFlow switches (S1, S2, S3) connected in a line
- 4 hosts: H1, H2 connected to S1; H3, H4 connected to S3
- S2 acts as the core/transit switch
- All routing paths are statically defined via controller

## Routing Table

| Source | Destination | Path |
|--------|-------------|------|
| H1 | H2 | H1 -> S1 -> H2 |
| H1 | H3 | H1 -> S1 -> S2 -> S3 -> H3 |
| H1 | H4 | H1 -> S1 -> S2 -> S3 -> H4 |
| H2 | H3 | H2 -> S1 -> S2 -> S3 -> H3 |
| H2 | H4 | H2 -> S1 -> S2 -> S3 -> H4 |
| H3 | H4 | H3 -> S3 -> H4 |

## Project Structure
```
SDN-Static-Routing-Mininet/
|-- static_topo.py          # Mininet topology definition
|-- static_controller.py    # Ryu controller with static flow rules
|-- regression_test.py      # Regression test script
|-- README.md               # Project documentation
`-- Screenshots/            # Proof of execution
	|-- 01_pingall_and_flowtable_s1.png
	|-- 02_flowtable_s2_and_s3.png
	|-- 03_ping_results_scenario1_normal_routing.png
	|-- 04_pingall_0percent_loss_functional_correctness.png
	|-- 05_iperf_throughput_h1_to_h3.png
	|-- 06_iperf_throughput_h2_to_h4.png
	|-- 07_scenario2_failure_flow_deletion_100percent_loss.png
	|-- 08_scenario2_recovery_flow_reinstall_0percent_loss.png
	`-- 09_wireshark_icmp_arp_packet_capture_s1eth1.png
```

## Setup and Execution

### Requirements
- Ubuntu 24.04 LTS
- Mininet (`sudo apt install mininet -y`)
- Python 3.11
- Ryu Controller (installed in Python 3.11 virtual environment)
- Open vSwitch

### Step 1: Activate Ryu environment
```bash
source ~/ryu-env/bin/activate
cd ~/Desktop/SDN-Static-Routing-Mininet
```

### Step 2: Start Ryu controller (Terminal 1)
```bash
ryu-manager static_controller.py
```

### Step 3: Start Mininet topology (Terminal 2)
```bash
sudo mn --custom static_topo.py --topo statictopo --controller remote,port=6633 --switch ovsk,protocols=OpenFlow13
```

### Step 4: Test connectivity
```text
mininet> pingall
mininet> h1 ping -c 4 h3
mininet> h1 ping -c 4 h4
mininet> h2 ping -c 4 h3
```

### Step 5: Verify flow tables
```text
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s1
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s2
mininet> sh ovs-ofctl -O OpenFlow13 dump-flows s3
```

### Step 6: Run iperf throughput test
```text
mininet> xterm h1 h3
```
In h3 window: `iperf -s`  
In h1 window: `iperf -c 10.0.0.3 -t 5`

### Step 7: Run regression test
```text
mininet> sh python3 regression_test.py
```

## Expected Output

### pingall
```text
h1 -> h2 h3 h4
h2 -> h1 h3 h4
h3 -> h1 h2 h4
h4 -> h1 h2 h3
*** Results: 0% dropped (12/12 received)
```

### iperf (H1 to H3)
```text
[ 1] 0.0000-5.0198 sec  2.71 GBytes  4.64 Gbits/sec
```

### Regression Test
```text
RESULT: ALL TESTS PASSED
```

## Test Scenarios

### Scenario 1: Normal Routing
All hosts can reach each other with 0% packet loss via statically defined paths.

### Scenario 2: Failure and Recovery
- Flow rule deleted on S2 -> H1 cannot reach H3 (100% packet loss)
- Flow rule manually reinstalled -> H1 reaches H3 again (0% packet loss)

## Proof of Execution

### Flow Tables
![Flow Table S1 and pingall](Screenshots/01_pingall_and_flowtable_s1.png)
![Flow Tables S2 and S3](Screenshots/02_flowtable_s2_and_s3.png)

### Ping Results
![Normal Routing Pings](Screenshots/03_ping_results_scenario1_normal_routing.png)
![Pingall 0% Loss](Screenshots/04_pingall_0percent_loss_functional_correctness.png)

### iperf Throughput
![iperf H1 to H3](Screenshots/05_iperf_throughput_h1_to_h3.png)
![iperf H2 to H4](Screenshots/06_iperf_throughput_h2_to_h4.png)

### Failure and Recovery Scenarios
![Failure Scenario](Screenshots/07_scenario2_failure_flow_deletion_100percent_loss.png)
![Recovery Scenario](Screenshots/08_scenario2_recovery_flow_reinstall_0percent_loss.png)

### Wireshark Packet Capture
![Wireshark ICMP and ARP](Screenshots/09_wireshark_icmp_arp_packet_capture_s1eth1.png)

## Performance Analysis

| Test | Result |
|------|--------|
| Ping latency (H1->H3) | min=0.099ms, avg=0.237ms, max=0.629ms |
| Ping latency (H1->H4) | min=0.069ms, avg=0.184ms, max=0.432ms |
| iperf throughput (H1->H3) | 4.64 Gbits/sec |
| iperf throughput (H2->H4) | 4.24 Gbits/sec |
| Packet loss (normal) | 0% |
| Packet loss (failure) | 100% |
| Regression test | ALL PASSED |

## References
1. Mininet Overview - https://mininet.org/overview/
2. Mininet Walkthrough - https://mininet.org/walkthrough/
3. Ryu SDN Framework - https://ryu-sdn.org/
4. OpenFlow Specification - https://opennetworking.org/sdn-resources/openflow/
5. Open vSwitch - https://www.openvswitch.org/