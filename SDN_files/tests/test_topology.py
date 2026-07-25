"""Tests for the pure topology description."""
import pytest

from topology import (
    HOSTS,
    LINKS,
    PORTS,
    SWITCHES,
    build_ports,
    host_by_ip,
    shortest_path,
    switch_graph,
)


def test_every_host_attaches_to_a_declared_switch():
    for name, spec in HOSTS.items():
        assert spec["switch"] in SWITCHES, f"{name} attaches to an unknown switch"


def test_host_addresses_are_unique():
    addresses = [spec["ip"] for spec in HOSTS.values()]
    assert len(set(addresses)) == len(addresses)


def test_links_reference_known_nodes():
    known = set(SWITCHES) | set(HOSTS)
    for a, b in LINKS:
        assert a in known and b in known


def test_port_numbers_are_contiguous_from_one():
    """Mininet numbers ports 1..n per switch; a gap means the map is wrong."""
    for switch, peers in PORTS.items():
        numbers = sorted(peers.values())
        assert numbers == list(range(1, len(numbers) + 1)), switch


def test_port_numbers_are_unique_per_switch():
    for switch, peers in PORTS.items():
        assert len(set(peers.values())) == len(peers), switch


def test_port_map_matches_the_documented_wiring():
    """
    Pinned against the wiring the screenshots and flow dumps were captured
    from. If LINKS is reordered, this is the test that should fail first.
    """
    assert PORTS["s1"] == {"h1": 1, "h2": 2, "s2": 3}
    assert PORTS["s2"] == {"s1": 1, "s3": 2}
    assert PORTS["s3"] == {"h3": 1, "h4": 2, "s2": 3}


def test_build_ports_is_deterministic():
    assert build_ports() == build_ports()


def test_switch_graph_is_connected():
    graph = switch_graph()
    start = next(iter(graph))
    seen, stack = {start}, [start]
    while stack:
        for neighbour in graph[stack.pop()]:
            if neighbour not in seen:
                seen.add(neighbour)
                stack.append(neighbour)
    assert seen == set(SWITCHES), "topology is partitioned"


@pytest.mark.parametrize("src,dst,expected", [
    ("s1", "s1", ["s1"]),
    ("s1", "s2", ["s1", "s2"]),
    ("s1", "s3", ["s1", "s2", "s3"]),
    ("s3", "s1", ["s3", "s2", "s1"]),
])
def test_shortest_path(src, dst, expected):
    assert shortest_path(src, dst) == expected


def test_shortest_path_rejects_unknown_switch():
    with pytest.raises((ValueError, KeyError)):
        shortest_path("s1", "s99")


def test_host_by_ip_round_trips():
    for name, spec in HOSTS.items():
        assert host_by_ip(spec["ip"]) == name


def test_host_by_ip_rejects_unknown_address():
    with pytest.raises(KeyError):
        host_by_ip("10.0.0.99")
