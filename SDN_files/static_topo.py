"""
static_topo.py — Mininet topology, built from the shared description.

The node and link definitions live in topology.py so that the controller
derives its forwarding rules from exactly the same source this builds from.
Link order is preserved, which is what keeps derived port numbers correct.
"""
import os
import sys

from mininet.topo import Topo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from topology import HOSTS, LINKS, NETMASK, SWITCHES  # noqa: E402


class StaticTopo(Topo):
    def build(self):
        for name in SWITCHES:
            self.addSwitch(name)

        for name, spec in HOSTS.items():
            self.addHost(name, ip=spec['ip'] + NETMASK)

        # Added in declaration order: Mininet assigns switch port numbers
        # sequentially as links attach, and flow_table.py relies on that.
        for a, b in LINKS:
            self.addLink(a, b)


topos = {'statictopo': StaticTopo}
