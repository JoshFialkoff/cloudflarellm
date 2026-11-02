#!/usr/bin/env python3
"""Install Vexa on the VPS in capture-only mode via Paramiko."""
import paramiko, sys, os, time

HOST = "161.97.125.17"
USER = "root"
PASSWORD = "3b3905fd-8204-4a0f-a640-b4ef00d0a190"

def run(cmd, timeout=120):
    print(f"\n>>> {cmd}")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    chan = client.get_transport().open_session()
    chan.settimeout(timeout)
    chan.get_pty(term='xterm', width=200, height=60)
    chan.exec_command(cmd)
    out, err = b"", b""
    start = time.time()
    while not chan.exit_status_ready():
        if chan.recv_ready():
            data = chan.recv(65536)
            if data:
                out += data
                sys.stdout.buffer.write(data)
                sys.stdout.flush()
        if chan.recv_stderr_ready():
            data = chan.recv_stderr(65536)
            if data:
                err += data
                sys.stderr.buffer.write(data)
                sys.stderr.flush()
        if time.time() - start > timeout:
            chan.close()
            client.close()
            raise TimeoutError(f"Command timed out after {timeout}s")
        time.sleep(0.1)
    # drain remaining
    while chan.recv_ready():
        data = chan.recv(65536)
        out += data
        sys.stdout.buffer.write(data)
        sys.stdout.flush()
    while chan.recv_stderr_ready():
        data = chan.recv_stderr(65536)
        err += data
        sys.stderr.buffer.write(data)
        sys.stderr.flush()
    rc = chan.recv_exit_status()
    client.close()
    print(f"<<< exit {rc}")
    return rc, out.decode(errors='replace'), err.decode(errors='replace')

if __name__ == "__main__":
    print("Checking prerequisites...")
    run("hostname && docker --version && docker compose version && uname -a")

    print("\nCloning Vexa...")
    rc, _, _ = run("rm -rf /opt/vexa && git clone https://github.com/Vexa-ai/vexa.git /opt/vexa", timeout=180)
    if rc != 0:
        sys.exit(1)

    print("\nRunning make all...")
    rc, out, err = run("cd /opt/vexa && make all", timeout=600)
    if rc != 0:
        print("make all failed")
        sys.exit(rc)

    print("\nConfiguring capture-only mode...")
    # Read current .env and modify transcribe_enabled
    read_cmd = (
        "cd /opt/vexa && ls -la && "
        "if grep -q 'transcribe_enabled' .env; then sed -i 's/transcribe_enabled=.*/transcribe_enabled=false/' .env; else echo 'transcribe_enabled=false' >> .env; fi && "
        "grep -E '^(API_KEY|EXECUTOR_TOKEN|transcribe_enabled|WEB_|API_PORT|DEFAULT_|STT_)' .env || true"
    )
    run(read_cmd)

    print("\nPulling up services...")
    rc, _, _ = run("cd /opt/vexa && docker compose up -d", timeout=300)
    if rc != 0:
        print("docker compose up failed")
        sys.exit(rc)

    print("\nWaiting for services to come up...")
    time.sleep(10)

    print("\nService status and ports...")
    run("cd /opt/vexa && docker compose ps && ss -tlnp | grep -E '13000|18056' || true")

    print("\nFinal .env summary...")
    run("cd /opt/vexa && echo '--- API URLs ---' && grep -E '^(API_KEY|EXECUTOR_TOKEN|transcribe_enabled|API_PORT|WEB_|DEFAULT_|STT_)' .env | sort")

    print("\nDone.")
