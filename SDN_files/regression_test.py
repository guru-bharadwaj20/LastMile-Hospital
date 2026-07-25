#!/usr/bin/env python3
"""
Regression test: verify static routes are restored identically after the
controller reinstalls them.

Deletes every flow, bounces the controller connection, waits for the rules to
come back, and compares the tables against what was recorded beforehand.

Must run on the Mininet host, with the topology up and the controller
running:

    mininet> sh python3 regression_test.py

Exits non-zero on failure so it can gate CI or a pre-commit hook.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time

DEFAULT_SWITCHES = ["s1", "s2", "s3"]
DEFAULT_CONTROLLER = "tcp:127.0.0.1:6633"

# Fields that legitimately change between dumps and must not be compared.
VOLATILE_PREFIXES = ("n_packets", "n_bytes", "duration", "cookie", "idle_age", "hard_age")


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def get_flows(switch: str) -> list[str]:
    """Normalised, sorted flow rules for a switch."""
    result = run(["ovs-ofctl", "-O", "OpenFlow13", "dump-flows", switch])
    if result.returncode != 0:
        raise RuntimeError(
            f"dump-flows failed for {switch}: {result.stderr.strip() or 'unknown error'}"
        )

    lines = []
    for line in result.stdout.splitlines():
        cleaned = " ".join(
            word for word in line.split()
            if not word.startswith(VOLATILE_PREFIXES)
        ).strip()
        if cleaned:
            lines.append(cleaned)
    return sorted(lines)


def wait_for_flows(switch: str, expected: int, timeout: float, interval: float = 0.5) -> bool:
    """
    Poll until the switch reports at least `expected` rules.

    Polling rather than a fixed sleep: the original fixed five second wait was
    both slower than necessary and prone to failing on a loaded machine.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            if len(get_flows(switch)) >= expected:
                return True
        except RuntimeError:
            pass
        time.sleep(interval)
    return False


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--switches", nargs="+", default=DEFAULT_SWITCHES)
    parser.add_argument("--controller", default=DEFAULT_CONTROLLER)
    parser.add_argument("--timeout", type=float, default=15.0,
                        help="seconds to wait for flow reinstall")
    args = parser.parse_args(argv)

    print("=" * 58)
    print("  REGRESSION TEST: Static Route Stability")
    print("=" * 58)

    print("\n[1] Recording original flow tables...")
    try:
        original = {sw: get_flows(sw) for sw in args.switches}
    except RuntimeError as exc:
        print(f"  ERROR: {exc}")
        print("  Is the Mininet topology running? Run this from the Mininet CLI.")
        return 2

    for sw, flows in original.items():
        print(f"  {sw}: {len(flows)} rules recorded")

    if not any(original.values()):
        print("  ERROR: no flows found on any switch; nothing to test.")
        return 2

    print("\n[2] Deleting all flow rules...")
    for sw in args.switches:
        run(["ovs-ofctl", "-O", "OpenFlow13", "del-flows", sw])
        print(f"  Deleted flows on {sw}")

    print("\n[3] Bouncing the controller connection...")
    for sw in args.switches:
        run(["ovs-vsctl", "del-controller", sw])
        run(["ovs-vsctl", "set-controller", sw, args.controller])

    print(f"  Waiting up to {args.timeout:.0f}s for reinstall...")
    for sw in args.switches:
        if not wait_for_flows(sw, len(original[sw]), args.timeout):
            print(f"  TIMEOUT: {sw} did not return to {len(original[sw])} rules")
            return 1

    print("\n[4] Comparing flow tables...")
    failed = []
    for sw in args.switches:
        current = get_flows(sw)
        if current == original[sw]:
            print(f"  {sw}: PASS — {len(current)} rules identical")
        else:
            failed.append(sw)
            print(f"  {sw}: FAIL — flows differ")
            for line in sorted(set(original[sw]) - set(current)):
                print(f"      missing: {line}")
            for line in sorted(set(current) - set(original[sw])):
                print(f"      unexpected: {line}")

    print("\n" + "=" * 58)
    if failed:
        print(f"  RESULT: FAILED on {', '.join(failed)}")
        print("=" * 58)
        return 1

    print("  RESULT: ALL TESTS PASSED")
    print("=" * 58)
    return 0


if __name__ == "__main__":
    sys.exit(main())
