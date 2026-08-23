#!/usr/bin/env python3
import json
import subprocess
import sys
from datetime import datetime, timezone

now_iso = datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%dT%H:%M:%S%z')
log_date = datetime.now().strftime('%Y-%m-%d')
log_file = f"/Users/joshdev/Assistedly.ai/racknerd-health-{log_date}.log"

data = {
    "107.174.146.230": {"host":"racknerd-287588f","load5":0.00,"ram":852,"swap":359,"disk":"42%","failed":0,"vcpu":2},
    "172.245.119.156": {"host":"racknerd-3870700","load5":1.05,"ram":1249,"swap":229,"disk":"59%","failed":0,"vcpu":2},
    "107.174.44.66":   {"host":"racknerd-4e84e0a","load5":0.04,"ram":854,"swap":115,"disk":"55%","failed":0,"vcpu":1},
    "107.172.94.35":   {"host":"racknerd-5a9aa1d","load5":1.31,"ram":1209,"swap":224,"disk":"47%","failed":0,"vcpu":2},
    "104.168.38.162":  {"host":"racknerd-6c57489","load5":2.67,"ram":1158,"swap":605,"disk":"76%","failed":0,"vcpu":2},
    "75.127.14.185":   {"host":"racknerd-9a7a1c2","load5":0.48,"ram":11101,"swap":1364,"disk":"68%","failed":0,"vcpu":6},
    "198.144.180.149": {"host":"racknerd-aa30db5","load5":1.32,"ram":6587,"swap":0,"disk":"65%","failed":0,"vcpu":1},
    "23.95.189.106":   {"host":"racknerd-f9eb56e","load5":0.22,"ram":2060,"swap":814,"disk":"35%","failed":0,"vcpu":3},
}

lines = []
breached = []
for ip in [
    "107.174.146.230","172.245.119.156","107.174.44.66","107.172.94.35",
    "104.168.38.162","75.127.14.185","198.144.180.149","23.95.189.106"
]:
    d = data[ip]
    status = "OK"
    alerts = []
    disk_val = int(d["disk"].rstrip("%"))
    if disk_val >= 90:
        status = "CRIT"
        alerts.append(f"disk={d['disk']}(crit)")
    elif disk_val >= 80:
        status = "WARN"
        alerts.append(f"disk={d['disk']}(warn)")
    if d["ram"] < 200:
        status = "CRIT"
        alerts.append(f"ram_avail={d['ram']}(crit)")
    if d["swap"] > 512:
        status = "WARN"
        alerts.append(f"swap_used={d['swap']}(warn)")
    if d["load5"] > d["vcpu"] * 2:
        status = "WARN"
        alerts.append(f"load5={d['load5']}(warn)")
    if d["failed"] > 0:
        status = "WARN"
        alerts.append(f"failed_units={d['failed']}")
    line = f"{now_iso} {ip} {d['host']} {status} load5={d['load5']} ram_avail={d['ram']}MB swap_used={d['swap']}MB disk={d['disk']} failed_units={d['failed']}"
    if alerts:
        line += " alerts=[" + " ".join(alerts) + "]"
        breached.append(ip)
    lines.append(line)

with open(log_file, "w") as f:
    f.write("\n".join(lines) + "\n")

for l in lines:
    print(l)
print(f"\nLog written to: {log_file}")
print(f"Breached IPs: {breached}")

if breached:
    webhook_path = "/Users/joshfialkoff/.config/goose/discord_webhook"
    try:
        with open(webhook_path) as f:
            webhook = f.read().strip()
    except Exception as e:
        print(f"Cannot read webhook: {e}")
        sys.exit(1)

    details = []
    for ip in breached:
        d = data[ip]
        details.append(f"• `{ip}` ({d['host']}) — swap_used={d['swap']}MB (threshold 512MB)")

    badge = "🚨"
    cmd = (
        "ssh -o BatchMode=yes -i ~/.ssh/7-5-25kuroit root@75.127.14.185 "
        '"grep -l \'VmSwap\' /proc/*/status 2>/dev/null | xargs -I{} awk \'/^Name:/{n=$2} /^VmSwap:/{v=$2; if(v>0) print n,v}\' {} | sort -k2 -rn | head -10"'
    )
    content = (
        f"{badge} **RackNerd Alert — Swap Threshold Breached**\n\n"
        + "\n".join(details)
        + "\n\n**Next command (list swap hogs on worst server 75.127.14.185):**\n"
        "```bash\n"
        + cmd
        + "\n```\n"
    )

    if len(content) > 1800:
        content = content[:1797] + "..."

    payload = json.dumps({"content": content})
    result = subprocess.run(
        ["curl", "-s", "-H", "Content-Type: application/json", "-d", payload, webhook],
        capture_output=True, text=True
    )
    print(f"Discord POST status: {result.returncode}")
    print(f"Discord response: {result.stdout.strip()[:200]}")
else:
    print("All healthy — no Discord alert sent.")
