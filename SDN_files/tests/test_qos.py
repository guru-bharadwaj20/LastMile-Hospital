"""
Tests for the QoS policy.

qos.py is pure, so the class mapping, the rate arithmetic and the generated
ovs-vsctl argument vectors are all verified without Open vSwitch installed.
"""
import pytest

from qos import (
    BY_DSCP,
    BY_PRIORITY,
    BY_QUEUE,
    DEFAULT_CLASS,
    DEFAULT_LINK_BPS,
    TRAFFIC_CLASSES,
    build_clear_command,
    build_qos_command,
    classify,
    queue_for,
)


def test_five_classes_matching_the_triage_model():
    assert [c.priority for c in TRAFFIC_CLASSES] == ["P1", "P2", "P3", "P4", "P5"]


def test_queue_ids_are_unique_and_contiguous():
    ids = sorted(c.queue_id for c in TRAFFIC_CLASSES)
    assert ids == list(range(len(TRAFFIC_CLASSES)))


def test_dscp_marks_are_unique():
    marks = [c.dscp for c in TRAFFIC_CLASSES]
    assert len(set(marks)) == len(marks)


def test_dscp_marks_are_valid_six_bit_codepoints():
    for c in TRAFFIC_CLASSES:
        assert 0 <= c.dscp <= 63, c.priority


def test_uses_standard_diffserv_codepoints():
    """EF for critical, assured forwarding below it, best effort at the floor."""
    assert BY_PRIORITY["P1"].dscp == 46   # EF
    assert BY_PRIORITY["P2"].dscp == 34   # AF41
    assert BY_PRIORITY["P3"].dscp == 26   # AF31
    assert BY_PRIORITY["P4"].dscp == 18   # AF21
    assert BY_PRIORITY["P5"].dscp == 0    # BE


def test_guaranteed_shares_total_one_hundred_percent():
    """Every class keeps a floor; the link is fully but not over committed."""
    assert sum(c.min_share for c in TRAFFIC_CLASSES) == 100


def test_higher_priority_gets_a_larger_guarantee():
    shares = [c.min_share for c in TRAFFIC_CLASSES]
    assert shares == sorted(shares, reverse=True)


def test_htb_bands_order_by_priority():
    bands = [c.htb_priority for c in TRAFFIC_CLASSES]
    assert bands == sorted(bands)
    assert BY_PRIORITY["P1"].htb_priority < BY_PRIORITY["P5"].htb_priority


def test_ceiling_is_never_below_the_guarantee():
    for c in TRAFFIC_CLASSES:
        assert c.max_share >= c.min_share, c.priority


def test_only_critical_traffic_may_take_the_whole_link():
    assert BY_PRIORITY["P1"].max_share == 100
    for c in TRAFFIC_CLASSES[1:]:
        assert c.max_share < 100, c.priority


def test_background_is_capped_well_below_critical():
    assert BY_PRIORITY["P5"].max_share < BY_PRIORITY["P1"].min_share


def test_rate_arithmetic():
    p1 = BY_PRIORITY["P1"]
    assert p1.min_rate(10_000_000) == 3_500_000
    assert p1.max_rate(10_000_000) == 10_000_000
    assert BY_PRIORITY["P5"].min_rate(10_000_000) == 800_000


def test_rates_scale_with_link_capacity():
    p2 = BY_PRIORITY["P2"]
    assert p2.min_rate(100_000_000) == 10 * p2.min_rate(10_000_000)


@pytest.mark.parametrize("dscp,expected", [(46, "P1"), (34, "P2"), (26, "P3"),
                                           (18, "P4"), (0, "P5")])
def test_classify_known_marks(dscp, expected):
    assert classify(dscp).priority == expected


def test_unknown_marks_fall_back_to_best_effort():
    """
    Fail-safe: traffic that is unmarked, or marked with something we do not
    recognise, must not inherit a clinical guarantee.
    """
    assert classify(63).priority == "P5"
    assert classify(7).priority == DEFAULT_CLASS.priority
    assert DEFAULT_CLASS.priority == "P5"


def test_queue_for_matches_the_class_table():
    for c in TRAFFIC_CLASSES:
        assert queue_for(c.priority) == c.queue_id


def test_lookup_tables_agree():
    for c in TRAFFIC_CLASSES:
        assert BY_PRIORITY[c.priority] is c
        assert BY_DSCP[c.dscp] is c
        assert BY_QUEUE[c.queue_id] is c


class TestQosCommand:
    def test_targets_the_requested_port(self):
        cmd = build_qos_command("s1-eth1")
        assert cmd[:5] == ["ovs-vsctl", "set", "port", "s1-eth1", "qos=@newqos"]

    def test_requests_linux_htb(self):
        assert "type=linux-htb" in build_qos_command("s1-eth1")

    def test_declares_one_queue_per_class(self):
        cmd = build_qos_command("s1-eth1")
        refs = next(a for a in cmd if a.startswith("queues:"))
        for c in TRAFFIC_CLASSES:
            assert f"{c.queue_id}=@q{c.queue_id}" in refs
            assert f"--id=@q{c.queue_id}" in cmd

    def test_carries_the_rates_for_each_class(self):
        cmd = build_qos_command("s1-eth1", 10_000_000)
        for c in TRAFFIC_CLASSES:
            assert f"other-config:min-rate={c.min_rate(10_000_000)}" in cmd
            assert f"other-config:max-rate={c.max_rate(10_000_000)}" in cmd
            assert f"other-config:priority={c.htb_priority}" in cmd

    def test_caps_the_parent_at_link_capacity(self):
        cmd = build_qos_command("s1-eth1", 5_000_000)
        assert "other-config:max-rate=5000000" in cmd

    def test_defaults_to_the_documented_link_rate(self):
        assert f"other-config:max-rate={DEFAULT_LINK_BPS}" in build_qos_command("s1-eth1")

    def test_is_a_vector_not_a_shell_string(self):
        """Passed straight to subprocess, so no argument may need quoting."""
        for arg in build_qos_command("s1-eth1"):
            assert isinstance(arg, str)
            assert " " not in arg


def test_clear_command_detaches_the_port():
    assert build_clear_command("s2-eth1") == [
        "ovs-vsctl", "clear", "port", "s2-eth1", "qos",
    ]
