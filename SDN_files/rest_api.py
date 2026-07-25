"""
rest_api.py — HTTP surface for the LastMile controller.

Runs alongside the QoS controller inside ryu-manager and exposes what the
switches are actually doing, so the dashboard can display measured counters
instead of a browser simulation.

    ryu-manager --ofp-tcp-listen-port 6633 \\
        SDN_files/qos_controller.py SDN_files/rest_api.py

Endpoints, all under /lastmile:

    GET  /lastmile/health      liveness and controller version
    GET  /lastmile/policy      the QoS class table
    GET  /lastmile/topology    switches, hosts, department mapping
    GET  /lastmile/status      current counters and observed shares
    GET  /lastmile/events      server-sent event stream of the above

CORS is permissive because the dashboard is served from a different origin
during development (Vite on :5173, controller on :8080). That is acceptable
for a read-only endpoint on a lab network and would not be for anything that
accepts writes. See the threat model in docs/ARCHITECTURE.md.

Payload construction lives in api_model.py, which is pure and tested. This
file is the Ryu and WSGI plumbing.
"""
from __future__ import annotations

import json
import os
import sys
import time

from ryu.app.wsgi import ControllerBase, Response, WSGIApplication, route
from ryu.base import app_manager
from ryu.controller import ofp_event
from ryu.controller.handler import DEAD_DISPATCHER, MAIN_DISPATCHER, set_ev_cls
from ryu.lib import hub

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api_model import (  # noqa: E402
    API_VERSION,
    event_payload,
    link_utilisation,
    policy_payload,
    queue_stats_payload,
    status_payload,
    topology_payload,
)
from qos import DEFAULT_LINK_BPS  # noqa: E402

INSTANCE_NAME = "lastmile_api"
POLL_INTERVAL = 1.0
MAX_EVENTS = 200

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


class LastMileApi(app_manager.RyuApp):
    """Collects switch statistics and serves them over HTTP."""

    _CONTEXTS = {"wsgi": WSGIApplication}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.datapaths: dict[int, object] = {}
        self.queue_counters: dict[int, dict] = {}
        self.previous_counters: dict[int, dict] = {}
        self.port_tx_bytes: dict[tuple[int, int], int] = {}
        self.network_load: float = 0.0
        self.qos_active: bool = False
        self.events: list[dict] = []
        self.event_seq: int = 0
        self.last_poll: float = time.time()

        kwargs["wsgi"].register(LastMileController, {INSTANCE_NAME: self})
        self.monitor_thread = hub.spawn(self._monitor)

    # ── Event log ───────────────────────────────────────────────

    def record(self, kind: str, label: str, priority: str | None = None) -> None:
        payload = event_payload(kind, label, time.time(), priority)
        # Monotonic sequence number, so a stream consumer can resume without
        # relying on list indices that shift when the buffer is trimmed.
        self.event_seq += 1
        payload["seq"] = self.event_seq
        self.events.append(payload)
        del self.events[:-MAX_EVENTS]

    def events_since(self, seq: int) -> list[dict]:
        return [e for e in self.events if e["seq"] > seq]

    # ── Switch lifecycle ────────────────────────────────────────

    @set_ev_cls(ofp_event.EventOFPStateChange, [MAIN_DISPATCHER, DEAD_DISPATCHER])
    def state_change_handler(self, ev):
        datapath = ev.datapath
        if ev.state == MAIN_DISPATCHER:
            self.datapaths[datapath.id] = datapath
            self.record("infra", f"Switch {datapath.id} connected")
        elif datapath.id in self.datapaths:
            del self.datapaths[datapath.id]
            self.record("infra", f"Switch {datapath.id} disconnected")

    # ── Statistics polling ──────────────────────────────────────

    def _monitor(self):
        while True:
            for datapath in list(self.datapaths.values()):
                self._request_stats(datapath)
            hub.sleep(POLL_INTERVAL)

    def _request_stats(self, datapath):
        parser = datapath.ofproto_parser
        datapath.send_msg(parser.OFPQueueStatsRequest(datapath, 0))
        datapath.send_msg(parser.OFPPortStatsRequest(datapath, 0,
                                                     datapath.ofproto.OFPP_ANY))

    @set_ev_cls(ofp_event.EventOFPQueueStatsReply, MAIN_DISPATCHER)
    def queue_stats_reply_handler(self, ev):
        """Aggregate per-queue counters across every switch and port."""
        aggregated: dict[int, dict] = {}
        for stat in ev.msg.body:
            bucket = aggregated.setdefault(
                stat.queue_id, {"tx_bytes": 0, "tx_packets": 0, "tx_errors": 0})
            bucket["tx_bytes"] += stat.tx_bytes
            bucket["tx_packets"] += stat.tx_packets
            bucket["tx_errors"] += stat.tx_errors

        for queue_id, values in aggregated.items():
            existing = self.queue_counters.setdefault(
                queue_id, {"tx_bytes": 0, "tx_packets": 0, "tx_errors": 0})
            for key, value in values.items():
                existing[key] = value

        # Queue statistics only exist once queues have been created, so their
        # presence is a reasonable proxy for whether QoS is actually applied.
        self.qos_active = bool(aggregated)

    @set_ev_cls(ofp_event.EventOFPPortStatsReply, MAIN_DISPATCHER)
    def port_stats_reply_handler(self, ev):
        """Derive link utilisation from the busiest port's transmit rate."""
        now = time.time()
        elapsed = max(now - self.last_poll, 1e-6)
        dpid = ev.msg.datapath.id

        peak = 0.0
        for stat in ev.msg.body:
            if stat.port_no > 0xFFFFFF00:  # skip OFPP_LOCAL and reserved ports
                continue
            key = (dpid, stat.port_no)
            delta = stat.tx_bytes - self.port_tx_bytes.get(key, stat.tx_bytes)
            self.port_tx_bytes[key] = stat.tx_bytes
            peak = max(peak, link_utilisation(delta, elapsed, DEFAULT_LINK_BPS))

        self.network_load = peak
        self.last_poll = now

    # ── Snapshots ───────────────────────────────────────────────

    def snapshot(self) -> dict:
        rows = queue_stats_payload(
            self.queue_counters, self.previous_counters, POLL_INTERVAL)
        self.previous_counters = {
            qid: dict(values) for qid, values in self.queue_counters.items()
        }
        return status_payload(
            connected_switches=list(self.datapaths),
            queue_rows=rows,
            network_load=self.network_load,
            qos_active=self.qos_active,
            timestamp=time.time(),
        )


