#!/usr/bin/env python3
"""
Agent za dijagnostiku mreže — Topologija mreže (offline)
=========================================================
Mali lokalni servis koji frontend (Topologija-mreze-offline.html) zove na
"Pokreni sken" i na ping/traceroute: ping, traceroute, provjera portova,
masovni sken opsega.

Radi POTPUNO offline — ništa ne šalje na internet. Pokreni ga na računaru
koji ima mrežni pristup uređajima (isti onaj gdje otvaraš aplikaciju).

Instalacija (jednom, treba internet samo za ovaj korak):
    pip install fastapi uvicorn icmplib

Pokretanje (bilo koje od dva):
    python agent.py
    uvicorn agent:app --host 127.0.0.1 --port 8765
    # (icmplib ping/traceroute traži administratorska prava; ako ih nema,
    #  agent automatski koristi sistemski ping/tracert — radi i bez admina.)

U aplikaciji je agent podrazumijevano na http://localhost:8765
(promjenjivo preko meta.agentUrl u JSON-u).
"""

import ipaddress
import platform
import re
import shutil
import socket
import subprocess
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from icmplib import ping as icmp_ping          # type: ignore
    from icmplib import traceroute as icmp_trace    # type: ignore
    HAVE_ICMPLIB = True
except Exception:
    HAVE_ICMPLIB = False

IS_WIN = platform.system().lower().startswith("win")

app = FastAPI(title="Topologija — agent", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # lokalni alat; dozvoli svim ishodištima
    allow_methods=["*"],
    allow_headers=["*"],
)


def _valid_ip(ip: str) -> bool:
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


def _run(cmd, timeout=25):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return "⚠ Vremensko ograničenje isteklo."
    except FileNotFoundError:
        return "⚠ Komanda nije pronađena na sistemu."


# ---------------------------------------------------------------- PING
@app.get("/ping")
def ping(ip: str, count: int = 4):
    if not _valid_ip(ip):
        return {"ok": False, "error": "Neispravna IP adresa"}
    # brzi, strukturirani odgovor preko icmplib (za /nadzor sken)
    if HAVE_ICMPLIB:
        try:
            h = icmp_ping(ip, count=count, interval=0.3, timeout=1, privileged=not IS_WIN)
            out = (f"Ping {ip}: paketi {h.packets_sent} poslato / "
                   f"{h.packets_received} primljeno, {h.packet_loss*100:.0f}% gubitak\n"
                   f"RTT min/avg/max = {h.min_rtt:.1f}/{h.avg_rtt:.1f}/{h.max_rtt:.1f} ms")
            return {"ok": True, "alive": h.is_alive,
                    "rtt_ms": round(h.avg_rtt, 1) if h.is_alive else None,
                    "loss": h.packet_loss, "output": out}
        except Exception:
            # padni na sistemski ping
            pass
    cmd = (["ping", "-n", str(count), ip] if IS_WIN
           else ["ping", "-c", str(count), ip])
    out = _run(cmd)
    alive = ("ttl=" in out.lower()) or ("bytes from" in out.lower())
    m = re.search(r"(?:Average|avg)[^\d]*(\d+(?:\.\d+)?)", out)
    return {"ok": True, "alive": alive,
            "rtt_ms": float(m.group(1)) if m else None, "output": out}


# ---------------------------------------------------------- TRACEROUTE
@app.get("/trace")
def trace(ip: str, max_hops: int = 20):
    if not _valid_ip(ip):
        return {"ok": False, "error": "Neispravna IP adresa"}
    if HAVE_ICMPLIB:
        try:
            hops = icmp_trace(ip, max_hops=max_hops, timeout=1, privileged=not IS_WIN)
            lines = [f"Traceroute do {ip}, maks {max_hops} skokova:"]
            for h in hops:
                lines.append(f"  {h.distance:>2}  {h.address:<16}  {h.avg_rtt:.1f} ms")
            return {"ok": True, "output": "\n".join(lines)}
        except Exception:
            pass
    if IS_WIN:
        cmd = ["tracert", "-h", str(max_hops), ip]
    else:
        exe = "traceroute" if shutil.which("traceroute") else "tracepath"
        cmd = [exe, "-m", str(max_hops), ip] if exe == "traceroute" else [exe, ip]
    return {"ok": True, "output": _run(cmd, timeout=40)}


# --------------------------------------------------------------- PORTS
COMMON_PORTS = {22: "SSH", 23: "Telnet", 80: "HTTP", 443: "HTTPS",
                554: "RTSP (kamere)", 3389: "RDP", 8000: "HTTP-alt", 8080: "HTTP-alt"}


@app.get("/ports")
def ports(ip: str, list: str = ""):
    if not _valid_ip(ip):
        return {"ok": False, "error": "Neispravna IP adresa"}
    targets = ([int(x) for x in list.split(",") if x.strip().isdigit()]
               if list else sorted(COMMON_PORTS))
    result = {}
    lines = [f"Provjera portova na {ip}:"]
    for port in targets:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.6)
        openp = s.connect_ex((ip, port)) == 0
        s.close()
        result[port] = openp
        lines.append(f"  {port:>5}  {'OTVOREN' if openp else 'zatvoren':<8}"
                     f"  {COMMON_PORTS.get(port, '')}")
    return {"ok": True, "ports": result, "output": "\n".join(lines)}


# ---------------------------------------------------------------- SCAN
@app.get("/scan")
def scan(cidr: str):
    """Masovni ping cijelog opsega (npr. 10.20.9.0/24) — za module nadzora."""
    try:
        net = ipaddress.ip_network(cidr, strict=False)
    except ValueError:
        return {"ok": False, "error": "Neispravan CIDR"}
    hosts = [str(h) for h in net.hosts()]
    if len(hosts) > 512:
        return {"ok": False, "error": "Opseg prevelik (max /23)"}

    def one(ip):
        if HAVE_ICMPLIB:
            try:
                h = icmp_ping(ip, count=1, timeout=1, privileged=not IS_WIN)
                return ip, {"alive": h.is_alive,
                            "rtt_ms": round(h.avg_rtt, 1) if h.is_alive else None}
            except Exception:
                pass
        cmd = (["ping", "-n", "1", "-w", "800", ip] if IS_WIN
               else ["ping", "-c", "1", "-W", "1", ip])
        out = _run(cmd, timeout=3).lower()
        return ip, {"alive": ("ttl=" in out or "bytes from" in out), "rtt_ms": None}

    with ThreadPoolExecutor(max_workers=64) as ex:
        results = dict(ex.map(one, hosts))
    alive = [ip for ip, r in results.items() if r["alive"]]
    return {"ok": True, "cidr": cidr, "alive_count": len(alive),
            "alive": alive, "hosts": results}


@app.get("/")
def root():
    return {"ok": True, "service": "Topologija agent",
            "icmplib": HAVE_ICMPLIB,
            "endpoints": ["/ping?ip=", "/trace?ip=", "/ports?ip=", "/scan?cidr="]}


if __name__ == "__main__":
    import uvicorn
    print("Topologija — agent  ·  http://localhost:8765  (Ctrl+C za izlaz)")
    print("icmplib:", "da" if HAVE_ICMPLIB else "ne (koristim sistemski ping/tracert)")
    uvicorn.run(app, host="127.0.0.1", port=8765)
