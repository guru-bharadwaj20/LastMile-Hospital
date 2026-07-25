# Running LastMile in Docker

Three images, so that "clone and run" means something:

| Service | Image | What it is |
|---|---|---|
| `dashboard` | `lastmile/dashboard` | React build served by nginx |
| `controller` | `lastmile/controller` | Ryu + the QoS app + REST/SSE API |
| `mininet` | `lastmile/mininet` | Mininet + Open vSwitch + `iperf3` |

## Dashboard only

Works everywhere Docker does. No privileges, no kernel modules.

```bash
docker compose up --build dashboard
# http://localhost:8081
```

This runs the browser simulation, which is the default mode. It is the whole
demo, minus live counters.

## Full stack

```bash
docker compose --profile sdn up --build
# dashboard   http://localhost:8081/?mode=live
# controller  http://localhost:8080/lastmile/health
```

The Mininet CLI is attached to the `mininet` service:

```bash
docker attach lastmile-mininet-1
mininet> pingall
mininet> h1 ping -Q 184 -c 10 10.0.0.3     # 46 << 2, EF, P1
```

## Benchmark

```bash
docker compose --profile bench run --rm benchmark
python3 SDN_files/report_results.py results/qos_benchmark.csv --update-readme
```

Results land in `./results/` on the host through a bind mount.

## Platform requirements, stated plainly

The `mininet` and `benchmark` services need things a normal container does
not get:

- **`--privileged`** — Mininet creates network namespaces, veth pairs and `tc`
  qdiscs
- **`/lib/modules` mounted read-only** — Open vSwitch may need to load
  `openvswitch.ko` from the host kernel
- **`network_mode: host`** — so `ovs-vswitchd` sees real interfaces
- **A Linux kernel with Open vSwitch support** — `modprobe openvswitch` must
  succeed on the host

Consequences:

| Platform | Dashboard | Controller | Mininet / benchmark |
|---|---|---|---|
| Linux | Yes | Yes | Yes |
| macOS (Docker Desktop) | Yes | Yes | Usually — runs in Docker's Linux VM, but `network_mode: host` behaves differently and results may be noisy |
| Windows (Docker Desktop / WSL2) | Yes | Yes | Sometimes — depends on whether the WSL2 kernel has the `openvswitch` module |

If the Mininet service will not start on your machine, the dashboard and
controller still will. **A benchmark run on a platform where the emulation is
degraded is worse than no benchmark**, because the numbers look real and are
not — so if `mininet` misbehaves, do not publish results from it.

## Notes on the images

- The controller pins **Python 3.11**. Ryu 4.34 depends on an old eventlet
  that does not import on 3.12+, where `ssl.wrap_socket` was removed. 3.11 is
  the newest interpreter it runs on.
- The dashboard image is multi-stage: the runtime layer is nginx plus the
  built assets, with no Node toolchain.
- Open vSwitch normally starts under systemd, which is absent here, so
  `mininet-entrypoint.sh` creates the database and starts `ovsdb-server` and
  `ovs-vswitchd` by hand.
- The Mininet container waits for the controller's OpenFlow port before
  starting the topology, so switches do not come up unmanaged and briefly
  forward with no rules.

## Troubleshooting

**`ovs-vswitchd` fails to start** — the host kernel lacks the module. Try
`sudo modprobe openvswitch` on the host.

**Switches connect but nothing pings** — the controller may have started
after the switches. `docker compose --profile sdn restart mininet`.

**`LIVE` badge never appears** — check `curl http://localhost:8080/lastmile/health`.
If that fails the controller is not up; if it succeeds the browser is likely
being blocked by a mixed-content or CORS rule, which the browser console will
say.

**Queue counters are all zero** — the queues have not been created. OpenFlow
can select a queue but cannot create one:

```bash
docker compose exec mininet python3 SDN_files/setup_qos.py apply
```
