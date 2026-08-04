#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — sklapa samostalni OFFLINE fajl iz izvora + vendored runtime.

Ulaz:
  izvor/Topologija-redizajn.dc.html   (UI: <x-dc> šablon + <script data-dc-script> logika)
  izvor/support.js                    (dc-runtime — auto-boot, transpilacija, render)
  izvor/backend.js                    (logika: CIDR, model podataka, storage 'topo_state', seed)
  vendor/react.production.min.js      (React 18.3.1 UMD)
  vendor/react-dom.production.min.js  (ReactDOM 18.3.1 UMD)
  vendor/babel.min.js                 (@babel/standalone 7.29.0 — transpilacija JSX-a u browseru)
  vendor/fonts.css                    (opciono: @font-face sa ugrađenim base64 woff2)

Izlaz:
  Topologija-mreze-offline.html       (dupli klik -> radi offline, bez interneta)

Pokretanje:  python build.py
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))

def read(*parts):
    with open(os.path.join(HERE, *parts), encoding="utf-8") as f:
        return f.read()

def esc_script(js):
    # spriječi da minifikovani JS prijevremeno zatvori <script> tag
    return re.sub(r'</script', r'<\\/script', js, flags=re.I)

# --- ulazi ---
SRC      = read("izvor", "Topologija-redizajn.dc.html")
SUPPORT  = read("izvor", "support.js")
BACKEND  = read("izvor", "backend.js")
REACT    = read("vendor", "react.production.min.js")
REACTDOM = read("vendor", "react-dom.production.min.js")
BABEL    = read("vendor", "babel.min.js")

fonts_css = None
if os.path.exists(os.path.join(HERE, "vendor", "fonts.css")):
    fonts_css = read("vendor", "fonts.css")

# backend.js (ESM) -> globalni objekt window.__BE.
# Ovako NEMA dinamičkog import()-a, pa radi pouzdano i preko file:// (dupli klik).
_exp_fn    = re.findall(r'export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', BACKEND)
_exp_const = re.findall(r'export\s+const\s+([A-Za-z_$][\w$]*)', BACKEND)
_exports   = _exp_fn + _exp_const
assert _exports, "nisam našao nijedan export u backend.js"
_backend_body = re.sub(r'\bexport\s+', '', BACKEND)   # skini 'export ' ključne riječi
BACKEND_GLOBAL = (
    '<script>/* backend.js (logika) kao globalni objekt window.__BE — radi i sa file:// */\n'
    'window.__BE = (function(){\n' + _backend_body +
    '\nreturn {' + ','.join(_exports) + '};\n})();\n</script>'
)

# --- BOOT blok koji zamjenjuje <script src="./support.js"> ---
# Redoslijed je bitan: React -> ReactDOM -> Babel -> backend(global) -> support(auto-boot).
# support.js sam preskače CDN kad su window.React/ReactDOM/Babel već prisutni.
BOOT = (
    '<script>/* React 18.3.1 UMD (vendored, offline) */\n' + esc_script(REACT) + '\n</script>\n'
    '<script>/* ReactDOM 18.3.1 UMD (vendored, offline) */\n' + esc_script(REACTDOM) + '\n</script>\n'
    '<script>/* @babel/standalone 7.29.0 (vendored, offline) */\n' + esc_script(BABEL) + '\n</script>\n'
    + BACKEND_GLOBAL + '\n'
    '<script>/* dc-runtime (support.js, vendored) — auto-boot */\n' + esc_script(SUPPORT) + '\n</script>'
)

out = SRC

# 1) <script src="./support.js"></script>  ->  BOOT
out, n = re.subn(r'<script\s+src="\./support\.js"\s*></script>', lambda m: BOOT, out, count=1)
assert n == 1, "nisam našao <script src=./support.js> u izvoru"

# 2) dinamički import backend.js -> globalni objekt (bez import(), radi na file://)
n1 = out.count("import('./backend.js')") + out.count('import("./backend.js")')
out = out.replace("import('./backend.js')", "Promise.resolve(window.__BE)")
out = out.replace('import("./backend.js")', "Promise.resolve(window.__BE)")
assert n1 >= 1, "nisam našao import('./backend.js') u izvoru"

# 3) fontovi: inline @font-face umjesto Google Fonts (ako imamo vendor/fonts.css)
if fonts_css:
    out = out.replace(
        '<link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">',
        '<style>/* vendored fonts (offline) */\n' + fonts_css + '\n</style>')
    out = re.sub(r'<link rel="preconnect"[^>]*>', '', out)

OUT_PATH = os.path.join(HERE, "Topologija-mreze-offline.html")
with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write(out)

print("OK ->", os.path.basename(OUT_PATH))
print("velicina: %.2f MB" % (len(out.encode("utf-8")) / 1024 / 1024))
print("fontovi ugradjeni:", bool(fonts_css))
