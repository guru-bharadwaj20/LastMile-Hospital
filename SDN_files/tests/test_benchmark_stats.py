"""
Tests for benchmark parsing and statistics.

These matter more than usual: the numbers this code produces are the ones the
README will make claims from, so an error here would silently become a false
performance claim.
"""
import csv
import io

import pytest

from benchmark_stats import (
    CSV_FIELDS,
    PingResult,
    format_report,
    improvement_factor,
    parse_ping,
    percentile,
    summarize,
    to_csv,
)

PING_OUTPUT = """PING 10.0.0.3 (10.0.0.3) 56(84) bytes of data.
64 bytes from 10.0.0.3: icmp_seq=1 ttl=64 time=0.123 ms
64 bytes from 10.0.0.3: icmp_seq=2 ttl=64 time=12.4 ms
64 bytes from 10.0.0.3: icmp_seq=3 ttl=64 time=0.987 ms
64 bytes from 10.0.0.3: icmp_seq=4 ttl=64 time=340 ms

--- 10.0.0.3 ping statistics ---
5 packets transmitted, 4 received, 20% packet loss, time 4008ms
rtt min/avg/max/mdev = 0.123/88.377/340.000/145.201 ms
"""


class TestParsePing:
    def test_extracts_every_sample(self):
        result = parse_ping(PING_OUTPUT)
        assert result.rtts == [0.123, 12.4, 0.987, 340.0]
        assert result.samples == 4

    def test_extracts_the_loss_summary(self):
        result = parse_ping(PING_OUTPUT)
        assert result.transmitted == 5
        assert result.received == 4
        assert result.loss_pct == 20.0

    def test_handles_total_loss(self):
        output = (
            "PING 10.0.0.3 (10.0.0.3) 56(84) bytes of data.\n\n"
            "--- 10.0.0.3 ping statistics ---\n"
            "10 packets transmitted, 0 received, 100% packet loss, time 9200ms\n"
        )
        result = parse_ping(output)
        assert result.rtts == []
        assert result.loss_pct == 100.0

    def test_handles_the_sub_millisecond_form(self):
        """Some ping builds emit `time<1 ms` rather than `time=`."""
        assert parse_ping("64 bytes from x: icmp_seq=1 ttl=64 time<1 ms").rtts == [1.0]

    def test_handles_empty_output(self):
        result = parse_ping("")
        assert result.rtts == []
        assert result.samples == 0

    def test_infers_counts_when_the_summary_is_missing(self):
        result = parse_ping("64 bytes from x: icmp_seq=1 ttl=64 time=5.0 ms")
        assert result.transmitted == 1
        assert result.received == 1


class TestPercentile:
    def test_nearest_rank(self):
        values = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
        assert percentile(values, 50) == 5.0
        assert percentile(values, 90) == 9.0
        assert percentile(values, 100) == 10.0

    def test_returns_an_observed_value_not_an_interpolated_one(self):
        # The point of nearest-rank: never invent a measurement.
        values = [1.0, 100.0]
        assert percentile(values, 50) in values
        assert percentile(values, 99) in values

    def test_is_order_independent(self):
        assert percentile([9.0, 1.0, 5.0], 50) == percentile([1.0, 5.0, 9.0], 50)

    def test_single_sample(self):
        assert percentile([42.0], 99) == 42.0

    def test_captures_the_tail(self):
        """A long tail must show up at p99 even when the mean looks healthy."""
        values = [1.0] * 99 + [500.0]
        assert percentile(values, 50) == 1.0
        assert percentile(values, 99) == 1.0
        assert percentile(values, 100) == 500.0

    def test_rejects_an_empty_sample(self):
        with pytest.raises(ValueError):
            percentile([], 50)

    @pytest.mark.parametrize("pct", [0, -5, 101])
    def test_rejects_out_of_range(self, pct):
        with pytest.raises(ValueError):
            percentile([1.0], pct)


class TestSummarize:
    def _row(self, **kwargs):
        defaults = dict(
            scenario="h1->h3", qos_enabled=True, traffic_class="P1",
            dscp=46, background_load_pct=90,
            result=parse_ping(PING_OUTPUT),
        )
        defaults.update(kwargs)
        return summarize(**defaults)

    def test_emits_every_declared_column(self):
        assert set(self._row()) == set(CSV_FIELDS)

    def test_reports_the_percentiles(self):
        row = self._row()
        assert row["samples"] == 4
        assert row["rtt_min_ms"] == 0.123
        assert row["rtt_max_ms"] == 340.0
        assert row["rtt_p50_ms"] == 0.987
        assert row["loss_pct"] == 20.0

    def test_handles_a_condition_with_no_successful_probes(self):
        row = self._row(result=PingResult(transmitted=10, received=0, loss_pct=100.0))
        assert row["samples"] == 0
        assert row["loss_pct"] == 100.0
        assert row["rtt_p99_ms"] == ""

    def test_defaults_loss_to_total_when_nothing_was_measured(self):
        row = self._row(result=PingResult())
        assert row["loss_pct"] == 100.0


class TestCsv:
    def test_round_trips(self):
        rows = [summarize("s", True, "P1", 46, 90, parse_ping(PING_OUTPUT))]
        parsed = list(csv.DictReader(io.StringIO(to_csv(rows))))
        assert len(parsed) == 1
        assert parsed[0]["traffic_class"] == "P1"
        assert parsed[0]["rtt_p99_ms"] == "340.0"

    def test_column_order_is_stable(self):
        header = to_csv([]).strip().split(",")
        assert header == CSV_FIELDS

    def test_writes_a_header_even_with_no_rows(self):
        assert to_csv([]).strip() != ""


class TestImprovementFactor:
    def test_computes_the_ratio(self):
        assert improvement_factor(340.0, 10.0) == 34.0

    @pytest.mark.parametrize("without,with_", [(0, 10), (340, 0), (0, 0), (-1, 5)])
    def test_returns_none_when_undefined(self, without, with_):
        # Must never become infinity: that would silently become a headline.
        assert improvement_factor(without, with_) is None


class TestReport:
    def test_handles_no_results(self):
        assert format_report([]) == "No results."

    def test_pairs_qos_on_and_off_for_the_same_condition(self):
        slow = parse_ping("64 bytes from x: icmp_seq=1 ttl=64 time=400 ms\n"
                          "1 packets transmitted, 1 received, 0% packet loss")
        fast = parse_ping("64 bytes from x: icmp_seq=1 ttl=64 time=10 ms\n"
                          "1 packets transmitted, 1 received, 0% packet loss")
        rows = [
            summarize("h1->h3 under 90% load", False, "P1", 46, 90, slow),
            summarize("h1->h3 under 90% load", True, "P1", 46, 90, fast),
        ]
        report = format_report(rows)
        assert "40.0x faster" in report
        assert "p99" in report

    def test_omits_a_comparison_with_no_pair(self):
        rows = [summarize("solo", False, "P1", 46, 90, parse_ping(PING_OUTPUT))]
        assert "faster" not in format_report(rows)
