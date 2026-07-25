#!/usr/bin/env python3
"""
benchmark.py — Measure what priority queuing actually buys.

Builds the rate-limited topology, drives controlled background load, fires
timestamped probes marked as each traffic class, and records latency
percentiles with queuing enabled and disabled.

    sudo python3 SDN_files/benchmark.py --out results/qos_benchmark.csv

Requires root, Mininet, Open vSwitch, and iperf3, with the controller already
running:

    ryu-manager --ofp-tcp-listen-port 6633 SDN_files/qos_controller.py

The statistics and parsing live in benchmark_stats.py, which is pure and
covered by tests. This file is only the orchestration, because it cannot run
anywhere without a Linux kernel and root.

Method
------
For each background load level, and with QoS both on and off:

  1. Saturate h2 -> h4 with best-effort iperf3 traffic sized to the target
     fraction of link capacity.
  2. Wait for the queues to fill. Measuring immediately would sample an empty
     buffer and report the uncongested latency for every class.
  3. Ping h1 -> h3 marked with each class's DSCP, collecting per-packet RTTs.
  4. Record p50/p95/p99 and loss.

Background load runs h2 -> h4 while probes run h1 -> h3, so both cross the
same s1-s2-s3 path and contend for the same queues, without the probe
competing against its own load generator for host CPU.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from benchmark_stats import format_report, parse_ping, summarize, to_csv  # noqa: E402
from qos import DEFAULT_LINK_BPS, TRAFFIC_CLASSES  # noqa: E402

DEFAULT_LOADS = [0, 45, 70, 90]
PROBE_COUNT = 40
PROBE_INTERVAL = 0.2  # seconds between probes
QUEUE_FILL_SECONDS = 4


def preflight(skip_root: bool = False) -> str | None:
    """Check we can actually run before spending minutes discovering we cannot."""
    if not skip_root and hasattr(os, "geteuid") and os.geteuid() != 0:
        return "must run as root (sudo python3 SDN_files/benchmark.py)"
    for tool in ("ovs-vsctl", "iperf3"):
        if shutil.which(tool) is None:
            return f"{tool} not found; install it on the Mininet host"
    try:
        import mininet  # noqa: F401
    except ImportError:
        return "mininet not importable; run this on the Mininet host"
    return None


def _run_probe(net, src, dst_ip: str, dscp: int, count: int, interval: float):
    """
    Ping marked with a DSCP codepoint.

    `ping -Q` takes a full ToS byte, so the six-bit DSCP is shifted left by
    two. Getting this wrong silently marks traffic as a different class, which
    is the kind of error that makes a benchmark quietly meaningless.
    """
    tos = dscp << 2
    cmd = f"ping -Q {tos} -c {count} -i {interval} -W 1 {dst_ip}"
    return parse_ping(net.get(src).cmd(cmd))


def _start_background(net, src: str, dst: str, dst_ip: str, load_pct: int, link_bps: int):
    """
    Start best-effort background load at a target fraction of link capacity.

    Returns a stop callable. Marked DSCP 0 so it lands in the best-effort
    queue: the whole point is that clinical traffic should be insulated from
    exactly this.
    """
    if load_pct <= 0:
        return lambda: None

    target = int(link_bps * load_pct / 100)
    server, client = net.get(dst), net.get(src)

    server.cmd("iperf3 -s -D --logfile /dev/null")
    time.sleep(0.5)
    client.cmd(
        f"iperf3 -c {dst_ip} -u -b {target} -t 3600 --dscp 0 "
        f"--logfile /dev/null &"
    )

    def stop():
        client.cmd("pkill -f 'iperf3 -c' || true")
        server.cmd("pkill -f 'iperf3 -s' || true")

    return stop


def run_benchmark(args) -> list[dict]:
    from mininet.log import setLogLevel
    from mininet.net import Mininet
    from mininet.node import RemoteController

    from static_topo import QosTopo

    setLogLevel("warning")

    net = Mininet(
        topo=QosTopo(),
        controller=lambda name: RemoteController(name, ip="127.0.0.1", port=args.port),
        autoSetMacs=True,
    )
    net.start()

    rows: list[dict] = []
    try:
        print("Waiting for the controller to install flows...")
        time.sleep(args.settle)

        if net.pingAll(timeout="1") > 0:
            print("WARNING: baseline connectivity is not clean; results may be noisy.",
                  file=sys.stderr)

        for qos_enabled in (False, True):
            _configure_qos(qos_enabled, args)

            for load in args.loads:
                print(f"\n── QoS {'on' if qos_enabled else 'off'}, "
                      f"background load {load}% " + "─" * 30)

                stop = _start_background(
                    net, "h2", "h4", "10.0.0.4", load, args.link_bps)
                if load > 0:
                    time.sleep(QUEUE_FILL_SECONDS)

                try:
                    for traffic_class in TRAFFIC_CLASSES:
                        result = _run_probe(
                            net, "h1", "10.0.0.3", traffic_class.dscp,
                            args.count, args.interval,
                        )
                        row = summarize(
                            scenario=f"h1->h3 under {load}% load",
                            qos_enabled=qos_enabled,
                            traffic_class=traffic_class.priority,
                            dscp=traffic_class.dscp,
                            background_load_pct=load,
                            result=result,
                        )
                        rows.append(row)
                        print(f"  {traffic_class.priority} "
                              f"({traffic_class.dscp_name:<4}) "
                              f"p50={row['rtt_p50_ms'] or 'n/a':<9} "
                              f"p99={row['rtt_p99_ms'] or 'n/a':<9} "
                              f"loss={row['loss_pct']}%")
                finally:
                    stop()
    finally:
        net.stop()

    return rows


def _configure_qos(enabled: bool, args) -> None:
    """Attach or detach the HTB queues between measurement passes."""
    from qos import build_clear_command, build_qos_command
    from setup_qos import switch_ports

    for port in switch_ports():
        cmd = build_qos_command(port, args.link_bps) if enabled else build_clear_command(port)
        subprocess.run(cmd, capture_output=True, text=True)

    if not enabled:
        for table in ("qos", "queue"):
            subprocess.run(["ovs-vsctl", "--all", "destroy", table],
                           capture_output=True, text=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--out", default="results/qos_benchmark.csv",
                        help="CSV output path")
    parser.add_argument("--loads", type=int, nargs="+", default=DEFAULT_LOADS,
                        help="background load levels, as %% of link capacity")
    parser.add_argument("--count", type=int, default=PROBE_COUNT,
                        help="probes per condition")
    parser.add_argument("--interval", type=float, default=PROBE_INTERVAL,
                        help="seconds between probes")
    parser.add_argument("--link-bps", type=int, default=DEFAULT_LINK_BPS)
    parser.add_argument("--port", type=int, default=6633,
                        help="controller OpenFlow port")
    parser.add_argument("--settle", type=float, default=5.0,
                        help="seconds to wait for flow installation")
    parser.add_argument("--skip-root-check", action="store_true")
    args = parser.parse_args(argv)

    problem = preflight(args.skip_root_check)
    if problem:
        print(f"ERROR: {problem}", file=sys.stderr)
        return 2

    rows = run_benchmark(args)
    if not rows:
        print("No measurements collected.", file=sys.stderr)
        return 1

    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="") as handle:
        handle.write(to_csv(rows))

    print("\n" + format_report(rows))
    print(f"\nWrote {len(rows)} rows to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
