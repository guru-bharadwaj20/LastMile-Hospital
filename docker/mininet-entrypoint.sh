#!/bin/bash
# Bring up Open vSwitch inside the container, then hand off to the requested
# task. OVS normally starts under systemd, which is not present here, so its
# database and daemons are started by hand.
set -euo pipefail

CONTROLLER_HOST="${CONTROLLER_HOST:-controller}"
CONTROLLER_PORT="${CONTROLLER_PORT:-6633}"

start_ovs() {
  mkdir -p /var/run/openvswitch /etc/openvswitch

  if [ ! -f /etc/openvswitch/conf.db ]; then
    ovsdb-tool create /etc/openvswitch/conf.db \
      /usr/share/openvswitch/vswitch.ovsschema
  fi

  ovsdb-server /etc/openvswitch/conf.db \
    --remote=punix:/var/run/openvswitch/db.sock \
    --remote=db:Open_vSwitch,Open_vSwitch,manager_options \
    --pidfile --detach --log-file

  ovs-vsctl --no-wait init
  ovs-vswitchd --pidfile --detach --log-file

  echo "Open vSwitch $(ovs-vsctl --version | head -1) ready"
}

wait_for_controller() {
  echo "Waiting for controller at ${CONTROLLER_HOST}:${CONTROLLER_PORT}..."
  for _ in $(seq 1 60); do
    if (echo > "/dev/tcp/${CONTROLLER_HOST}/${CONTROLLER_PORT}") 2>/dev/null; then
      echo "Controller is up."
      return 0
    fi
    sleep 1
  done
  echo "ERROR: controller did not become reachable in 60s" >&2
  return 1
}

start_ovs
wait_for_controller

case "${1:-topology}" in
  topology)
    echo "Starting qostopo against ${CONTROLLER_HOST}:${CONTROLLER_PORT}"
    exec mn --custom SDN_files/static_topo.py --topo qostopo \
        --controller "remote,ip=${CONTROLLER_HOST},port=${CONTROLLER_PORT}" \
        --switch ovsk,protocols=OpenFlow13
    ;;
  benchmark)
    shift
    # Mininet needs a moment to install flows before load is applied.
    exec python3 SDN_files/benchmark.py \
        --port "${CONTROLLER_PORT}" \
        --out /app/results/qos_benchmark.csv "$@"
    ;;
  shell)
    exec /bin/bash
    ;;
  *)
    exec "$@"
    ;;
esac
