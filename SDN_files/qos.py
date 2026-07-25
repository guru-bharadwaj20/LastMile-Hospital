"""
qos.py — Traffic classes, DSCP marks, and Open vSwitch queue configuration.

This is the module that makes P1–P5 real. Until now the priority model
existed only as colours in a browser; here each class is bound to a DSCP
codepoint, an OpenFlow queue id, and an HTB rate guarantee that Open vSwitch
enforces in the data plane.

Pure Python: no Ryu, no Mininet, no subprocess. It emits configuration and
answers questions about it, so the mapping can be tested in CI. Applying it
is setup_qos.py's job.

Why DSCP
--------
Classification has to survive the trip from the sending host to the switch.
DSCP is the standard way to carry that intent in the IP header, it is six
bits every switch already understands, and it lets an endpoint mark its own
traffic (`ping -Q`, `iperf3 --dscp`, or setsockopt IP_TOS) without the
controller needing to know anything about ports or process identity.

The consequence is that classification is only as trustworthy as the
endpoints. See the threat model in docs/ARCHITECTURE.md.
"""
from __future__ import annotations

from dataclasses import dataclass

# Default link capacity for the QoS topology, in bits per second.
# Queues are meaningless on an uncontended link, so the topology variant used
# for benchmarking caps its links to make congestion reachable.
DEFAULT_LINK_BPS = 10_000_000  # 10 Mbit/s


@dataclass(frozen=True)
class TrafficClass:
    """One priority tier, from clinical meaning down to an HTB queue."""

    priority: str
    queue_id: int
    dscp: int
    dscp_name: str
    #: Guaranteed share of the link, as a percentage. Sums to 100 across all
    #: classes, so every tier keeps a floor even when the link is saturated.
    min_share: int
    #: Ceiling as a percentage. P1 may burst to the whole link; background
    #: traffic is capped so it cannot crowd out clinical traffic.
    max_share: int
    #: Linux HTB priority band. Lower is served first.
    htb_priority: int
    description: str

    def min_rate(self, link_bps: int = DEFAULT_LINK_BPS) -> int:
        return link_bps * self.min_share // 100

    def max_rate(self, link_bps: int = DEFAULT_LINK_BPS) -> int:
        return link_bps * self.max_share // 100


# Shares mirror the congested bandwidth allocation the dashboard displays, so
# the simulation and the enforced policy describe the same thing.
TRAFFIC_CLASSES: tuple[TrafficClass, ...] = (
    TrafficClass(
        priority="P1", queue_id=0, dscp=46, dscp_name="EF",
        min_share=35, max_share=100, htb_priority=0,
        description="Cardiac arrest, Code Blue, crash cart",
    ),
    TrafficClass(
        priority="P2", queue_id=1, dscp=34, dscp_name="AF41",
        min_share=25, max_share=80, htb_priority=1,
        description="ICU vitals, ventilator alarms, surgical monitoring",
    ),
    TrafficClass(
        priority="P3", queue_id=2, dscp=26, dscp_name="AF31",
        min_share=20, max_share=60, htb_priority=2,
        description="Lab results, imaging metadata, pharmacy orders",
    ),
    TrafficClass(
        priority="P4", queue_id=3, dscp=18, dscp_name="AF21",
        min_share=12, max_share=40, htb_priority=3,
        description="Administrative uploads, EMR sync, reports",
    ),
    TrafficClass(
        priority="P5", queue_id=4, dscp=0, dscp_name="BE",
        min_share=8, max_share=25, htb_priority=4,
        description="Staff WiFi, visitor internet, software updates",
    ),
)

BY_PRIORITY: dict[str, TrafficClass] = {c.priority: c for c in TRAFFIC_CLASSES}
BY_DSCP: dict[int, TrafficClass] = {c.dscp: c for c in TRAFFIC_CLASSES}
BY_QUEUE: dict[int, TrafficClass] = {c.queue_id: c for c in TRAFFIC_CLASSES}

#: Traffic arriving without a recognised mark is treated as best effort.
DEFAULT_CLASS = BY_PRIORITY["P5"]


def classify(dscp: int) -> TrafficClass:
    """Traffic class for a DSCP codepoint, falling back to best effort."""
    return BY_DSCP.get(dscp, DEFAULT_CLASS)


def queue_for(priority: str) -> int:
    """OpenFlow queue id for a priority label."""
    return BY_PRIORITY[priority].queue_id


def build_qos_command(port: str, link_bps: int = DEFAULT_LINK_BPS) -> list[str]:
    """
    ovs-vsctl argument vector that attaches an HTB QoS record with one queue
    per traffic class to `port`.

    Built as a list rather than a shell string so it can be handed straight to
    subprocess without quoting concerns.
    """
    queue_refs = ",".join(f"{c.queue_id}=@q{c.queue_id}" for c in TRAFFIC_CLASSES)

    args = [
        "ovs-vsctl",
        "set", "port", port, "qos=@newqos",
        "--",
        "--id=@newqos", "create", "qos", "type=linux-htb",
        f"other-config:max-rate={link_bps}",
        f"queues:{queue_refs}",
    ]

    for c in TRAFFIC_CLASSES:
        args += [
            "--",
            f"--id=@q{c.queue_id}", "create", "queue",
            f"other-config:min-rate={c.min_rate(link_bps)}",
            f"other-config:max-rate={c.max_rate(link_bps)}",
            f"other-config:priority={c.htb_priority}",
        ]

    return args


def build_clear_command(port: str) -> list[str]:
    """Detach QoS from a port. Orphaned queue records are cleaned separately."""
    return ["ovs-vsctl", "clear", "port", port, "qos"]


def describe() -> str:
    """Human readable policy table."""
    width = 92
    lines = [
        "=" * width,
        f"{'Class':<6}{'Queue':<7}{'DSCP':<14}{'Min':<7}{'Max':<7}{'Band':<6}Description",
        "-" * width,
    ]
    for c in TRAFFIC_CLASSES:
        lines.append(
            f"{c.priority:<6}q{c.queue_id:<6}"
            f"{c.dscp_name + ' (' + str(c.dscp) + ')':<14}"
            f"{str(c.min_share) + '%':<7}{str(c.max_share) + '%':<7}"
            f"{c.htb_priority:<6}{c.description}"
        )
    lines.append("=" * width)
    lines.append(
        f"Link capacity {DEFAULT_LINK_BPS / 1_000_000:.0f} Mbit/s; "
        f"guaranteed shares total {sum(c.min_share for c in TRAFFIC_CLASSES)}%."
    )
    return "\n".join(lines)


if __name__ == "__main__":
    print(describe())