def _json(payload, status=200) -> Response:
    return Response(
        content_type="application/json; charset=utf-8",
        body=json.dumps(payload).encode("utf-8"),
        status=status,
        headers=CORS_HEADERS,
    )


class LastMileController(ControllerBase):
    def __init__(self, req, link, data, **config):
        super().__init__(req, link, data, **config)
        self.api: LastMileApi = data[INSTANCE_NAME]

    @route("lastmile", "/lastmile/health", methods=["GET", "OPTIONS"])
    def health(self, req, **_):
        return _json({
            "version": API_VERSION,
            "status": "ok",
            "connectedSwitches": sorted(self.api.datapaths),
            "qosActive": self.api.qos_active,
        })

    @route("lastmile", "/lastmile/policy", methods=["GET", "OPTIONS"])
    def policy(self, req, **_):
        return _json(policy_payload())

    @route("lastmile", "/lastmile/topology", methods=["GET", "OPTIONS"])
    def topology(self, req, **_):
        return _json(topology_payload())

    @route("lastmile", "/lastmile/status", methods=["GET", "OPTIONS"])
    def status(self, req, **_):
        return _json(self.api.snapshot())

    @route("lastmile", "/lastmile/events", methods=["GET", "OPTIONS"])
    def events(self, req, **_):
        """
        Server-sent events. Chosen over WebSockets because the flow is
        strictly one-way, SSE reconnects on its own, and it is plain HTTP —
        no upgrade handshake to negotiate through a lab proxy.
        """
        def stream():
            cursor = 0
            while True:
                snapshot = self.api.snapshot()
                yield f"event: status\ndata: {json.dumps(snapshot)}\n\n".encode()

                for event in self.api.events_since(cursor):
                    yield f"event: log\ndata: {json.dumps(event)}\n\n".encode()
                    cursor = event["seq"]

                hub.sleep(POLL_INTERVAL)

        return Response(
            content_type="text/event-stream",
            app_iter=stream(),
            headers={**CORS_HEADERS, "Cache-Control": "no-cache",
                     "X-Accel-Buffering": "no"},
        )
