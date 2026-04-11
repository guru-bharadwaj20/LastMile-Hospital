from ryu.base import app_manager
from ryu.controller import ofp_event
from ryu.controller.handler import CONFIG_DISPATCHER, MAIN_DISPATCHER
from ryu.controller.handler import set_ev_cls
from ryu.ofproto import ofproto_v1_3
from ryu.lib.packet import packet, ethernet, arp, ipv4

class StaticRouter(app_manager.RyuApp):
    OFP_VERSIONS = [ofproto_v1_3.OFP_VERSION]

    def __init__(self, *args, **kwargs):
        super(StaticRouter, self).__init__(*args, **kwargs)

        # mac table: ip -> mac (populated dynamically from ARP)
        self.ip_to_mac = {}
        self.ip_to_port = {}  # dpid -> {ip: port}

        self.static_flows = {
            1: [
                {'in_port': 1, 'ipv4_dst': '10.0.0.3', 'out_port': 3},
                {'in_port': 1, 'ipv4_dst': '10.0.0.4', 'out_port': 3},
                {'in_port': 2, 'ipv4_dst': '10.0.0.3', 'out_port': 3},
                {'in_port': 2, 'ipv4_dst': '10.0.0.4', 'out_port': 3},
                {'in_port': 3, 'ipv4_dst': '10.0.0.1', 'out_port': 1},
                {'in_port': 3, 'ipv4_dst': '10.0.0.2', 'out_port': 2},
                # same switch: h1 <-> h2
                {'in_port': 1, 'ipv4_dst': '10.0.0.2', 'out_port': 2},
                {'in_port': 2, 'ipv4_dst': '10.0.0.1', 'out_port': 1},
            ],
            2: [
                {'in_port': 1, 'ipv4_dst': '10.0.0.3', 'out_port': 2},
                {'in_port': 1, 'ipv4_dst': '10.0.0.4', 'out_port': 2},
                {'in_port': 2, 'ipv4_dst': '10.0.0.1', 'out_port': 1},
                {'in_port': 2, 'ipv4_dst': '10.0.0.2', 'out_port': 1},
            ],
            3: [
                {'in_port': 3, 'ipv4_dst': '10.0.0.3', 'out_port': 1},
                {'in_port': 3, 'ipv4_dst': '10.0.0.4', 'out_port': 2},
                {'in_port': 1, 'ipv4_dst': '10.0.0.1', 'out_port': 3},
                {'in_port': 1, 'ipv4_dst': '10.0.0.2', 'out_port': 3},
                {'in_port': 2, 'ipv4_dst': '10.0.0.1', 'out_port': 3},
                {'in_port': 2, 'ipv4_dst': '10.0.0.2', 'out_port': 3},
                # same switch: h3 <-> h4
                {'in_port': 1, 'ipv4_dst': '10.0.0.4', 'out_port': 2},
                {'in_port': 2, 'ipv4_dst': '10.0.0.3', 'out_port': 1},
            ],
        }

    @set_ev_cls(ofp_event.EventOFPSwitchFeatures, CONFIG_DISPATCHER)
    def switch_features_handler(self, ev):
        datapath = ev.msg.datapath
        dpid = datapath.id
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser
        self.logger.info("Switch connected: dpid=%s", dpid)

        # Install table-miss rule: send unknown packets to controller
        match = parser.OFPMatch()
        actions = [parser.OFPActionOutput(ofproto.OFPP_CONTROLLER,
                                          ofproto.OFPCML_NO_BUFFER)]
        inst = [parser.OFPInstructionActions(ofproto.OFPIT_APPLY_ACTIONS,
                                             actions)]
        mod = parser.OFPFlowMod(datapath=datapath, priority=0,
                                match=match, instructions=inst)
        datapath.send_msg(mod)

        # Install static IP flow rules
        if dpid in self.static_flows:
            for rule in self.static_flows[dpid]:
                self.install_flow(datapath, rule)
            self.logger.info("Installed %d rules on switch %s",
                           len(self.static_flows[dpid]), dpid)

    def install_flow(self, datapath, rule):
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser
        match = parser.OFPMatch(
            in_port=rule['in_port'],
            eth_type=0x0800,
            ipv4_dst=rule['ipv4_dst']
        )
        actions = [parser.OFPActionOutput(rule['out_port'])]
        inst = [parser.OFPInstructionActions(
            ofproto.OFPIT_APPLY_ACTIONS, actions)]
        mod = parser.OFPFlowMod(
            datapath=datapath,
            priority=100,
            match=match,
            instructions=inst,
            idle_timeout=0,
            hard_timeout=0
        )
        datapath.send_msg(mod)
        self.logger.info("  Installed: in_port=%s dst=%s -> out_port=%s",
                        rule['in_port'], rule['ipv4_dst'], rule['out_port'])

    @set_ev_cls(ofp_event.EventOFPPacketIn, MAIN_DISPATCHER)
    def packet_in_handler(self, ev):
        msg = ev.msg
        datapath = msg.datapath
        ofproto = datapath.ofproto
        parser = datapath.ofproto_parser
        in_port = msg.match['in_port']

        pkt = packet.Packet(msg.data)
        eth = pkt.get_protocol(ethernet.ethernet)
        if eth is None:
            return

        # Handle ARP: flood it so hosts can resolve MACs
        arp_pkt = pkt.get_protocol(arp.arp)
        if arp_pkt:
            self.logger.info("ARP packet on switch %s port %s",
                           datapath.id, in_port)
            actions = [parser.OFPActionOutput(ofproto.OFPP_FLOOD)]
            out = parser.OFPPacketOut(
                datapath=datapath,
                buffer_id=msg.buffer_id,
                in_port=in_port,
                actions=actions,
                data=msg.data if msg.buffer_id == ofproto.OFP_NO_BUFFER
                     else None
            )
            datapath.send_msg(out)
