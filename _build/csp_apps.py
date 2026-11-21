#!/usr/bin/env python3
"""Adds or refreshes the security policy on the pages build.py doesn't touch:
the front desk tablet, the staff phone clock and the lobby TV board.

Their code sits inside the page, so the policy lists a fingerprint of each script block.
Run this after editing any of the three pages, before pushing:  python3 _build/csp_apps.py
"""
import base64, hashlib, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONTS = "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com"
SHEET = "https://script.google.com https://script.googleusercontent.com"
COMMON = "base-uri 'none'; form-action 'none'; object-src 'none'; manifest-src 'self'"

PAGES = {
    'frontdesk-q7m4x2/index.html': f"{FONTS}; img-src 'self' data: blob:; connect-src 'self' {SHEET}",
    'frontdesk-q7m4x2/staff/index.html': f"{FONTS}; img-src 'self' data:; connect-src 'self' {SHEET}",
    'board/index.html': f"{FONTS}; img-src 'self' data:; media-src data: blob:; connect-src 'self' https://api.open-meteo.com https://fonts.googleapis.com https://fonts.gstatic.com",
}

META = re.compile(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">\n?')
SCRIPT = re.compile(r'<script>(.*?)</script>', re.S)


def refresh(rel, extra):
    path = ROOT / rel
    html = META.sub('', path.read_text(encoding='utf-8'))
    hashes = ["'sha256-%s'" % base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode()
              for m in SCRIPT.finditer(html)]
    if re.search(r'<script[^>]+src=', html) or re.search(r'\son[a-z]+="', html):
        sys.exit(f'{rel}: has an outside script file or an inline on...= handler; update this tool first.')
    policy = f"default-src 'none'; script-src {' '.join(hashes)}; {extra}; {COMMON}"
    meta = f'<meta http-equiv="Content-Security-Policy" content="{policy}">\n'
    # The policy must come before the first script to cover it.
    html = html.replace('<meta name="viewport"', meta + '<meta name="viewport"', 1)
    if meta not in html:
        sys.exit(f'{rel}: no viewport tag to anchor the policy on.')
    path.write_text(html, encoding='utf-8')
    print(f'{rel}: {len(hashes)} script blocks')


if __name__ == '__main__':
    for rel, extra in PAGES.items():
        refresh(rel, extra)
