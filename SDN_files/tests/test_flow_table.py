"""
Tests for the derived forwarding table.

The important property is reachability: every ordered host pair must have a
complete forwarding path, with no blackholes and no rule that would send a
packet back out the port it arrived on.
"""
import itertools

import pytest

from flow_table import STATIC_FLOWS, build_flow_table
from topology import HOSTS, PORTS, SWITCHES, shortest_path

# The table as it was hand-written in the controller before it was derived.
# Order is irrelevant; this is compared as a set.
ORIGINAL_TABLE = {
    1: [
        (1, "10.0.0.3", 3), (1, "10.0.0.4", 3), (2, "10.0.0.3", 3),
        (2, "10.0.0.4", 3), (3, "10.0.0.1", 1), (3, "10.0.0.2", 2),
        (1, "10.0.0.2", 2), (2, "10.0.0.1", 1),
    ],
    2: [
        (1, "10.0.0.3", 2), (1, "10.0.0.4", 2),
        (2, "10.0.0.1", 1), (2, "10.0.0.2", 1),
    ],
    3: [
        (3, "10.0.0.3", 1), (3, "10.0.0.4", 2), (1, "10.0.0.1", 3),
        (1, "10.0.0.2", 3), (2, "10.0.0.1", 3), (2, "10.0.0.2", 3),
        (1, "10.0.0.4", 2), (2, "10.0.0.3", 1),
    ],
}


def as_tuples(rules):
    return {(r["in_port"], r["ipv4_dst"], r["out_port"]) for r in rules}


def test_derivation_reproduces_the_original_hand_written_table():
    """
    The table was replaced by a derivation. This pins the result to the rules
    the captured ping, iperf and flow-dump evidence was produced with, so the
    refactor cannot silently change forwarding behaviour.
    """
    for dpid, expected in ORIGINAL_TABLE.items():
        assert as_tuples(STATIC_FLOWS[dpid]) == set(expected), f"dpid {dpid}"


def test_covers_every_switch():
    assert set(STATIC_FLOWS) == set(SWITCHES.values())


def test_no_duplicate_matches():
    """
    Two rules with the same (in_port, ipv4_dst) at equal priority make
    forwarding depend on installation order.
    """
    for dpid, rules in STATIC_FLOWS.items():
        matches = [(r["in_port"], r["ipv4_dst"]) for r in rules]
        assert len(set(matches)) == len(matches), f"dpid {dpid} has ambiguous rules"


def test_no_rule_forwards_back_out_its_ingress_port():
    for dpid, rules in STATIC_FLOWS.items():
        for rule in rules:
            assert rule["in_port"] != rule["out_port"], f"dpid {dpid}: {rule}"


def test_all_ports_are_real():
    dpid_to_switch = {dpid: name for name, dpid in SWITCHES.items()}
    for dpid, rules in STATIC_FLOWS.items():
        valid = set(PORTS[dpid_to_switch[dpid]].values())
        for rule in rules:
            assert rule["in_port"] in valid
            assert rule["out_port"] in valid


def test_all_destinations_are_real_hosts():
    addresses = {spec["ip"] for spec in HOSTS.values()}
    for rules in STATIC_FLOWS.values():
        for rule in rules:
            assert rule["ipv4_dst"] in addresses


def _forward(src_host, dst_ip):
    """
    Walk the table the way a packet would, returning the host it is delivered
    to. Raises on a blackhole or a loop.
    """
    switch = HOSTS[src_host]["switch"]
    in_port = PORTS[switch][src_host]
    hops = 0

    while True:
        hops += 1
        if hops > len(SWITCHES) + 1:
            raise AssertionError(f"loop forwarding {src_host} -> {dst_ip}")

        rules = STATIC_FLOWS[SWITCHES[switch]]
        match = next(
            (r for r in rules if r["in_port"] == in_port and r["ipv4_dst"] == dst_ip),
            None,
        )
        if match is None:
            raise AssertionError(
                f"blackhole: no rule on {switch} for in_port={in_port} dst={dst_ip}"
            )

        out_port = match["out_port"]
        peer = next(p for p, port in PORTS[switch].items() if port == out_port)

        if peer in HOSTS:
            return peer

        in_port = PORTS[peer][switch]
        switch = peer


@pytest.mark.parametrize("src,dst", [
    pair for pair in itertools.permutations(sorted(HOSTS), 2)
])
def test_every_ordered_host_pair_is_reachable(src, dst):
    assert _forward(src, HOSTS[dst]["ip"]) == dst


@pytest.mark.parametrize("src,dst", [
    pair for pair in itertools.permutations(sorted(HOSTS), 2)
])
def test_paths_are_shortest(src, dst):
    """Traffic should not take a detour through an extra switch."""
    src_switch = HOSTS[src]["switch"]
    dst_switch = HOSTS[dst]["switch"]
    expected_hops = len(shortest_path(src_switch, dst_switch))

    switch, in_port, hops = src_switch, PORTS[src_switch][src], 0
    while True:
        hops += 1
        rules = STATIC_FLOWS[SWITCHES[switch]]
        match = next(
            r for r in rules
            if r["in_port"] == in_port and r["ipv4_dst"] == HOSTS[dst]["ip"]
        )
        peer = next(p for p, port in PORTS[switch].items() if port == match["out_port"])
        if peer in HOSTS:
            break
        in_port, switch = PORTS[peer][switch], peer

    assert hops == expected_hops


def test_build_is_deterministic():
    assert build_flow_table() == build_flow_table()


def test_rule_count_matches_expectation():
    # Per switch: for each of 4 hosts, one rule per ingress port except the
    # egress port itself, so 4 * (ports - 1).
    for name, dpid in SWITCHES.items():
        expected = len(HOSTS) * (len(PORTS[name]) - 1)
        assert len(STATIC_FLOWS[dpid]) == expected, name
