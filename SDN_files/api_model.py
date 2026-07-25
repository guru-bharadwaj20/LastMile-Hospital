"""
api_model.py — Payload construction for the controller REST API.

Pure: takes counters in, returns JSON-serialisable dictionaries out. No Ryu,
no sockets, no clock beyond what the caller supplies. rest_api.py handles the
OpenFlow and HTTP; everything decided here is testable.

An honest note about the mapping
--------------------------------
The dashboard draws seven hospital departments and a server. The emulated
topology has four hosts. HOST_ROLES therefore maps a handful of emulated
hosts onto department names purely so live counters have somewhere to land;
it is a demonstration mapping, not a claim that the test network is a
hospital. Departments with no corresponding host are reported as
`represented: false` so the UI can show them as unmodelled rather than
implying live data exists for them.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qos import TRAFFIC_CLASSES  # noqa: E402
from topology import HOSTS, PORTS, SWITCHES  # noqa: E402

API_VERSION = "1.0"

#: Emulated host -> department name the dashboard draws.
HOST_ROLES: dict[str, str] = {
    "h1": "ICU",
    "h2": "RADIOLOGY",
    "h3": "SERVER",
    "h4": "STAFF",
}

#: Every department the dashboard knows about, in draw order.
DASHBOARD_DEPARTMENTS = (
    "ICU", "ER", "SURGERY", "RADIOLOGY", "PHARMACY", "ADMIN", "STAFF", "SERVER",
)


def policy_payload() -> dict:
    """The QoS policy, so the UI can render classes it did not hardcode."""
    return {
        "version": API_VERSION,
        "classes": [
            {
                "priority": c.priority,
                "queueId": c.queue_id,
                "dscp": c.dscp,
                "dscpName": c.dscp_name,
                "minShare": c.min_share,
                "maxShare": c.max_share,
                "htbPriority": c.htb_priority,
                "description": c.description,
            }
            for c in TRAFFIC_CLASSES
        ],
    }


def topology_payload() -> dict:
    """Switches, hosts, links and the department mapping."""
    return {
        "version": API_VERSION,
        "switches": [
            {"name": name, "dpid": dpid, "ports": PORTS[name]}
            for name, dpid in SWITCHES.items()
        ],
        "hosts": [
            {
                "name": name,
                "ip": spec["ip"],
                "switch": spec["switch"],
                "department": HOST_ROLES.get(name),
            }
            for name, spec in HOSTS.items()
        ],
        "departments": [
            {"name": dept, "represented": dept in HOST_ROLES.values()}
            for dept in DASHBOARD_DEPARTMENTS
        ],
    }


def link_utilisation(tx_bytes_delta: int, seconds: float, link_bps: int) -> float:
    """
    Percentage of link capacity consumed, clamped to 0..100.

    Derived from a byte delta over a known interval rather than from a
    cumulative counter, because cumulative counters only tell you what the
    port has ever done, not what it is doing.
    """
    if seconds <= 0 or link_bps <= 0:
        return 0.0
    bits_per_second = (tx_bytes_delta * 8) / seconds
    return round(max(0.0, min(100.0, bits_per_second / link_bps * 100)), 2)


def queue_stats_payload(
    queue_counters: dict[int, dict],
    previous: dict[int, dict] | None = None,
    seconds: float = 1.0,
) -> list[dict]:
    """
    Per-queue transmit counters, joined onto the traffic classes.

    `queue_counters` is {queue_id: {"tx_bytes": int, "tx_packets": int,
    "tx_errors": int}}. When `previous` is supplied the deltas are reported
    too, which is what makes a rate meaningful.
    """
    rows = []
    for c in TRAFFIC_CLASSES:
        current = queue_counters.get(c.queue_id, {})
        tx_bytes = int(current.get("tx_bytes", 0))
        tx_packets = int(current.get("tx_packets", 0))
        tx_errors = int(current.get("tx_errors", 0))

        row = {
            "priority": c.priority,
            "queueId": c.queue_id,
            "dscp": c.dscp,
            "txBytes": tx_bytes,
            "txPackets": tx_packets,
            "txErrors": tx_errors,
            "minShare": c.min_share,
        }

        if previous is not None:
            prior = previous.get(c.queue_id, {})
            # Counters reset when a switch reconnects; a negative delta means
            # that happened, and reporting it as a huge negative rate would be
            # worse than reporting nothing.
            delta_bytes = tx_bytes - int(prior.get("tx_bytes", 0))
            row["txBytesDelta"] = max(0, delta_bytes)
            row["bitsPerSecond"] = (
                round(max(0, delta_bytes) * 8 / seconds, 1) if seconds > 0 else 0.0
            )

        rows.append(row)

    return rows


def observed_shares(queue_rows: list[dict]) -> dict[str, float]:
    """
    Share of transmitted bytes each class actually received.

    This is the number worth showing next to the configured guarantee: the
    policy says P1 gets at least 35%, and this says what it got.
    """
    total = sum(row.get("txBytesDelta", row.get("txBytes", 0)) for row in queue_rows)
    if total <= 0:
        return {row["priority"]: 0.0 for row in queue_rows}

    return {
        row["priority"]: round(
            row.get("txBytesDelta", row.get("txBytes", 0)) / total * 100, 1
        )
        for row in queue_rows
    }


def status_payload(
    *,
    connected_switches: list[int],
    queue_rows: list[dict],
    network_load: float,
    qos_active: bool,
    timestamp: float,
) -> dict:
    """The snapshot the dashboard polls, or receives over the event stream."""
    return {
        "version": API_VERSION,
        "timestamp": timestamp,
        "source": "controller",
        "qosActive": qos_active,
        "connectedSwitches": sorted(connected_switches),
        "expectedSwitches": sorted(SWITCHES.values()),
        "networkLoad": round(network_load, 2),
        "queues": queue_rows,
        "observedShares": observed_shares(queue_rows),
    }


def event_payload(kind: str, label: str, timestamp: float,
                  priority: str | None = None) -> dict:
    """One entry for the dashboard's event log."""
    return {
        "version": API_VERSION,
        "timestamp": timestamp,
        "kind": kind,
        "priority": priority,
        "label": label,
    }
