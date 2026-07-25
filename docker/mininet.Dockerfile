# Mininet + Open vSwitch, for the emulated topology and the benchmark.
#
# This container needs --privileged and a host kernel with the openvswitch
# module. It creates network namespaces, veth pairs and tc qdiscs, none of
# which is possible from an unprivileged container. See docker/README.md.
FROM python:3.11-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        mininet \
        openvswitch-switch \
        openvswitch-common \
        iproute2 \
        iputils-ping \
        iperf3 \
        net-tools \
        tcpdump \
        procps \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY SDN_files/requirements-dev.txt ./requirements-dev.txt
RUN pip install --no-cache-dir -r requirements-dev.txt

COPY SDN_files/ ./SDN_files/
COPY docker/mininet-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["topology"]
