"""
topology.py — Pure description of the LastMile test network.

No Mininet or Ryu import, so this can be reasoned about, tested, and used by
tooling on any machine. static_topo.py builds the Mininet topology from it and
flow_table.py derives the forwarding rules from it.

    H1 (10.0.0.1) --|         |-- H3 (10.0.0.3)
                    S1 -- S2 -- S3
    H2 (10.0.0.2) --|         |-- H4 (10.0.0.4)
"""
from __future__ import annotations

from collections import deque

# Switch name -> OpenFlow datapath id. Mininet numbers them in creation order.
SWITCHES: dict[str, int] = {"s1": 1, "s2": 2, "s3": 3}

# Host name -> (IP address, attached switch)
HOSTS: dict[str, dict[str, str]] = {
    "h1": {"ip": "10.0.0.1", "switch": "s1"},
    "h2": {"ip": "10.0.0.2", "switch": "s1"},
    "h3": {"ip": "10.0.0.3", "switch": "s3"},
    "h4": {"ip": "10.0.0.4", "switch": "s3"},
}

# Links in the order Mininet adds them. Order is significant: switch port
# numbers are assigned sequentially as links are attached, so this list is
# what makes the derived port map match the live topology.
LINKS: list[tuple[str, str]] = [
    ("h1", "s1"),
    ("h2", "s1"),
    ("h3", "s3"),
    ("h4", "s3"),
    ("s1", "s2"),
    ("s2", "s3"),
]

NETMASK = "/24"


def build_ports() -> dict[str, dict[str, int]]:
    """
    Assign switch port numbers exactly as Mininet does: walking the link list
    in order, each new attachment on a switch takes the next free port.

    Returns {switch: {peer_name: port}}.
    """
    ports: dict[str, dict[str, int]] = {sw: {} for sw in SWITCHES}
    counters: dict[str, int] = {sw: 0 for sw in SWITCHES}

    for a, b in LINKS:
        for near, far in ((a, b), (b, a)):
            if near in SWITCHES:
                counters[near] += 1
                ports[near][far] = counters[near]

    return ports


PORTS = build_ports()


def switch_graph() -> dict[str, set[str]]:
    """Adjacency between switches only."""
    graph: dict[str, set[str]] = {sw: set() for sw in SWITCHES}
    for a, b in LINKS:
        if a in SWITCHES and b in SWITCHES:
            graph[a].add(b)
            graph[b].add(a)
    return graph


def shortest_path(src: str, dst: str) -> list[str]:
    """
    Breadth-first shortest path between two switches, inclusive of both ends.
    Raises if the topology is partitioned.
    """
    if src == dst:
        return [src]

    graph = switch_graph()
    queue = deque([[src]])
    seen = {src}

    while queue:
        path = queue.popleft()
        for neighbour in sorted(graph[path[-1]]):
            if neighbour in seen:
                continue
            extended = path + [neighbour]
            if neighbour == dst:
                return extended
            seen.add(neighbour)
            queue.append(extended)

    raise ValueError(f"no path from {src} to {dst}")


def host_by_ip(ip: str) -> str:
    """Host name owning an IP address."""
    for name, spec in HOSTS.items():
        if spec["ip"] == ip:
            return name
    raise KeyError(ip)
