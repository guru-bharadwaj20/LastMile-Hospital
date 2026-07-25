"""
Tests for README generation from benchmark CSV.

This is the path by which a measurement becomes a published claim, so it is
worth pinning: a bug here either loses real results or, worse, prints numbers
that do not correspond to what was measured.
"""
import pytest

from benchmark_stats import CSV_FIELDS
from report_results import (
    END_MARKER,
    PLACEHOLDER,
    START_MARKER,
    build_markdown,
    load_rows,
    update_readme,
)


def row(cls="P1", load=90, qos=True, p50="10.0", p99="12.0", samples=40):
    return {
        "scenario": f"h1->h3 under {load}% load",
        "qos_enabled": str(qos),
        "traffic_class": cls,
        "dscp": "46",
        "background_load_pct": str(load),
        "samples": str(samples),
        "loss_pct": "0.0",
        "rtt_min_ms": "8.0",
        "rtt_p50_ms": p50,
        "rtt_p95_ms": p99,
        "rtt_p99_ms": p99,
        "rtt_max_ms": p99,
    }


class TestBuildMarkdown:
    def test_emits_the_placeholder_when_there_are_no_results(self):
        assert build_markdown([], "results/none.csv") == PLACEHOLDER

    def test_placeholder_states_plainly_that_nothing_was_measured(self):
        assert "No benchmark results recorded yet" in PLACEHOLDER

    def test_pairs_qos_on_and_off_into_one_row(self):
        rows = [
            row(qos=False, p50="380.0", p99="410.0"),
            row(qos=True, p50="9.0", p99="11.0"),
        ]
        table = build_markdown(rows, "r.csv")
        assert "| P1 | 90% | 380.0 ms | 9.0 ms | 410.0 ms | 11.0 ms |" in table

    def test_reports_the_improvement_factor(self):
        rows = [
            row(qos=False, p99="400.0"),
            row(qos=True, p99="10.0"),
        ]
        assert "40.0×" in build_markdown(rows, "r.csv")

    def test_omits_a_class_with_no_counterpart(self):
        table = build_markdown([row(qos=True)], "r.csv")
        assert "| P1 |" not in table

    def test_marks_a_fully_lost_condition_as_lost(self):
        rows = [
            row(qos=False, p50="", p99="", samples=0),
            row(qos=True, p50="9.0", p99="11.0"),
        ]
        table = build_markdown(rows, "r.csv")
        assert "lost" in table
        # No improvement factor is claimable against a condition with no data.
        assert "×" not in table.split("\n")[2]

    def test_cites_its_source_and_probe_count(self):
        rows = [row(qos=False), row(qos=True)]
        table = build_markdown(rows, "results/qos_benchmark.csv")
        assert "results/qos_benchmark.csv" in table
        assert "80 probes" in table

    def test_orders_rows_by_load(self):
        rows = [
            row(load=90, qos=False), row(load=90, qos=True),
            row(load=45, qos=False), row(load=45, qos=True),
        ]
        table = build_markdown(rows, "r.csv")
        assert table.index("| P1 | 45%") < table.index("| P1 | 90%")


class TestUpdateReadme:
    def _write(self, tmp_path, body):
        path = tmp_path / "README.md"
        path.write_text(body, encoding="utf-8")
        return path

    def test_replaces_only_the_marked_region(self, tmp_path):
        path = self._write(
            tmp_path,
            f"# Title\n\nbefore\n\n{START_MARKER}\nOLD\n{END_MARKER}\n\nafter\n",
        )
        assert update_readme(str(path), "NEW TABLE\n")

        content = path.read_text(encoding="utf-8")
        assert "NEW TABLE" in content
        assert "OLD" not in content
        assert "before" in content and "after" in content

    def test_keeps_the_markers_for_the_next_run(self, tmp_path):
        path = self._write(tmp_path, f"{START_MARKER}\nOLD\n{END_MARKER}\n")
        update_readme(str(path), "NEW\n")

        content = path.read_text(encoding="utf-8")
        assert START_MARKER in content and END_MARKER in content
        # Idempotent: a second pass must not nest or duplicate.
        update_readme(str(path), "NEWER\n")
        assert path.read_text(encoding="utf-8").count(START_MARKER) == 1

    def test_reports_failure_when_markers_are_absent(self, tmp_path):
        path = self._write(tmp_path, "# Title\n\nno markers here\n")
        assert update_readme(str(path), "TABLE") is False
        assert "TABLE" not in path.read_text(encoding="utf-8")

    def test_reports_failure_when_markers_are_inverted(self, tmp_path):
        path = self._write(tmp_path, f"{END_MARKER}\n{START_MARKER}\n")
        assert update_readme(str(path), "TABLE") is False


class TestLoadRows:
    def test_reads_the_schema_benchmark_writes(self, tmp_path):
        path = tmp_path / "r.csv"
        path.write_text(
            ",".join(CSV_FIELDS) + "\n"
            + ",".join(row()[f] for f in CSV_FIELDS) + "\n",
            encoding="utf-8",
        )
        loaded = load_rows(str(path))
        assert len(loaded) == 1
        assert loaded[0]["traffic_class"] == "P1"

    def test_missing_file_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_rows(str(tmp_path / "absent.csv"))


def test_repository_readme_carries_the_markers():
    """The generator is useless if the README it targets loses its markers."""
    import pathlib
    readme = pathlib.Path(__file__).resolve().parents[2] / "README.md"
    content = readme.read_text(encoding="utf-8")
    assert content.count(START_MARKER) == 1
    assert content.count(END_MARKER) == 1
    assert content.index(START_MARKER) < content.index(END_MARKER)
