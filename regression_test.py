#!/usr/bin/env python3
"""
Regression Test: Verify static routes remain unchanged after rule reinstall.
"""
import subprocess
import time

def get_flows(switch):
    result = subprocess.run(
        ['ovs-ofctl', '-O', 'OpenFlow13', 'dump-flows', switch],
        capture_output=True, text=True
    )
    lines = []
    for line in result.stdout.splitlines():
        clean = ' '.join(
            w for w in line.split()
            if not w.startswith('n_packets')
            and not w.startswith('n_bytes')
            and not w.startswith('duration')
            and not w.startswith('cookie')
        )
        if clean.strip():
            lines.append(clean.strip())
    return sorted(lines)

switches = ['s1', 's2', 's3']

print("=" * 50)
print("  REGRESSION TEST: Static Route Stability")
print("=" * 50)

# Step 1: Record original flows
print("\n[1] Recording original flow tables...")
original = {sw: get_flows(sw) for sw in switches}
for sw, flows in original.items():
    print(f"  {sw}: {len(flows)} rules recorded")

# Step 2: Delete all flows
print("\n[2] Deleting all flow rules...")
for sw in switches:
    subprocess.run(['ovs-ofctl', '-O', 'OpenFlow13', 'del-flows', sw])
    print(f"  Deleted flows on {sw}")

# Step 3: Reconnect controller
print("\n[3] Triggering controller to reinstall flows...")
for sw in switches:
    subprocess.run(['ovs-vsctl', 'del-controller', sw])
    subprocess.run(['ovs-vsctl', 'set-controller', sw, 'tcp:127.0.0.1:6633'])
print("  Waiting 5 seconds for reinstall...")
time.sleep(5)

# Step 4: Record new flows
print("\n[4] Recording flow tables after reinstall...")
new = {sw: get_flows(sw) for sw in switches}

# Step 5: Compare
print("\n[5] Comparing flow tables...")
all_pass = True
for sw in switches:
    if original[sw] == new[sw]:
        print(f"  {sw}: PASS - flows identical")
    else:
        print(f"  {sw}: FAIL - flows differ!")
        all_pass = False

print("\n" + "=" * 50)
if all_pass:
    print("  RESULT: ALL TESTS PASSED")
else:
    print("  RESULT: SOME TESTS FAILED")
print("=" * 50)
