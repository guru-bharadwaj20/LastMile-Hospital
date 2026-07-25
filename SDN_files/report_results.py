#!/usr/bin/env python3
"""
report_results.py — Turn benchmark CSV into the README's results table.

The original performance figures in this project were hand-typed into the
README and drifted from anything measurable. This closes that loop: the table
is generated from the CSV that benchmark.py produced, and written between
markers in the README, so a number can only appear in the documentation if a
measurement produced it.

    python3 SDN_files/report_results.py results/qos_benchmark.csv
    python3 SDN_files/report_results.py results/qos_benchmark.csv --update-readme

The README carries:

    <!-- BENCHMARK:START -->
    ...generated...
    <!-- BENCHMARK:END -->
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from benchmark_stats import improvement_factor  # noqa: E402

START_MARKER = "<!-- BENCHMARK:START -->"
END_MARKER = "<!-- BENCHMARK:END -->"

PLACEHOLDER = (
    "_No benchmark results recorded yet._\n\n"
    "Run the harness on a Mininet host and regenerate this section:\n\n"
    "```bash\n"
    "sudo python3 SDN_files/benchmark.py --out results/qos_benchmark.csv\n"
    "python3 SDN_files/report_results.py results/qos_benchmark.csv --update-readme\n"
    "```\n"
)


def load_rows(path: str) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _num(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_markdown(rows: list[dict], source: str) -> str:
    """Render the measured results as a Markdown section."""
    if not rows:
        return PLACEHOLDER

    lines: list[str] = []
    loads = sorted({int(r["background_load_pct"]) for r in rows})

    lines.append(
        "| Traffic class | Background load | p50 without QoS | p50 with QoS "
        "| p99 without QoS | p99 with QoS | p99 improvement |"
    )
    lines.append("|---|---|---|---|---|---|---|")

    indexed = {
        (r["traffic_class"], int(r["background_load_pct"]),
         str(r["qos_enabled"]).lower() in ("true", "1", "yes")): r
        for r in rows
    }

    classes = sorted({r["traffic_class"] for r in rows})
    for load in loads:
        for cls in classes:
            off = indexed.get((cls, load, False))
            on = indexed.get((cls, load, True))
            if not off or not on:
                continue

            off_p99, on_p99 = _num(off["rtt_p99_ms"]), _num(on["rtt_p99_ms"])
            factor = (improvement_factor(off_p99, on_p99)
                      if off_p99 and on_p99 else None)

            lines.append(
                f"| {cls} | {load}% "
                f"| {off['rtt_p50_ms'] or 'lost'} ms "
                f"| {on['rtt_p50_ms'] or 'lost'} ms "
                f"| {off['rtt_p99_ms'] or 'lost'} ms "
                f"| {on['rtt_p99_ms'] or 'lost'} ms "
                f"| {str(factor) + '×' if factor else '—'} |"
            )

    total = sum(int(r["samples"]) for r in rows if r["samples"])
    lines.append("")
    lines.append(
        f"Measured on {date.today().isoformat()} from `{source}` — "
        f"{len(rows)} conditions, {total} probes. "
        "Percentiles are nearest-rank over per-packet RTTs. "
        "Reproduce with `sudo python3 SDN_files/benchmark.py`."
    )

    return "\n".join(lines) + "\n"


def update_readme(readme_path: str, section: str) -> bool:
    """Replace the marked region. Returns False if the markers are missing."""
    with open(readme_path, encoding="utf-8") as handle:
        content = handle.read()

    start = content.find(START_MARKER)
    end = content.find(END_MARKER)
    if start == -1 or end == -1 or end < start:
        return False

    updated = (
        content[:start + len(START_MARKER)]
        + "\n" + section + "\n"
        + content[end:]
    )

    with open(readme_path, "w", encoding="utf-8", newline="") as handle:
        handle.write(updated)
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("csv_path", nargs="?", default="results/qos_benchmark.csv")
    parser.add_argument("--update-readme", action="store_true",
                        help="write the table into README.md between the markers")
    parser.add_argument("--readme", default="README.md")
    args = parser.parse_args(argv)

    if os.path.exists(args.csv_path):
        rows = load_rows(args.csv_path)
    else:
        print(f"No results at {args.csv_path}; emitting the placeholder.",
              file=sys.stderr)
        rows = []

    section = build_markdown(rows, args.csv_path)

    if not args.update_readme:
        print(section)
        return 0

    if not update_readme(args.readme, section):
        print(f"ERROR: {START_MARKER} / {END_MARKER} not found in {args.readme}",
              file=sys.stderr)
        return 1

    print(f"Updated {args.readme} with {len(rows)} rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
