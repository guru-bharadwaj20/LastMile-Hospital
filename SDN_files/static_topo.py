"""
static_topo.py — Mininet topology, built from the shared description.

The node and link definitions live in topology.py so that the controller
derives its forwarding rules from exactly the same source this builds from.
Link order is preserved, which is what keeps derived port numbers correct.
"""
import os
import sys

from mininet.link import TCLink
from mininet.topo import Topo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qos import DEFAULT_LINK_BPS  # noqa: E402
from topology import HOSTS, LINKS, NETMASK, SWITCHES  # noqa: E402


class StaticTopo(Topo):
    """
    Uncapped topology, as used for the original routing and throughput
    measurements. Links run at whatever the host can manage.
    """

    link_mbps = None

    def build(self):
        for name in SWITCHES:
            self.addSwitch(name)

        for name, spec in HOSTS.items():
            self.addHost(name, ip=spec['ip'] + NETMASK)

        # Added in declaration order: Mininet assigns switch port numbers
        # sequentially as links attach, and flow_table.py relies on that.
        for a, b in LINKS:
            if self.link_mbps is None:
                self.addLink(a, b)
            else:
                self.addLink(a, b, cls=TCLink, bw=self.link_mbps)


class QosTopo(StaticTopo):
    """
    Rate-limited variant used for the QoS benchmarks.

    Queues only do anything on a contended link: with an uncapped link there
    is no backlog to schedule, every class is served immediately, and the
    measured difference between priorities would be nothing but noise.
    """

    link_mbps = DEFAULT_LINK_BPS / 1_000_000


topos = {
    'statictopo': StaticTopo,
    'qostopo': QosTopo,
}

