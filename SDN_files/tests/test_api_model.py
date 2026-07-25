"""Tests for the controller API payloads."""
import pytest

from api_model import (
    API_VERSION,
    DASHBOARD_DEPARTMENTS,
    HOST_ROLES,
    event_payload,
    link_utilisation,
    observed_shares,
    policy_payload,
    queue_stats_payload,
    status_payload,
    topology_payload,
)
from qos import TRAFFIC_CLASSES
from topology import HOSTS, SWITCHES


class TestPolicy:
    def test_exposes_every_class(self):
        payload = policy_payload()
        assert len(payload["classes"]) == len(TRAFFIC_CLASSES)
        assert payload["version"] == API_VERSION

    def test_uses_camel_case_for_the_javascript_client(self):
        first = policy_payload()["classes"][0]
        for key in ("queueId", "dscpName", "minShare", "maxShare", "htbPriority"):
            assert key in first

    def test_matches_the_policy_table(self):
        for wire, source in zip(policy_payload()["classes"], TRAFFIC_CLASSES, strict=True):
            assert wire["priority"] == source.priority
            assert wire["dscp"] == source.dscp
            assert wire["queueId"] == source.queue_id


class TestTopology:
    def test_reports_every_switch_and_host(self):
        payload = topology_payload()
        assert len(payload["switches"]) == len(SWITCHES)
        assert len(payload["hosts"]) == len(HOSTS)

    def test_marks_which_departments_have_live_data(self):
        """
        The dashboard draws eight departments and the test topology has four
        hosts, so most are unmodelled. Saying so is the point.
        """
        departments = {d["name"]: d["represented"] for d in topology_payload()["departments"]}
        assert set(departments) == set(DASHBOARD_DEPARTMENTS)
        assert departments["ICU"] is True
        assert departments["ER"] is False
        assert departments["PHARMACY"] is False

    def test_host_roles_reference_real_hosts_and_departments(self):
        for host, department in HOST_ROLES.items():
            assert host in HOSTS
            assert department in DASHBOARD_DEPARTMENTS

    def test_host_roles_are_not_double_assigned(self):
        assert len(set(HOST_ROLES.values())) == len(HOST_ROLES)


class TestLinkUtilisation:
    def test_computes_a_percentage_of_capacity(self):
        # 1.25 MB in one second = 10 Mbit/s = 100% of a 10 Mbit link
        assert link_utilisation(1_250_000, 1.0, 10_000_000) == 100.0
        assert link_utilisation(625_000, 1.0, 10_000_000) == 50.0

    def test_clamps_above_capacity(self):
        """Bursts can exceed the shaped rate briefly; the gauge must not."""
        assert link_utilisation(10_000_000, 1.0, 10_000_000) == 100.0

    def test_is_zero_for_degenerate_inputs(self):
        assert link_utilisation(1000, 0, 10_000_000) == 0.0
        assert link_utilisation(1000, 1.0, 0) == 0.0
        assert link_utilisation(-500, 1.0, 10_000_000) == 0.0


class TestQueueStats:
    def test_reports_a_row_per_class_even_with_no_counters(self):
        rows = queue_stats_payload({})
        assert len(rows) == len(TRAFFIC_CLASSES)
        assert all(row["txBytes"] == 0 for row in rows)

    def test_joins_counters_onto_classes(self):
        rows = queue_stats_payload({0: {"tx_bytes": 5000, "tx_packets": 40, "tx_errors": 1}})
        p1 = next(r for r in rows if r["priority"] == "P1")
        assert p1["txBytes"] == 5000
        assert p1["txPackets"] == 40
        assert p1["txErrors"] == 1

    def test_computes_deltas_and_a_rate(self):
        rows = queue_stats_payload(
            {0: {"tx_bytes": 2000}}, previous={0: {"tx_bytes": 1000}}, seconds=1.0)
        p1 = next(r for r in rows if r["priority"] == "P1")
        assert p1["txBytesDelta"] == 1000
        assert p1["bitsPerSecond"] == 8000.0

    def test_a_counter_reset_does_not_produce_a_negative_rate(self):
        """Counters restart when a switch reconnects."""
        rows = queue_stats_payload(
            {0: {"tx_bytes": 10}}, previous={0: {"tx_bytes": 999_999}}, seconds=1.0)
        p1 = next(r for r in rows if r["priority"] == "P1")
        assert p1["txBytesDelta"] == 0
        assert p1["bitsPerSecond"] == 0.0


class TestObservedShares:
    def test_reports_the_share_each_class_actually_received(self):
        rows = [
            {"priority": "P1", "txBytesDelta": 700},
            {"priority": "P5", "txBytesDelta": 300},
        ]
        assert observed_shares(rows) == {"P1": 70.0, "P5": 30.0}

    def test_is_all_zero_when_nothing_moved(self):
        rows = [{"priority": "P1", "txBytesDelta": 0}, {"priority": "P5", "txBytesDelta": 0}]
        assert observed_shares(rows) == {"P1": 0.0, "P5": 0.0}

    def test_falls_back_to_cumulative_counters(self):
        rows = [{"priority": "P1", "txBytes": 50}, {"priority": "P5", "txBytes": 50}]
        assert observed_shares(rows) == {"P1": 50.0, "P5": 50.0}


class TestStatus:
    def _status(self, **kwargs):
        defaults = dict(
            connected_switches=[2, 1],
            queue_rows=queue_stats_payload({}),
            network_load=42.456,
            qos_active=True,
            timestamp=1700000000.0,
        )
        defaults.update(kwargs)
        return status_payload(**defaults)

    def test_declares_the_controller_as_its_source(self):
        assert self._status()["source"] == "controller"

    def test_sorts_switch_ids(self):
        assert self._status()["connectedSwitches"] == [1, 2]

    def test_reports_the_expected_switches_so_gaps_are_visible(self):
        assert self._status()["expectedSwitches"] == sorted(SWITCHES.values())

    def test_rounds_the_load(self):
        assert self._status()["networkLoad"] == 42.46

    def test_flags_when_queues_are_absent(self):
        assert self._status(qos_active=False)["qosActive"] is False


def test_event_payload_shape():
    event = event_payload("infra", "Switch 1 connected", 1700000000.0)
    assert event["kind"] == "infra"
    assert event["priority"] is None
    assert event["label"] == "Switch 1 connected"


@pytest.mark.parametrize("payload", [policy_payload(), topology_payload()])
def test_payloads_are_json_serialisable(payload):
    import json
    json.loads(json.dumps(payload))
