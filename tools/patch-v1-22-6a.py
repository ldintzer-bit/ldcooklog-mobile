from pathlib import Path

path = Path('index.html')
text = path.read_text()

old = "let authSession = getCloudSession();"
new = "let authSession = loadCloudSession();"
if old not in text:
    raise SystemExit('Could not find V1.22.6 graph cloud-session call.')
text = text.replace(old, new, 1)
text = text.replace('<strong>Build 2026-09-13M</strong>', '<strong>Build 2026-09-13M1</strong>', 1)
path.write_text(text)

sw = Path('service-worker.js')
sw_text = sw.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-22-6';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-22-6a';"
if old_cache not in sw_text:
    raise SystemExit('Could not find V1.22.6 service worker cache name.')
sw.write_text(sw_text.replace(old_cache, new_cache, 1))
