#!/usr/bin/env python3
"""
setup_qos.py — Create the Open vSwitch HTB queues the controller selects.

OpenFlow can only pick a queue by id; it cannot create one. The queues, their
rate guarantees and their HTB priority bands are Open vSwitch configuration,
applied here with ovs-vsctl.

Run on the Mininet host after the topology is up:

    sudo python3 SDN_files/setup_qos.py apply
    sudo python3 SDN_files/setup_qos.py show
    sudo python3 SDN_files/setup_qos.py clear

Requires root, because ovs-vsctl talks to the local Open vSwitch database.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qos import (  # noqa: E402
    DEFAULT_LINK_BPS,
    TRAFFIC_CLASSES,
    build_clear_command,
    build_qos_command,
    describe,
)
from topology import PORTS, SWITCHES  # noqa: E402


def switch_ports() -> list[str]:
    """
    Every switch-side interface, named the way Mininet names them:
    <switch>-eth<port>. Queues are attached per egress port.
    """
    names = []
    for switch in SWITCHES:
        for port in sorted(PORTS[switch].values()):
            names.append(f"{switch}-eth{port}")
    return names


def run(cmd: list[str], dry_run: bool) -> int:
    if dry_run:
        print(" ".join(cmd))
        return 0

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ERROR: {' '.join(cmd[:4])}... -> {result.stderr.strip()}", file=sys.stderr)
    return result.returncode


def require_tooling(dry_run: bool) -> str | None:
    if dry_run:
        return None
    if shutil.which("ovs-vsctl") is None:
        return "ovs-vsctl not found; this must run on the Mininet host."
    if hasattr(os, "geteuid") and os.geteuid() != 0:
        return "must run as root (try: sudo python3 SDN_files/setup_qos.py apply)"
    return None


def cmd_apply(args) -> int:
    problem = require_tooling(args.dry_run)
    if problem:
        print(f"ERROR: {problem}", file=sys.stderr)
        return 2

    ports = switch_ports()
    print(f"Applying HTB queues to {len(ports)} ports at "
          f"{args.link_bps / 1_000_000:.0f} Mbit/s\n")
    print(describe())
    print()

    failures = 0
    for port in ports:
        rc = run(build_qos_command(port, args.link_bps), args.dry_run)
        status = "ok" if rc == 0 else "FAILED"
        print(f"  {port:<12} {status}")
        failures += rc != 0

    if failures:
        print(f"\n{failures} port(s) failed.", file=sys.stderr)
        return 1

    print(f"\nQueues applied. Mark traffic with the DSCP values above, e.g.\n"
          f"  ping -Q {TRAFFIC_CLASSES[0].dscp << 2} 10.0.0.3   "
          f"# {TRAFFIC_CLASSES[0].priority} ({TRAFFIC_CLASSES[0].dscp_name})\n"
          f"  iperf3 -c 10.0.0.3 --dscp {TRAFFIC_CLASSES[4].dscp}         "
          f"# {TRAFFIC_CLASSES[4].priority} background load")
    return 0


def cmd_clear(args) -> int:
    problem = require_tooling(args.dry_run)
    if problem:
        print(f"ERROR: {problem}", file=sys.stderr)
        return 2

    for port in switch_ports():
        run(build_clear_command(port), args.dry_run)
        print(f"  cleared {port}")

    # Detaching leaves the qos and queue rows behind; without this they
    # accumulate every time the topology restarts.
    for table in ("qos", "queue"):
        run(["ovs-vsctl", "--all", "destroy", table], args.dry_run)
    print("\nQoS records destroyed.")
    return 0


def cmd_show(args) -> int:
    if args.dry_run or shutil.which("ovs-vsctl") is None:
        print(describe())
        return 0

    for port in switch_ports():
        result = subprocess.run(
            ["ovs-vsctl", "list", "qos", port],
            capture_output=True, text=True,
        )
        print(f"── {port} " + "─" * 40)
        print(result.stdout.strip() or "  (no QoS attached)")
    return 0


def main(argv: list[str] | None = None) -> int:
    # Shared flags are attached to each subcommand rather than to the top
    # level parser. Attaching them to both looks tempting, but a subparser's
    # own default silently overwrites whatever the parent already parsed, so
    # `--dry-run apply` would set dry_run back to False and really talk to
    # Open vSwitch. Subcommand-scoped flags are also the convention users
    # expect from git, docker and kubectl.
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--dry-run", action="store_true",
                        help="print the ovs-vsctl commands instead of running them")
    common.add_argument("--link-bps", type=int, default=DEFAULT_LINK_BPS,
                        help=f"link capacity in bits/sec (default {DEFAULT_LINK_BPS})")

    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("apply", parents=[common], help="create and attach the queues")
    sub.add_parser("clear", parents=[common], help="detach queues and destroy the records")
    sub.add_parser("show", parents=[common],
                   help="show the policy, or what is currently attached")

    args = parser.parse_args(argv)
    return {"apply": cmd_apply, "clear": cmd_clear, "show": cmd_show}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
