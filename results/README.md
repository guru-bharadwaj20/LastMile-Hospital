# Benchmark Results

**This directory is empty of measurements.** It holds the schema and the
instructions for producing them, nothing more.

That is deliberate. Earlier versions of this project published latency figures
that were hardcoded constants in a browser simulation, presented as though
they had been benchmarked. Rather than replace them with a different set of
invented numbers, the apparatus is committed and the results table stays
explicitly empty until someone runs it on real switches.

## Producing results

Requires a Linux host with Mininet, Open vSwitch, `iperf3`, and root. See
[`../SDN_files/README.md`](../SDN_files/README.md) for setup.

```bash
# Terminal 1 — QoS controller
source ~/ryu-env/bin/activate
ryu-manager --ofp-tcp-listen-port 6633 SDN_files/qos_controller.py

# Terminal 2 — run the benchmark (builds its own topology)
sudo python3 SDN_files/benchmark.py --out results/qos_benchmark.csv

# Fold the numbers into the README
python3 SDN_files/report_results.py results/qos_benchmark.csv --update-readme
```

The last step rewrites the region between `<!-- BENCHMARK:START -->` and
`<!-- BENCHMARK:END -->` in the root README. Nothing is transcribed by hand,
which is how the original figures drifted from reality in the first place.

## CSV schema

`qos_benchmark.csv`, one row per measured condition:

| Column | Type | Meaning |
|---|---|---|
| `scenario` | string | Human readable description, e.g. `h1->h3 under 90% load` |
| `qos_enabled` | bool | Whether HTB queues were attached for this pass |
| `traffic_class` | string | `P1`–`P5` |
| `dscp` | int | DiffServ codepoint the probe was marked with |
| `background_load_pct` | int | Offered background load, as a percentage of link capacity |
| `samples` | int | Probes that returned; 0 means every probe was lost |
| `loss_pct` | float | Packet loss for this condition |
| `rtt_min_ms` | float | Fastest observed round trip |
| `rtt_p50_ms` | float | Median |
| `rtt_p95_ms` | float | 95th percentile |
| `rtt_p99_ms` | float | 99th percentile |
| `rtt_max_ms` | float | Slowest observed round trip |

Latency columns are empty when `samples` is 0.

## Why percentiles rather than an average

The claim this project makes is about the worst case delivery of a critical
alert, and an average hides precisely the tail that matters. A stream can
average 12 ms and still strand one alert at 400 ms; the alert that arrives
late is the one with clinical consequences, so p99 is the number worth
quoting.

Percentiles are nearest-rank, not interpolated. At the sample counts a
benchmark run produces, interpolation invents values that were never
observed, and a tail-latency claim should rest on a measurement that actually
happened.

## What a run does and does not establish

Establishes:

- Whether HTB queues change latency for marked traffic under contention
- The relative behaviour of P1–P5 as offered load rises
- Whether background traffic can starve clinical traffic under this policy

Does not establish:

- Anything about real hospital hardware. These are emulated links on one
  machine, with Linux `tc` shaping standing in for switch ASICs.
- Anything about scale. Four hosts and three switches is a demonstration
  topology, not a hospital campus.
- Anything about endpoints that mark their own traffic dishonestly. See the
  threat model in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
