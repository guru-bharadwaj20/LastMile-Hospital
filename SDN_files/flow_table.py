"""
flow_table.py — Derives the static forwarding rules from the topology.

Previously these twenty rules were a hand-maintained literal in the
controller. Every port number was transcribed by hand, which meant any change
to the topology required silently re-deriving them all, and a single wrong
digit produced a blackhole that only showed up as a failed ping.

Deriving them makes the topology the single source of truth, and makes the
result testable without Ryu or Mininet installed.

Rule shape matches what the controller installs:

    {"in_port": int, "ipv4_dst": str, "out_port": int}
"""
from __future__ import annotations

import os
import sys

# ryu-manager and `sudo mn --custom` are typically invoked from the repository
# root, not from this directory, so make sibling modules importable either way.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from topology import HOSTS, PORTS, SWITCHES, shortest_path  # noqa: E402

# Rules are installed above the table-miss entry, which sits at priority 0.
FLOW_PRIORITY = 100


def _egress_port(switch: str, dst_host: str) -> int:
    """
    Port on `switch` that traffic for `dst_host` should leave by: the host
    itself if directly attached, otherwise the link toward the next switch on
    the shortest path.
    """
    dst_switch = HOSTS[dst_host]["switch"]

    if switch == dst_switch:
        return PORTS[switch][dst_host]

    path = shortest_path(switch, dst_switch)
    next_hop = path[1]
    return PORTS[switch][next_hop]


def build_flow_table() -> dict[int, list[dict]]:
    """
    Full forwarding table, keyed by datapath id.

    For every switch and every destination host, one rule per ingress port,
    excluding the port the traffic would leave by. Emitting a rule that sends
    a packet back out the port it arrived on would be a loop, and OpenFlow
    drops such actions anyway unless OFPP_IN_PORT is used explicitly.
    """
    table: dict[int, list[dict]] = {}

    for switch, dpid in SWITCHES.items():
        rules: list[dict] = []
        all_ports = sorted(PORTS[switch].values())

        for host, spec in sorted(HOSTS.items()):
            out_port = _egress_port(switch, host)
            for in_port in all_ports:
                if in_port == out_port:
                    continue
                rules.append({
                    "in_port": in_port,
                    "ipv4_dst": spec["ip"],
                    "out_port": out_port,
                })

        table[dpid] = rules

    return table


STATIC_FLOWS = build_flow_table()


def describe() -> str:
    """Human readable dump, useful when comparing against dump-flows output."""
    lines = []
    for switch, dpid in SWITCHES.items():
        lines.append(f"{switch} (dpid={dpid}) — {len(STATIC_FLOWS[dpid])} rules")
        for rule in STATIC_FLOWS[dpid]:
            lines.append(
                f"  in_port={rule['in_port']} "
                f"ipv4_dst={rule['ipv4_dst']} -> out_port={rule['out_port']}"
            )
    return "\n".join(lines)


if __name__ == "__main__":
    print(describe())
