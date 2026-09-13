from pathlib import Path

path = Path('index.html')
text = path.read_text()

marker = "  function fireboardTimestampToIso(value) {\n"
helper = """  function fireboardCloudHeaders(accessToken) {\n    return {\n      apikey: SUPABASE_PUBLISHABLE_KEY,\n      Authorization: `Bearer ${accessToken}`,\n      Accept: 'application/json'\n    };\n  }\n\n"""

if 'function fireboardCloudHeaders(accessToken)' not in text:
    if marker not in text:
        raise SystemExit('Could not find FireBoard import helper insertion point.')
    text = text.replace(marker, helper + marker, 1)

count = text.count('cloudHeaders(accessToken)')
if count < 1:
    raise SystemExit('Could not find broken cloudHeaders references.')
text = text.replace('cloudHeaders(accessToken)', 'fireboardCloudHeaders(accessToken)')
text = text.replace('<strong>Build 2026-09-13K</strong>', '<strong>Build 2026-09-13K1</strong>', 1)
path.write_text(text)

sw = Path('service-worker.js')
sw_text = sw.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-22-4';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-22-4a';"
if old_cache not in sw_text:
    raise SystemExit('Could not find V1.22.4 service worker cache name.')
sw.write_text(sw_text.replace(old_cache, new_cache, 1))
