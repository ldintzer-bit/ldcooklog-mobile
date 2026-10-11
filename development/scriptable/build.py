"""Produce an offline Scriptable script from reviewed repo sources, no downloads."""
from pathlib import Path
import base64
import hashlib
import json

root = Path(__file__).parent
web = root.parent / 'native' / 'Web'
app = (web / 'app.bundle.js').read_text()
app = app.removesuffix('})();\n') + '''
window.__ldcVerify = text => unseal(JSON.parse(text));
window.__ldcReseal = async (text, revision) => JSON.stringify(await seal((await unseal(JSON.parse(text))).state, revision));
})();
'''
script = (root / 'bridge.js').read_text() + '\n' + app
style = (web / 'style.css').read_text()
def hash_source(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode()).digest()).decode() + "'"
html = (web / 'index.html').read_text()
html = html.replace("script-src 'self'", 'script-src ' + hash_source(script))
html = html.replace("style-src 'self'", 'style-src ' + hash_source(style))
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + style + '</style>')
html = html.replace('<script src="app.bundle.js"></script>', '<script>' + script + '</script>')
html = html.replace('iCloud uploads need connectivity and a signed app.', 'Copies are staged in Scriptable’s iCloud folder; upload completion needs independent verification.')
html = html.replace('LDCookLog <small>2.0 Dev</small>', 'LDCookLog <small>2.0 Scriptable Dev</small>')
storage = (root / 'storage.cjs').read_text().replace('module.exports = {createStorage};', '')
header = '// LDCookLog 2.0 experimental offline host — synthetic testing only.\n'
output = header + 'const LDC_HTML = ' + json.dumps(html, ensure_ascii=True) + ';\n' + storage + '\n' + (root / 'launcher.js').read_text()
(root / 'LDCookLog-2-Development.js').write_text(output)
# Test harness renders exactly the generated page, never private journal data.
(root / 'page.html').write_text(html)
