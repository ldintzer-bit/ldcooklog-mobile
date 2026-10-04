"""Regenerate approved inline-script hashes after editing index.html."""
from pathlib import Path
import re, hashlib, base64
page = Path(__file__).resolve().parents[1] / 'index.html'
s = page.read_text()
hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode() + "'" for m in re.finditer(r'<script\b[^>]*>([\s\S]*?)</script>', s, re.I) if m.group(1)]
def replace_policy(match):
    policy = re.sub(r"script-src[^;]*", "script-src 'self' " + ' '.join(hashes), match.group(1))
    return '<meta http-equiv="Content-Security-Policy" content="' + policy + '">'
s, count = re.subn(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', replace_policy, s)
assert count == 1, 'Expected exactly one CSP meta tag'
page.write_text(s)
print('Updated CSP hashes for', len(hashes), 'inline scripts')
