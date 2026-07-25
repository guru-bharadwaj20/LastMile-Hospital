"""
qos_controller.py — Ryu app enforcing LastMile triage in the data plane.

Extends the static router: every forwarding decision it makes is the same,
but each rule is duplicated per traffic class and carries an
OFPActionSetQueue, so packets are placed into the Open vSwitch HTB queue that
matches their clinical priority before being forwarded.

    ryu-manager --ofp-tcp-listen-port 6633 SDN_files/qos_controller.py

Rule layout per switch, highest priority first:

    QOS_PRIORITY (110)   in_port + ipv4_dst + ip_dscp -> SetQueue(n), Output
    FLOW_PRIORITY (100)  in_port + ipv4_dst           -> SetQueue(P5), Output
    0                    table-miss                   -> Controller

Unmarked traffic therefore still forwards correctly, but lands in the
best-effort queue rather than being treated as though it were critical.
Fail-open on classification, fail-safe on priority.

The queues themselves are created by setup_qos.py; OpenFlow can only select a
queue, it cannot create one.
"""
import os
import sys

from ryu.base import app_manager
from ryu.controller import ofp_event
from ryu.controller.handler import CONFIG_DISPATCHER, MAIN_DISPATCHER, set_ev_cls
from ryu.lib.packet import arp, ethernet, packet
from ryu.ofproto import ofproto_v1_3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flow_table import FLOW_PRIORITY, STATIC_FLOWS  # noqa: E402
from qos import DEFAULT_CLASS, TRAFFIC_CLASSES  # noqa: E402

QOS_PRIORITY = FLOW_PRIORITY + 10


class QosRouter(app_manager.RyuApp):
    OFP_VERSIONS = [ofproto_v1_3.OFP_VERSION]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.static_flows = STATIC_FLOWS
        self.installed = {}

    # ── Switch bring-up ─────────────────────────────────────────

    @set_ev_cls(ofp_event.EventOFPSwitchFeatures, CONFIG_DISPATCHER)
    def switch_features_handler(self, ev):
        datapath = ev.msg.datapath
        dpid = datapath.id
        self.logger.info("Switch connected: dpid=%s", dpid)

        self._install_table_miss(datapath)

        rules = self.static_flows.get(dpid)
        if not rules:
            self.logger.warning("No static routes defined for dpid=%s", dpid)
            return

        count = 0
        for rule in rules:
            # One classified rule per traffic class...
            for traffic_class in TRAFFIC_CLASSES:
                self._install_forward(datapath, rule, traffic_class, matched_dscp=True)
                count += 1
            # ...plus an unclassified fallback into the best-effort queue.
            self._install_forward(datapath, rule, DEFAULT_CLASS, matched_dscp=False)
            count += 1

        self.installed[dpid] = count
        self.logger.info(
            "Installed %d rules on dpid=%s (%d routes x %d classes + fallback)",
            count, dpid, len(rules), len(TRAFFIC_CLASSES),
        )

    def _install_table_miss(self, datapath):
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser

        actions = [parser.OFPActionOutput(ofproto.OFPP_CONTROLLER,
                                          ofproto.OFPCML_NO_BUFFER)]
        datapath.send_msg(parser.OFPFlowMod(
            datapath=datapath,
            priority=0,
            match=parser.OFPMatch(),
            instructions=[parser.OFPInstructionActions(
                ofproto.OFPIT_APPLY_ACTIONS, actions)],
        ))

    def _install_forward(self, datapath, rule, traffic_class, matched_dscp):
        """
        Install one forwarding rule that also selects a queue.

        OFPActionSetQueue must precede OFPActionOutput: actions in an
        APPLY_ACTIONS list execute in order, and the queue has to be selected
        before the packet is handed to the port.
        """
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser

        fields = {
            "in_port": rule["in_port"],
            "eth_type": 0x0800,
            "ipv4_dst": rule["ipv4_dst"],
        }
        if matched_dscp:
            fields["ip_dscp"] = traffic_class.dscp

        actions = [
            parser.OFPActionSetQueue(traffic_class.queue_id),
            parser.OFPActionOutput(rule["out_port"]),
        ]

        datapath.send_msg(parser.OFPFlowMod(
            datapath=datapath,
            priority=QOS_PRIORITY if matched_dscp else FLOW_PRIORITY,
            match=parser.OFPMatch(**fields),
            instructions=[parser.OFPInstructionActions(
                ofproto.OFPIT_APPLY_ACTIONS, actions)],
            idle_timeout=0,
            hard_timeout=0,
        ))

    # ── Packet in ───────────────────────────────────────────────

    @set_ev_cls(ofp_event.EventOFPPacketIn, MAIN_DISPATCHER)
    def packet_in_handler(self, ev):
        msg = ev.msg
        datapath = msg.datapath
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser
        in_port = msg.match["in_port"]

        pkt = packet.Packet(msg.data)
        eth = pkt.get_protocol(ethernet.ethernet)
        if eth is None:
            return

        # ARP is flooded so hosts can resolve each other. The topology is a
        # line with no cycles, so flooding cannot loop.
        if pkt.get_protocol(arp.arp):
            actions = [parser.OFPActionOutput(ofproto.OFPP_FLOOD)]
            datapath.send_msg(parser.OFPPacketOut(
                datapath=datapath,
                buffer_id=msg.buffer_id,
                in_port=in_port,
                actions=actions,
                data=msg.data if msg.buffer_id == ofproto.OFP_NO_BUFFER else None,
            ))
            return

        self.logger.debug(
            "Unmatched packet on dpid=%s port=%s ethertype=0x%04x — dropped",
            datapath.id, in_port, eth.ethertype,
        )
