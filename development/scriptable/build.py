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
assert app.count('if (!confirm(') == 2, 'Review Scriptable confirmation substitutions after upstream changes'
app = app.replace('if (!confirm(', 'if (!await window.__ldcConfirm(')
app = app.replace("button.onclick = () => action(async () => restore(JSON.parse(await call('readSnapshot',{token:snapshot.token}))));", "button.onclick = () => action(async () => { status('Reading selected recovery copy…'); $('status').scrollIntoView({behavior:'smooth'}); return restore(JSON.parse(await call('readSnapshot',{token:snapshot.token}))); });")
script = (root / 'bridge.js').read_text() + '\n' + (root / 'confirm.js').read_text() + '\n' + app
style = (web / 'style.css').read_text() + '\n' + (root / 'confirm.css').read_text()
def hash_source(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode()).digest()).decode() + "'"
html = (web / 'index.html').read_text()
html = html.replace("script-src 'self'", 'script-src ' + hash_source(script))
html = html.replace("style-src 'self'", 'style-src ' + hash_source(style))
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + style + '</style>')
html = html.replace('<script src="app.bundle.js"></script>', '<script>' + script + '</script>')
html = html.replace('iCloud uploads need connectivity and a signed app.', 'Copies are staged in Scriptable’s iCloud folder; upload completion needs independent verification.')
html = html.replace('LDCookLog <small>2.0 Dev</small>', 'LDCookLog <small>2.0 Scriptable Dev · restore confirmation 1</small>')
storage = (root / 'storage.cjs').read_text().replace('module.exports = {createStorage};', '')
header = '// LDCookLog 2.0 experimental offline host — synthetic testing only.\n'
output = header + 'const LDC_HTML = ' + json.dumps(html, ensure_ascii=True) + ';\n' + storage + '\n' + (root / 'launcher.js').read_text()
(root / 'LDCookLog-2-Development.js').write_text(output)
# Test harness renders exactly the generated page, never private journal data.
(root / 'page.html').write_text(html)
(root / 'LDCookLog-Interface-Check.js').write_text(
    '// Read-only interface diagnostic — no cooking storage.\n'
    + 'const LDC_HTML = ' + json.dumps(html, ensure_ascii=True) + ';\n'
    + (root / 'interface-check.js').read_text())

# A separate local/cloud destination; source recovery copies are read-only.
trial_html = html.replace('2.0 Scriptable Dev · restore confirmation 1', '2.0 Restore Check')
trial_html = trial_html.replace('Development build — keep using your current app for real cooks.', 'Separate restore-test journal. Your working development journal stays in its own folder.')
trial_launcher = (root / 'launcher.js').read_text().replace("const LDC_NAMESPACE = 'development';", "const LDC_NAMESPACE = 'restore-check';")
(root / 'LDCookLog-2-Restore-Check.js').write_text(header + 'const LDC_HTML = ' + json.dumps(trial_html, ensure_ascii=True) + ';\n' + storage + '\n' + trial_launcher)
(root / 'restore-check.html').write_text(trial_html)
