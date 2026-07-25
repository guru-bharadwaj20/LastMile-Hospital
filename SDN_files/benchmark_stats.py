"""
benchmark_stats.py — Parsing and statistics for the QoS benchmark.

Split out from benchmark.py so that everything except actually driving
Mininet is pure and testable. The harness that produces the numbers is worth
no more than the correctness of the code that summarises them, and that code
should not require root and a Linux kernel to verify.

Reports p50, p95 and p99 rather than a mean. The claim this project makes is
about worst-case delivery of a critical alert, and a mean hides exactly the
tail that matters: a stream can average 12 ms and still strand one alert in
400 ms.
"""
from __future__ import annotations

import csv
import io
import math
import re
from dataclasses import dataclass, field

# "64 bytes from 10.0.0.3: icmp_seq=1 ttl=64 time=0.123 ms"
_RTT_RE = re.compile(r"time[=<]\s*([\d.]+)\s*ms")

# "20 packets transmitted, 19 received, 5% packet loss, time 19030ms"
_LOSS_RE = re.compile(
    r"(\d+)\s+packets transmitted,\s*(\d+)\s+received.*?([\d.]+)%\s+packet loss",
    re.DOTALL,
)

CSV_FIELDS = [
    "scenario",
    "qos_enabled",
    "traffic_class",
    "dscp",
    "background_load_pct",
    "samples",
    "loss_pct",
    "rtt_min_ms",
    "rtt_p50_ms",
    "rtt_p95_ms",
    "rtt_p99_ms",
    "rtt_max_ms",
]


@dataclass
class PingResult:
    """Parsed output of a single ping run."""

    rtts: list[float] = field(default_factory=list)
    transmitted: int = 0
    received: int = 0
    loss_pct: float = 0.0

    @property
    def samples(self) -> int:
        return len(self.rtts)


def parse_ping(output: str) -> PingResult:
    """
    Extract per-packet RTTs and the loss summary from ping output.

    Individual samples are collected rather than the min/avg/max summary line,
    because percentiles cannot be recovered from a mean.
    """
    rtts = [float(m) for m in _RTT_RE.findall(output)]

    transmitted = received = 0
    loss = 0.0
    match = _LOSS_RE.search(output)
    if match:
        transmitted = int(match.group(1))
        received = int(match.group(2))
        loss = float(match.group(3))
    elif rtts:
        # No summary line, e.g. output truncated. Infer what we can.
        transmitted = received = len(rtts)

    return PingResult(rtts=rtts, transmitted=transmitted, received=received, loss_pct=loss)


def percentile(values: list[float], pct: float) -> float:
    """
    Nearest-rank percentile.

    Deliberately not linear interpolation: with the small sample counts a
    benchmark run produces, interpolation invents values that were never
    observed, and for a tail-latency claim it is better to report a
    measurement that actually happened.
    """
    if not values:
        raise ValueError("percentile of an empty sample")
    if not 0 < pct <= 100:
        raise ValueError(f"percentile out of range: {pct}")

    ordered = sorted(values)
    rank = math.ceil(pct / 100 * len(ordered))
    return ordered[rank - 1]


def summarize(
    scenario: str,
    qos_enabled: bool,
    traffic_class: str,
    dscp: int,
    background_load_pct: int,
    result: PingResult,
) -> dict:
    """One CSV row describing a single measured condition."""
    if not result.rtts:
        return {
            "scenario": scenario,
            "qos_enabled": qos_enabled,
            "traffic_class": traffic_class,
            "dscp": dscp,
            "background_load_pct": background_load_pct,
            "samples": 0,
            "loss_pct": result.loss_pct or 100.0,
            "rtt_min_ms": "",
            "rtt_p50_ms": "",
            "rtt_p95_ms": "",
            "rtt_p99_ms": "",
            "rtt_max_ms": "",
        }

    return {
        "scenario": scenario,
        "qos_enabled": qos_enabled,
        "traffic_class": traffic_class,
        "dscp": dscp,
        "background_load_pct": background_load_pct,
        "samples": result.samples,
        "loss_pct": round(result.loss_pct, 2),
        "rtt_min_ms": round(min(result.rtts), 3),
        "rtt_p50_ms": round(percentile(result.rtts, 50), 3),
        "rtt_p95_ms": round(percentile(result.rtts, 95), 3),
        "rtt_p99_ms": round(percentile(result.rtts, 99), 3),
        "rtt_max_ms": round(max(result.rtts), 3),
    }


def to_csv(rows: list[dict]) -> str:
    """Render summary rows as CSV, columns in CSV_FIELDS order."""
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_FIELDS, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({field: row.get(field, "") for field in CSV_FIELDS})
    return buffer.getvalue()


def improvement_factor(without_ms: float, with_ms: float) -> float | None:
    """
    How many times faster the QoS-enabled measurement was.

    Returns None rather than infinity when the comparison is undefined, so a
    divide-by-zero cannot silently become a headline number.
    """
    if with_ms <= 0 or without_ms <= 0:
        return None
    return round(without_ms / with_ms, 1)


def format_report(rows: list[dict]) -> str:
    """Readable summary table, plus paired improvement factors where possible."""
    if not rows:
        return "No results."

    header = (
        f"{'Scenario':<22}{'QoS':<6}{'Class':<7}{'Load':<7}"
        f"{'p50':>9}{'p95':>9}{'p99':>9}{'loss':>8}"
    )
    lines = ["=" * len(header), header, "-" * len(header)]

    for row in rows:
        p50 = row["rtt_p50_ms"]
        lines.append(
            f"{row['scenario']:<22}"
            f"{('on' if row['qos_enabled'] else 'off'):<6}"
            f"{row['traffic_class']:<7}"
            f"{str(row['background_load_pct']) + '%':<7}"
            f"{p50 if p50 != '' else 'n/a':>9}"
            f"{row['rtt_p95_ms'] if row['rtt_p95_ms'] != '' else 'n/a':>9}"
            f"{row['rtt_p99_ms'] if row['rtt_p99_ms'] != '' else 'n/a':>9}"
            f"{str(row['loss_pct']) + '%':>8}"
        )

    lines.append("=" * len(header))

    # Pair each QoS-off row with the QoS-on row for the same conditions.
    keyed = {
        (r["scenario"], r["traffic_class"], r["background_load_pct"], r["qos_enabled"]): r
        for r in rows
    }
    comparisons = []
    for (scenario, cls, load, qos), row in keyed.items():
        if qos:
            continue
        paired = keyed.get((scenario, cls, load, True))
        if not paired or row["rtt_p99_ms"] == "" or paired["rtt_p99_ms"] == "":
            continue
        factor = improvement_factor(row["rtt_p99_ms"], paired["rtt_p99_ms"])
        if factor:
            comparisons.append(
                f"  {cls} at {load}% load: p99 {row['rtt_p99_ms']}ms -> "
                f"{paired['rtt_p99_ms']}ms ({factor}x faster)"
            )

    if comparisons:
        lines.append("Improvement at the tail (p99):")
        lines.extend(sorted(comparisons))
        lines.append("=" * len(header))

    return "\n".join(lines)
